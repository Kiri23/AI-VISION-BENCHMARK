#!/usr/bin/env python3
"""
Data augmentation for LUMA bill images.

Generates realistic variations of clean source images to grow the test dataset.
Ground truth stays the same — it's the same bill, just photographed differently.

Usage:
    python preprocessing/augment.py                     # augment default sources
    python preprocessing/augment.py --sources image.png lumaBill-page4.png
    python preprocessing/augment.py --dry-run            # preview what will be generated
    python preprocessing/augment.py --clean              # remove all augmented images + entries
"""

import argparse
import copy
import json
import os
import sys

from PIL import Image, ImageEnhance, ImageFilter
import numpy as np

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.join(SCRIPT_DIR, "..")
SAMPLE_DIR = os.path.join(PROJECT_DIR, "sample")
GT_PATH = os.path.join(PROJECT_DIR, "ground-truth.json")

DEFAULT_SOURCES = [
    "image.png",
    "lumaBill-page4.png",
    "imagenMobile2.jpg",
    "imagenConSombra2.jpg",
    "imagenWithBackgroundObject3.jpg",
]

AUG_MARKER = "__aug-"


def build_augmentations():
    """Return list of (suffix, transform_fn) tuples."""
    augs = []

    # Rotation: ±5°, ±10°, ±15°
    for deg in [5, 10, 15, -5, -10, -15]:
        sign = "n" if deg < 0 else ""
        augs.append((
            f"rot{sign}{abs(deg)}",
            lambda img, d=deg: img.rotate(d, resample=Image.BICUBIC, expand=True, fillcolor=(255, 255, 255)),
        ))

    # Brightness: 0.6x, 0.8x, 1.2x, 1.4x
    for factor in [0.6, 0.8, 1.2, 1.4]:
        augs.append((
            f"bright{factor}",
            lambda img, f=factor: ImageEnhance.Brightness(img).enhance(f),
        ))

    # Blur: radius 1.0, 2.0
    for radius in [1.0, 2.0]:
        augs.append((
            f"blur{radius}",
            lambda img, r=radius: img.filter(ImageFilter.GaussianBlur(radius=r)),
        ))

    # JPEG artifacts: quality 40, 60 (save+reload at low quality)
    for quality in [40, 60]:
        def jpeg_degrade(img, q=quality):
            import io
            buf = io.BytesIO()
            img.convert("RGB").save(buf, format="JPEG", quality=q)
            buf.seek(0)
            return Image.open(buf).copy()
        augs.append((f"jpeg{quality}", jpeg_degrade))

    # Noise: sigma 10, 20
    for sigma in [10, 20]:
        def add_noise(img, s=sigma):
            arr = np.array(img).astype(np.float32)
            noise = np.random.default_rng(42).normal(0, s, arr.shape)
            arr = np.clip(arr + noise, 0, 255).astype(np.uint8)
            return Image.fromarray(arr)
        augs.append((f"noise{sigma}", add_noise))

    # Combined transforms
    combined = [
        ("rot5_bright0.8", lambda img: ImageEnhance.Brightness(
            img.rotate(5, resample=Image.BICUBIC, expand=True, fillcolor=(255, 255, 255))
        ).enhance(0.8)),
        ("rot10_blur1.0", lambda img: img.rotate(
            10, resample=Image.BICUBIC, expand=True, fillcolor=(255, 255, 255)
        ).filter(ImageFilter.GaussianBlur(radius=1.0))),
        ("rotn5_noise10", lambda img: Image.fromarray(np.clip(
            np.array(img.rotate(-5, resample=Image.BICUBIC, expand=True, fillcolor=(255, 255, 255))).astype(np.float32)
            + np.random.default_rng(42).normal(0, 10, np.array(img.rotate(-5, resample=Image.BICUBIC, expand=True, fillcolor=(255, 255, 255))).shape),
            0, 255
        ).astype(np.uint8))),
        ("bright0.7_blur1.0", lambda img: ImageEnhance.Brightness(img).enhance(0.7).filter(
            ImageFilter.GaussianBlur(radius=1.0)
        )),
    ]
    augs.extend(combined)

    return augs


