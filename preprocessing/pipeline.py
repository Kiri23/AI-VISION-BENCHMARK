"""
Image preprocessing pipeline for LUMA bill chart extraction.

Two-step pipeline:
  1. EXIF orientation fix — applies the rotation stored in photo metadata
  2. Resize to stable width (1600px)

Benchmarked against 17 LUMA bill images across 5 AI models.
This resize-only approach beat warp (+perspective correction) and CLAHE
(contrast enhancement) — both hurt accuracy on most models.

Results (v3 prompt, 17 images):
  Resize-only: Gemini 2.0 Flash 93.2%, GPT-5.2 90.5%, Gemini 2.5 Flash 87.3%
  Baseline:    Gemini 2.0 Flash 86.8%, GPT-5.2 85.9%, Gemini 2.5 Flash 68.8%

Why resize helps: normalizing 3072x4080 phone photos to 1600px removes noise
and gives models a consistent resolution to work with.

Usage as module:
    from pipeline import Pipeline
    p = Pipeline()
    metadata = p.process("input.jpg", "output.jpg")
"""

import time
from PIL import Image, ImageOps

TARGET_WIDTH = 1600


class Pipeline:
    def process(self, input_path, output_path):
        """
        Run the full pipeline on a single image.

        Returns metadata dict:
            {
                original_size: [w, h],
                output_size: [w, h],
                processing_ms: float,
            }
        """
        start = time.time()

        # Step 1: EXIF orientation fix
        img = Image.open(input_path)
        img = ImageOps.exif_transpose(img)
        original_size = [img.width, img.height]

        # Step 2: Resize to stable width
        if img.width != TARGET_WIDTH:
            scale = TARGET_WIDTH / img.width
            new_h = int(img.height * scale)
            resample = Image.LANCZOS if scale < 1 else Image.BILINEAR
            img = img.resize((TARGET_WIDTH, new_h), resample=resample)

        output_size = [img.width, img.height]

        save_kwargs = {}
        if output_path.lower().endswith((".jpg", ".jpeg")):
            save_kwargs = {"quality": 85, "optimize": True}
        img.save(output_path, **save_kwargs)

        processing_ms = round((time.time() - start) * 1000, 1)

        return {
            "original_size": original_size,
            "output_size": output_size,
            "processing_ms": processing_ms,
        }
