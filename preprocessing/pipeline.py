"""
Image preprocessing pipeline for LUMA bill chart extraction.

Three-step pipeline:
  1. EXIF orientation fix (always)
  2. Contour detection + perspective warp (best-effort)
  3. Resize to stable width (always)

Usage as module:
    from pipeline import Pipeline
    p = Pipeline()
    metadata = p.process("input.jpg", "output.jpg")
"""

import time
import cv2
import numpy as np
from PIL import Image, ImageOps


# ============================================================================
# WARNING: PARAMETER SENSITIVITY
#
# The contour detection + perspective warp step is HIGHLY sensitive to these
# parameters. Different images (lighting, background, angle) may need different
# values. The current values were tuned against the sample/ dataset of ~18
# LUMA bill photos. If you add very different images (e.g. different bill
# format, extreme angles >45 degrees, very dark photos), you may need to
# re-tune.
#
# The approach:
#   1. Otsu threshold to separate white paper from darker background
#   2. Morphological close to fill gaps (text, chart elements, shadows)
#   3. Largest contour → convex hull → aggressive approxPolyDP to get 4 pts
#   4. Measure perspective distortion (opposite edge length ratios)
#   5. Only warp if significant distortion detected (ratio < SKEW_THRESHOLD)
#
# Key parameters to adjust:
#   MORPH_KERNEL / MORPH_ITERATIONS — how aggressively to fill gaps in threshold
#   APPROX_EPSILON_*                — how to simplify hull to 4 points
#   MIN_QUAD_AREA_RATIO             — minimum quad size relative to image
#   SKEW_THRESHOLD                  — how much distortion triggers a warp
#   PADDING_FACTOR                  — margin around detected quad
#
# When in doubt: the pipeline is designed to SKIP warp if unsure.
# A false negative (no warp on angled image) is much better than a
# false positive (warping a clean image incorrectly).
# ============================================================================

# GaussianBlur kernel size (must be odd). Larger = more smoothing before threshold.
BLUR_KERNEL = (5, 5)

# Morphological close kernel and iterations.
# Fills gaps inside the white paper region (text, chart bars, fold lines).
# Too aggressive = merges paper with background. Too weak = paper has holes.
# WARNING: These values are tuned for photos where the bill fills 50-90% of frame.
MORPH_KERNEL_SIZE = 7
MORPH_ITERATIONS = 3

# approxPolyDP epsilon factors. We try increasing values until we get <= 4 points.
# Lower = more faithful to shape. Higher = more aggressive simplification.
# WARNING: If the bill has rounded corners or the hand occludes a corner,
# we may need eps up to 0.10 to collapse 5 vertices down to 4.
APPROX_EPSILON_VALUES = [0.02, 0.05, 0.08, 0.10]

# Minimum area of detected quad relative to total image area.
# Prevents detecting small rectangles (text boxes, chart elements) as the bill.
# 0.15 = quad must be at least 15% of image area.
MIN_QUAD_AREA_RATIO = 0.15

# Perspective distortion threshold.
# We measure ratio of opposite edges: min(top,bottom)/max(top,bottom) and same for left/right.
# 1.0 = perfect rectangle (no distortion). Lower = more distortion.
# If BOTH ratios are above this threshold, skip warp (image is already straight).
# WARNING: Too high (e.g. 0.99) = warps nearly-straight images unnecessarily.
# Too low (e.g. 0.80) = misses moderately angled images.
SKEW_THRESHOLD = 0.95

# Maximum quad area ratio relative to image area.
# If the detected quad covers nearly the entire image (>95%), skip warp.
# This means the paper fills the entire frame and there's no background
# to establish perspective from — the contour is just the image boundary.
MAX_QUAD_AREA_RATIO = 0.95

# Padding factor: how much extra margin to add around the detected quad.
# 0.05 = 5% of quad dimensions on each side. Prevents cutting off labels at edges.
PADDING_FACTOR = 0.05

# Target width for final resize. Height scales proportionally.
TARGET_WIDTH = 1600


