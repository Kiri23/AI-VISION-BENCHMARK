#!/usr/bin/env python3
"""
Batch preprocessing CLI for LUMA bill images.

Usage:
    python preprocessing/preprocess.py [--input sample/] [--output sample_preprocessed/]

Iterates all .jpg/.png files in the input directory, runs EXIF fix + resize,
and saves results to the output directory with a preprocessing_metadata.json.
"""

import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from pipeline import Pipeline

SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png"}


def main():
    parser = argparse.ArgumentParser(description="Preprocess LUMA bill images for AI extraction")
    parser.add_argument("--input", default=os.path.join(os.path.dirname(__file__), "..", "sample"),
                        help="Input directory with original images (default: sample/)")
    parser.add_argument("--output", default=os.path.join(os.path.dirname(__file__), "..", "sample_preprocessed"),
                        help="Output directory for preprocessed images (default: sample_preprocessed/)")
    args = parser.parse_args()

    input_dir = os.path.abspath(args.input)
    output_dir = os.path.abspath(args.output)

    if not os.path.isdir(input_dir):
        print(f"Error: input directory not found: {input_dir}")
        sys.exit(1)

    os.makedirs(output_dir, exist_ok=True)

    pipeline = Pipeline()

    files = sorted([
        f for f in os.listdir(input_dir)
        if os.path.splitext(f)[1].lower() in SUPPORTED_EXTENSIONS
    ])

    if not files:
        print(f"No supported image files found in {input_dir}")
        sys.exit(1)

    print(f"Preprocessing {len(files)} images: {input_dir} -> {output_dir}")
    print()

    metadata = {}
    total_ms = 0

    for f in files:
        input_path = os.path.join(input_dir, f)
        output_path = os.path.join(output_dir, f)

        try:
            result = pipeline.process(input_path, output_path)
            metadata[f] = result
            print(f"  {f:45s} {result['processing_ms']:6.1f}ms  {result['original_size']} -> {result['output_size']}")
            total_ms += result["processing_ms"]

        except Exception as e:
            print(f"  {f:45s} ERROR: {e}")
            metadata[f] = {"error": str(e)}

    metadata_path = os.path.join(output_dir, "preprocessing_metadata.json")
    with open(metadata_path, "w") as fp:
        json.dump(metadata, fp, indent=2)

    print()
    print(f"Summary: {len(files)} processed")
    print(f"Total time: {total_ms:.0f}ms (avg {total_ms / len(files):.0f}ms per image)")
    print(f"Metadata saved: {metadata_path}")
    print(f"Output dir: {output_dir}")


if __name__ == "__main__":
    main()
