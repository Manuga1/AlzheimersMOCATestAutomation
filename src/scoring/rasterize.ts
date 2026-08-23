import { allPoints, boundingBox } from '../core/geometry';
import type { Stroke } from '../core/types';

/**
 * Rasterize a group of strokes to a 28x28 MNIST-style grayscale image:
 * ink = 1, background = 0, glyph scaled to a 20px box and centered.
 * Returned as Float32Array(784) row-major, ready for the digit CNN.
 */
export function rasterizeToDigitInput(strokes: Stroke[], size = 28, glyphBox = 20): Float32Array {
  const img = new Float32Array(size * size);
  const pts = allPoints(strokes);
  if (!pts.length) return img;
  const box = boundingBox(pts);
  const span = Math.max(box.w, box.h, 1e-6);
  const scale = glyphBox / span;
  const offX = (size - box.w * scale) / 2;
  const offY = (size - box.h * scale) / 2;

  const stamp = (fx: number, fy: number) => {
    // 2px-radius soft stamp approximates MNIST stroke thickness.
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const x = Math.round(fx) + dx;
        const y = Math.round(fy) + dy;
        if (x < 0 || y < 0 || x >= size || y >= size) continue;
        const d = Math.hypot(fx - x, fy - y);
        const v = Math.max(0, 1 - d / 2);
        const idx = y * size + x;
        if (v > img[idx]) img[idx] = v;
      }
    }
  };

  for (const stroke of strokes) {
    for (let i = 0; i < stroke.points.length; i++) {
      const p = stroke.points[i];
      const fx = (p.x - box.minX) * scale + offX;
      const fy = (p.y - box.minY) * scale + offY;
      stamp(fx, fy);
      if (i > 0) {
        const q = stroke.points[i - 1];
        const qx = (q.x - box.minX) * scale + offX;
        const qy = (q.y - box.minY) * scale + offY;
        const steps = Math.ceil(Math.hypot(fx - qx, fy - qy));
        for (let s = 1; s < steps; s++) {
          stamp(qx + ((fx - qx) * s) / steps, qy + ((fy - qy) * s) / steps);
        }
      }
    }
  }
  return img;
}