class Pipeline:
    def __init__(self, warp_enabled=True, clahe_enabled=False, roi_crop_enabled=False):
        self.warp_enabled = warp_enabled
        self.clahe_enabled = clahe_enabled
        self.roi_crop_enabled = roi_crop_enabled

    def process(self, input_path, output_path):
        """
        Run the full pipeline on a single image.

        Returns metadata dict:
            {
                warped: bool,
                quad_detected: bool,
                original_size: [w, h],
                output_size: [w, h],
                processing_ms: float,
            }
        """
        start = time.time()

        # Step 1: EXIF fix (Pillow)
        pil_img = self._fix_exif(input_path)
        original_size = [pil_img.width, pil_img.height]

        # Convert PIL -> OpenCV (RGB -> BGR)
        cv_img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)

        # Step 2: Contour detection + perspective warp (best-effort)
        warped = False
        quad_detected = False
        if self.warp_enabled:
            cv_img, warped, quad_detected = self._detect_and_warp(cv_img)

        # Step 3 (gated): CLAHE on luminance
        if self.clahe_enabled:
            cv_img = self._apply_clahe(cv_img)

        # Step 4: Resize to stable width
        cv_img = self._resize(cv_img)

        output_size = [cv_img.shape[1], cv_img.shape[0]]

        # Save output
        cv2.imwrite(output_path, cv_img)

        processing_ms = round((time.time() - start) * 1000, 1)

        return {
            "warped": warped,
            "quad_detected": quad_detected,
            "original_size": original_size,
            "output_size": output_size,
            "processing_ms": processing_ms,
        }

    def _fix_exif(self, path):
        """Step 1: Fix EXIF orientation. Returns PIL Image in correct orientation."""
        img = Image.open(path)
        img = ImageOps.exif_transpose(img)
        return img

    def _detect_and_warp(self, img):
        """
        Step 2: Try to find the bill as a quadrilateral and warp it flat.

        Approach:
          1. Otsu threshold — separates white paper from darker background (tile, table)
          2. Morphological close — fills gaps inside the paper (text, chart bars)
          3. Largest contour → convex hull — handles hand occlusion at corners
          4. Aggressive approxPolyDP — simplifies hull to 4 points
          5. Skew check — only warps if significant perspective distortion detected

        Returns (image, warped: bool, quad_detected: bool).
        If no confident quad is found or the image is already straight,
        returns the original image unchanged.
        """
        h, w = img.shape[:2]
        image_area = h * w

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, BLUR_KERNEL, 0)

        # Otsu threshold: automatically finds optimal threshold for bimodal histogram
        # (white paper vs darker background). Works well when bill is against tile/table.
        _, thresh = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

        # Morphological close: fills holes inside the paper region
        # (chart bars, text, fold lines all create gaps in the threshold mask)
        kernel = np.ones((MORPH_KERNEL_SIZE, MORPH_KERNEL_SIZE), np.uint8)
        thresh = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel, iterations=MORPH_ITERATIONS)

        # Find the largest contour (should be the paper)
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            return img, False, False

        contours = sorted(contours, key=cv2.contourArea, reverse=True)
        largest = contours[0]
        contour_area = cv2.contourArea(largest)

        if contour_area < MIN_QUAD_AREA_RATIO * image_area:
            return img, False, False

        # If the paper fills nearly the entire image, there's no background
        # to establish perspective from. The contour is just the image boundary,
        # and tiny pixel differences at the edges create false skew readings.
        if contour_area > MAX_QUAD_AREA_RATIO * image_area:
            return img, False, True

        # Convex hull smooths out hand occlusion at corners.
        # Without this, a hand holding one corner creates a 5+ vertex polygon
        # that can't be simplified to 4 cleanly.
        hull = cv2.convexHull(largest)
        hull_peri = cv2.arcLength(hull, True)

        # Try increasing epsilon values until we get exactly 4 points
        quad = None
        for eps in APPROX_EPSILON_VALUES:
            approx = cv2.approxPolyDP(hull, eps * hull_peri, True)
            if len(approx) == 4:
                quad = approx
                break
            # If we overshot to 3 or fewer, stop trying
            if len(approx) < 4:
                break

        if quad is None:
            return img, False, False

        # Order points: TL, TR, BR, BL
        pts = quad.reshape(4, 2).astype(np.float32)
        pts = self._order_points(pts)

        # Measure perspective distortion by comparing opposite edge lengths.
        # A perfectly flat photo has ratio ~1.0. An angled photo has ratio < 0.9.
        top_w = np.linalg.norm(pts[1] - pts[0])
        bot_w = np.linalg.norm(pts[2] - pts[3])
        left_h = np.linalg.norm(pts[3] - pts[0])
        right_h = np.linalg.norm(pts[2] - pts[1])

        w_ratio = min(top_w, bot_w) / max(top_w, bot_w) if max(top_w, bot_w) > 0 else 1.0
        h_ratio = min(left_h, right_h) / max(left_h, right_h) if max(left_h, right_h) > 0 else 1.0

        # If both ratios are near 1.0, the image is already straight — skip warp.
        # This prevents warping clean images that happen to have a detectable quad.
        if w_ratio >= SKEW_THRESHOLD and h_ratio >= SKEW_THRESHOLD:
            return img, False, True  # quad_detected=True but no warp needed

        # Significant perspective distortion detected — warp it
        padded_pts = self._add_padding(pts, w, h)

        # Destination rectangle: use the longer of each pair of opposite edges
        dst_w = int(max(
            np.linalg.norm(padded_pts[1] - padded_pts[0]),
            np.linalg.norm(padded_pts[2] - padded_pts[3]),
        ))
        dst_h = int(max(
            np.linalg.norm(padded_pts[3] - padded_pts[0]),
            np.linalg.norm(padded_pts[2] - padded_pts[1]),
        ))

        if dst_w < 100 or dst_h < 100:
            return img, False, True

        # Orientation preservation check: if the source image is portrait but the
        # warp output would be landscape (or vice versa), the warp is rotating the
        # image rather than straightening it. This happens when the paper fills most
        # of the frame and small contour errors create a false skew reading.
        src_is_portrait = h > w
        dst_is_portrait = dst_h > dst_w
        if src_is_portrait != dst_is_portrait:
            return img, False, True

        dst_pts = np.array([
            [0, 0],
            [dst_w - 1, 0],
            [dst_w - 1, dst_h - 1],
            [0, dst_h - 1],
        ], dtype=np.float32)

        M = cv2.getPerspectiveTransform(padded_pts, dst_pts)
        warped = cv2.warpPerspective(img, M, (dst_w, dst_h))

        return warped, True, True

    def _order_points(self, pts):
        """
        Order 4 points as: top-left, top-right, bottom-right, bottom-left.
        Uses sum (tl has smallest sum, br has largest) and difference
        (tr has smallest diff, bl has largest).
        """
        ordered = np.zeros((4, 2), dtype=np.float32)
        s = pts.sum(axis=1)
        d = np.diff(pts, axis=1).flatten()

        ordered[0] = pts[np.argmin(s)]   # top-left
        ordered[2] = pts[np.argmax(s)]   # bottom-right
        ordered[1] = pts[np.argmin(d)]   # top-right
        ordered[3] = pts[np.argmax(d)]   # bottom-left

        return ordered

    def _add_padding(self, pts, img_w, img_h):
        """
        Add padding margin around the quad points. Clamp to image boundaries.
        pts must be ordered: TL, TR, BR, BL.
        """
        # Compute quad dimensions for padding calculation
        width = max(
            np.linalg.norm(pts[1] - pts[0]),
            np.linalg.norm(pts[2] - pts[3]),
        )
        height = max(
            np.linalg.norm(pts[3] - pts[0]),
            np.linalg.norm(pts[2] - pts[1]),
        )

        pad_x = width * PADDING_FACTOR
        pad_y = height * PADDING_FACTOR

        # Shift each corner outward
        padded = pts.copy()
        padded[0] += [-pad_x, -pad_y]  # TL: left and up
        padded[1] += [+pad_x, -pad_y]  # TR: right and up
        padded[2] += [+pad_x, +pad_y]  # BR: right and down
        padded[3] += [-pad_x, +pad_y]  # BL: left and down

        # Clamp to image boundaries
        padded[:, 0] = np.clip(padded[:, 0], 0, img_w - 1)
        padded[:, 1] = np.clip(padded[:, 1], 0, img_h - 1)

        return padded

    def _apply_clahe(self, img):
        """Gated step: Apply CLAHE to the luminance channel (LAB color space)."""
        lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        l = clahe.apply(l)
        lab = cv2.merge([l, a, b])
        return cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)

    def _resize(self, img):
        """Step 3: Resize to TARGET_WIDTH, maintaining aspect ratio."""
        h, w = img.shape[:2]
        if w == TARGET_WIDTH:
            return img

        scale = TARGET_WIDTH / w
        new_h = int(h * scale)
        interpolation = cv2.INTER_AREA if scale < 1 else cv2.INTER_LINEAR
        return cv2.resize(img, (TARGET_WIDTH, new_h), interpolation=interpolation)
