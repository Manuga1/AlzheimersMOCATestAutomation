import type { Stroke, StrokePoint } from '../core/types';

/** Build a stroke by sampling straight lines between waypoints. */
export function strokeFromPath(waypoints: [number, number][], ptsPerEdge = 12): Stroke {
  const points: StrokePoint[] = [];
  let t = 0;
  for (let i = 1; i < waypoints.length; i++) {
    const [x1, y1] = waypoints[i - 1];
    const [x2, y2] = waypoints[i];
    for (let s = 0; s < ptsPerEdge; s++) {
      const f = s / (ptsPerEdge - 1);
      points.push({ x: x1 + (x2 - x1) * f, y: y1 + (y2 - y1) * f, t: (t += 8), pressure: 0.5 });
    }
  }
  return { points, pointerType: 'pen' };
}

export function circleStroke(cx: number, cy: number, r: number, n = 120, closeGap = 0): Stroke {
  const points: StrokePoint[] = [];
  const total = 2 * Math.PI - closeGap;
  for (let i = 0; i <= n; i++) {
    const a = (total * i) / n;
    points.push({ x: cx + r * Math.sin(a), y: cy - r * Math.cos(a), t: i * 8, pressure: 0.5 });
  }
  return { points, pointerType: 'pen' };
}

/** Wireframe cube: front square, back square offset, four connectors (12 edges). */
export function wireframeCube(x = 40, y = 60, s = 120, ox = 60, oy = -40): Stroke[] {
  const f: [number, number][] = [
    [x, y],
    [x + s, y],
    [x + s, y + s],
    [x, y + s],
  ];
  const b: [number, number][] = f.map(([px, py]) => [px + ox, py + oy] as [number, number]);
  const strokes: Stroke[] = [];
  for (let i = 0; i < 4; i++) {
    strokes.push(strokeFromPath([f[i], f[(i + 1) % 4]]));
    strokes.push(strokeFromPath([b[i], b[(i + 1) % 4]]));
    strokes.push(strokeFromPath([f[i], b[i]]));
  }
  return strokes;
}

/** Small vertical tick used as a stand-in number glyph on the clock face. */
export function glyphAt(cx: number, cy: number, h = 14): Stroke {
  return strokeFromPath(
    [
      [cx, cy - h / 2],
      [cx, cy + h / 2],
    ],
    6,
  );
}

/** A full synthetic clock: contour, 12 number glyphs, two hands at 11:10. */
export function syntheticClock(opts?: {
  handMinuteAngle?: number;
  handHourAngle?: number;
  omitHands?: boolean;
  omitNumbers?: boolean;
}): Stroke[] {
  const cx = 260;
  const cy = 210;
  const r = 150;
  const strokes: Stroke[] = [circleStroke(cx, cy, r)];
  if (!opts?.omitNumbers) {
    for (let k = 1; k <= 12; k++) {
      const a = ((k % 12) * 30 * Math.PI) / 180;
      strokes.push(glyphAt(cx + 0.78 * r * Math.sin(a), cy - 0.78 * r * Math.cos(a)));
    }
  }
  if (!opts?.omitHands) {
    const minuteA = ((opts?.handMinuteAngle ?? 60) * Math.PI) / 180;
    const hourA = ((opts?.handHourAngle ?? 335) * Math.PI) / 180;
    strokes.push(
      strokeFromPath([
        [cx, cy],
        [cx + 0.62 * r * Math.sin(minuteA), cy - 0.62 * r * Math.cos(minuteA)],
      ]),
      strokeFromPath([
        [cx, cy],
        [cx + 0.38 * r * Math.sin(hourA), cy - 0.38 * r * Math.cos(hourA)],
      ]),
    );
  }
  return strokes;
}
