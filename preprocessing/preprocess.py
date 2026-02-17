#!/usr/bin/env python3
"""
Batch preprocessing CLI for LUMA bill images.

Usage:
    python preprocessing/preprocess.py [--input sample/] [--output sample_preprocessed/] [--no-warp] [--clahe] [--roi-crop]

Iterates all .jpg/.png files in the input directory, runs the preprocessing
pipeline, and saves results to the output directory. Also writes a
preprocessing_metadata.json with per-file stats.
"""

import argparse
import json
import os
import sys

# Add parent dir so we can run from project root: python preprocessing/preprocess.py
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from pipeline import Pipeline

SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png"}


def main():
    parser = argparse.ArgumentParser(description="Preprocess LUMA bill images for AI extraction")
    parser.add_argument("--input", default=os.path.join(os.path.dirname(__file__), "..", "sample"),
                        help="Input directory with original images (default: sample/)")
    parser.add_argument("--output", default=os.path.join(os.path.dirname(__file__), "..", "sample_preprocessed"),
                        help="Output directory for preprocessed images (default: sample_preprocessed/)")
    parser.add_argument("--no-warp", action="store_true",
                        help="Disable perspective warp (only EXIF fix + resize)")
    parser.add_argument("--clahe", action="store_true",
                        help="Enable CLAHE luminance enhancement (default: off)")
    parser.add_argument("--roi-crop", action="store_true",
                        help="Enable ROI crop (default: off, not yet implemented)")
    args = parser.parse_args()

    input_dir = os.path.abspath(args.input)
    output_dir = os.path.abspath(args.output)

    if not os.path.isdir(input_dir):
        print(f"Error: input directory not found: {input_dir}")
        sys.exit(1)

    os.makedirs(output_dir, exist_ok=True)

    pipeline = Pipeline(
        warp_enabled=not args.no_warp,
        clahe_enabled=args.clahe,
        roi_crop_enabled=args.roi_crop,
    )

    # Collect image files
    files = sorted([
        f for f in os.listdir(input_dir)
        if os.path.splitext(f)[1].lower() in SUPPORTED_EXTENSIONS
    ])

    if not files:
        print(f"No supported image files found in {input_dir}")
        sys.exit(1)

    print(f"Preprocessing {len(files)} images: {input_dir} -> {output_dir}")
    print(f"  warp={'ON' if not args.no_warp else 'OFF'}  clahe={'ON' if args.clahe else 'OFF'}")
    print()

    metadata = {}
    n_warped = 0
    n_skipped = 0
    total_ms = 0

    for f in files:
        input_path = os.path.join(input_dir, f)
        output_path = os.path.join(output_dir, f)

        try:
            result = pipeline.process(input_path, output_path)
            metadata[f] = result

            status = "WARPED" if result["warped"] else ("QUAD (too small)" if result["quad_detected"] else "PASS-THROUGH")
            print(f"  {f:45s} {status:15s} {result['processing_ms']:6.1f}ms  {result['original_size']} -> {result['output_size']}")

            if result["warped"]:
                n_warped += 1
            else:
                n_skipped += 1
            total_ms += result["processing_ms"]

        except Exception as e:
            print(f"  {f:45s} ERROR: {e}")
            metadata[f] = {"error": str(e)}
            n_skipped += 1

    # Save metadata JSON
    metadata_path = os.path.join(output_dir, "preprocessing_metadata.json")
    with open(metadata_path, "w") as fp:
        json.dump(metadata, fp, indent=2)

    # Summary
    print()
    print(f"Summary: {len(files)} processed, {n_warped} warped, {n_skipped} pass-through")
    print(f"Total time: {total_ms:.0f}ms (avg {total_ms / len(files):.0f}ms per image)")
    print(f"Metadata saved: {metadata_path}")
    print(f"Output dir: {output_dir}")


if __name__ == "__main__":
    main()
