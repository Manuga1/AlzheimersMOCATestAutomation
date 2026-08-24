import { allPoints, boundingBox } from '../core/geometry';
import type { Stroke } from '../core/types';

/**
 * Renders captured stylus strokes as an SVG so an interpreter can see exactly
 * what the participant drew (results page, qualitative review).
 */
export function StrokePreview({
  strokes,
  width = 220,
  height = 200,
}: {
  strokes: Stroke[];
  width?: number;
  height?: number;
}): JSX.Element {
  const pts = allPoints(strokes);
  if (!pts.length) {
    return (
      <svg width={width} height={height}>
        <text x="50%" y="50%" textAnchor="middle" fill="#6b7680" fontSize="14">
          (nothing drawn)
        </text>
      </svg>
    );
  }
  const box = boundingBox(pts);
  const pad = Math.max(box.w, box.h) * 0.08 + 4;
  const viewBox = `${box.minX - pad} ${box.minY - pad} ${box.w + 2 * pad} ${box.h + 2 * pad}`;
  // Keep the drawn line visually ~2px regardless of the drawing's scale.
  const strokeWidth = (Math.max(box.w, box.h) + 2 * pad) / 100;
  return (
    <svg width={width} height={height} viewBox={viewBox} preserveAspectRatio="xMidYMid meet">
      {strokes.map((s, i) => (
        <polyline
          key={i}
          points={s.points.map((p) => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke="#23303a"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}