def augmented_filename(source, suffix):
    """Generate augmented filename: {stem}__aug-{suffix}.{ext}"""
    stem, ext = os.path.splitext(source)
    return f"{stem}{AUG_MARKER}{suffix}{ext}"


def load_ground_truth():
    with open(GT_PATH, "r") as f:
        return json.load(f)


def save_ground_truth(gt):
    with open(GT_PATH, "w") as f:
        json.dump(gt, f, indent=2)
        f.write("\n")


def clean_augmented(dry_run=False):
    """Remove all augmented images and their ground-truth entries."""
    gt = load_ground_truth()

    # Remove augmented entries from ground truth
    aug_keys = [k for k in gt if AUG_MARKER in k]
    for k in aug_keys:
        del gt[k]

    # Remove augmented files from sample/
    aug_files = [f for f in os.listdir(SAMPLE_DIR) if AUG_MARKER in f]

    if dry_run:
        print(f"Would remove {len(aug_keys)} ground-truth entries and {len(aug_files)} files")
        for f in sorted(aug_files)[:10]:
            print(f"  {f}")
        if len(aug_files) > 10:
            print(f"  ... and {len(aug_files) - 10} more")
        return

    for f in aug_files:
        os.remove(os.path.join(SAMPLE_DIR, f))

    save_ground_truth(gt)
    print(f"Cleaned {len(aug_files)} augmented files and {len(aug_keys)} ground-truth entries")


def main():
    parser = argparse.ArgumentParser(description="Augment LUMA bill images for benchmarking")
    parser.add_argument("--sources", nargs="+", default=DEFAULT_SOURCES,
                        help="Source images to augment (default: 5 clean images)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Preview what will be generated without writing files")
    parser.add_argument("--clean", action="store_true",
                        help="Remove all augmented images and ground-truth entries")
    args = parser.parse_args()

    if args.clean:
        clean_augmented(dry_run=args.dry_run)
        return

    gt = load_ground_truth()
    augmentations = build_augmentations()

    # Validate sources exist in ground truth
    for src in args.sources:
        if src not in gt:
            print(f"Error: '{src}' not found in ground-truth.json")
            sys.exit(1)
        src_path = os.path.join(SAMPLE_DIR, src)
        if not os.path.isfile(src_path):
            print(f"Error: '{src}' not found in {SAMPLE_DIR}")
            sys.exit(1)

    planned = []
    for src in args.sources:
        for suffix, _ in augmentations:
            aug_name = augmented_filename(src, suffix)
            planned.append((src, suffix, aug_name))

    print(f"Sources: {len(args.sources)}")
    print(f"Augmentations per source: {len(augmentations)}")
    print(f"Total images to generate: {len(planned)}")
    print()

    if args.dry_run:
        for src, suffix, aug_name in planned:
            print(f"  {src} -> {aug_name}")
        return

    created = 0
    for src in args.sources:
        src_path = os.path.join(SAMPLE_DIR, src)
        img = Image.open(src_path)
        # Convert to RGB if RGBA (for JPEG compat)
        if img.mode == "RGBA":
            img = img.convert("RGB")

        src_gt = gt[src]

        for suffix, transform in augmentations:
            aug_name = augmented_filename(src, suffix)
            aug_path = os.path.join(SAMPLE_DIR, aug_name)

            try:
                aug_img = transform(img)
                if aug_img.mode == "RGBA":
                    aug_img = aug_img.convert("RGB")
                aug_img.save(aug_path, quality=90)

                # Add ground-truth entry
                gt[aug_name] = {
                    "client": f"{src_gt['client']} ({suffix})",
                    "augmented_from": src,
                    "months": copy.deepcopy(src_gt["months"]),
                }
                created += 1

            except Exception as e:
                print(f"  ERROR: {aug_name}: {e}")

        print(f"  {src}: {len(augmentations)} augmentations")

    save_ground_truth(gt)
    print()
    print(f"Created {created} augmented images")
    print(f"Ground truth now has {len(gt)} entries")


if __name__ == "__main__":
    main()
