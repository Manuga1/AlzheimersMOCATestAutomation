import type { Stroke, StrokePoint } from './types';

export interface Pt {
  x: number;
  y: number;
}

export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Orientation in degrees, normalized to [0, 180). */
  angle: number;
  len: number;
}

export interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  cx: number;
  cy: number;
  w: number;
  h: number;
}

export const dist = (a: Pt, b: Pt): number => Math.hypot(a.x - b.x, a.y - b.y);

export function pathLength(points: Pt[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) len += dist(points[i - 1], points[i]);
  return len;
}

export function boundingBox(points: Pt[]): BBox {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, w: maxX - minX, h: maxY - minY };
}

export function allPoints(strokes: Stroke[]): StrokePoint[] {
  return strokes.flatMap((s) => s.points);
}

/** Perpendicular distance from p to line (a,b). */
function perpDist(p: Pt, a: Pt, b: Pt): number {
  const d = dist(a, b);
  if (d < 1e-9) return dist(p, a);
  return Math.abs((b.x - a.x) * (a.y - p.y) - (a.x - p.x) * (b.y - a.y)) / d;
}

/** Ramer–Douglas–Peucker polyline simplification. */
export function rdp<T extends Pt>(points: T[], epsilon: number): T[] {
  if (points.length < 3) return points.slice();
  let maxD = 0;
  let idx = 0;
  const a = points[0];
  const b = points[points.length - 1];
  for (let i = 1; i < points.length - 1; i++) {
    const d = perpDist(points[i], a, b);
    if (d > maxD) {
      maxD = d;
      idx = i;
    }
  }
  if (maxD <= epsilon) return [a, b];
  const left = rdp(points.slice(0, idx + 1), epsilon);
  const right = rdp(points.slice(idx), epsilon);
  return left.slice(0, -1).concat(right);
}

/** Split a stroke into straight line segments at RDP corners. */
export function segmentsFromStroke(stroke: Stroke, epsilon: number): Segment[] {
  const simplified = rdp(stroke.points, epsilon);
  const segs: Segment[] = [];
  for (let i = 1; i < simplified.length; i++) {
    const p = simplified[i - 1];
    const q = simplified[i];
    const len = dist(p, q);
    if (len < 1e-6) continue;
    let angle = (Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI;
    angle = ((angle % 180) + 180) % 180;
    segs.push({ x1: p.x, y1: p.y, x2: q.x, y2: q.y, angle, len });
  }
  return segs;
}

/** Kåsa least-squares circle fit. Returns center, radius, and radial RMS error. */
export function fitCircle(points: Pt[]): { cx: number; cy: number; r: number; rms: number } {
  const n = points.length;
  if (n < 3) return { cx: 0, cy: 0, r: 0, rms: Infinity };
  let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, sxz = 0, syz = 0, sz = 0;
  for (const p of points) {
    const z = p.x * p.x + p.y * p.y;
    sx += p.x; sy += p.y; sxx += p.x * p.x; syy += p.y * p.y;
    sxy += p.x * p.y; sxz += p.x * z; syz += p.y * z; sz += z;
  }
  // Solve [2sxx 2sxy sx; 2sxy 2syy sy; 2sx 2sy n] [a b c]^T = [sxz syz sz]
  const A = [
    [2 * sxx, 2 * sxy, sx],
    [2 * sxy, 2 * syy, sy],
    [2 * sx, 2 * sy, n],
  ];
  const B = [sxz, syz, sz];
  const sol = solve3(A, B);
  if (!sol) return { cx: 0, cy: 0, r: 0, rms: Infinity };
  const [a, b, c] = sol;
  const r = Math.sqrt(Math.max(0, c + a * a + b * b));
  let sq = 0;
  for (const p of points) {
    const d = Math.hypot(p.x - a, p.y - b) - r;
    sq += d * d;
  }
  return { cx: a, cy: b, r, rms: Math.sqrt(sq / n) };
}

function solve3(A: number[][], B: number[]): [number, number, number] | null {
  const m = A.map((row, i) => [...row, B[i]]);
  for (let col = 0; col < 3; col++) {
    let piv = col;
    for (let r = col + 1; r < 3; r++) if (Math.abs(m[r][col]) > Math.abs(m[piv][col])) piv = r;
    if (Math.abs(m[piv][col]) < 1e-12) return null;
    [m[col], m[piv]] = [m[piv], m[col]];
    for (let r = 0; r < 3; r++) {
      if (r === col) continue;
      const f = m[r][col] / m[col][col];
      for (let c = col; c < 4; c++) m[r][c] -= f * m[col][c];
    }
  }
  return [m[0][3] / m[0][0], m[1][3] / m[1][1], m[2][3] / m[2][2]];
}

/** Smallest absolute difference between two orientations in [0,180), degrees. */
export function orientationDiff(a: number, b: number): number {
  const d = Math.abs(a - b) % 180;
  return Math.min(d, 180 - d);
}

/** Smallest absolute difference between two full angles in [0,360), degrees. */
export function angleDiff(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
}

/**
 * Clock-face angle of point p as seen from center c: 0° = 12 o'clock (up),
 * increasing clockwise, in [0, 360). Screen coordinates (y grows downward).
 */
export function clockAngle(c: Pt, p: Pt): number {
  const deg = (Math.atan2(p.x - c.x, -(p.y - c.y)) * 180) / Math.PI;
  return (deg + 360) % 360;
}

/** Greedy single-linkage clustering of strokes by bounding-box gap. */
export function clusterStrokes(strokes: Stroke[], eps: number): Stroke[][] {
  const n = strokes.length;
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const boxes = strokes.map((s) => boundingBox(s.points));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (bboxGap(boxes[i], boxes[j]) <= eps) parent[find(i)] = find(j);
    }
  }
  const groups = new Map<number, Stroke[]>();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(strokes[i]);
  }
  return [...groups.values()];
}

function bboxGap(a: BBox, b: BBox): number {
  const dx = Math.max(0, Math.max(a.minX, b.minX) - Math.min(a.maxX, b.maxX));
  const dy = Math.max(0, Math.max(a.minY, b.minY) - Math.min(a.maxY, b.maxY));
  return Math.hypot(dx, dy);
}

/** Monotone-chain convex hull. */
export function convexHull(points: Pt[]): Pt[] {
  const pts = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  if (pts.length < 3) return pts;
  const cross = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Pt[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Pt[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

export function pointInPolygon(p: Pt, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

/** Distance from p to the boundary of polygon poly. */
export function distToPolygonBoundary(p: Pt, poly: Pt[]): number {
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const len2 = abx * abx + aby * aby;
    const t = len2 < 1e-12 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2));
    best = Math.min(best, Math.hypot(p.x - (a.x + t * abx), p.y - (a.y + t * aby)));
  }
  return best;
}

/** Cluster segment orientations (mod 180°) greedily; returns clusters sorted by total length desc. */
export function clusterOrientations(
  segs: Segment[],
  mergeDeg: number,
): { angle: number; segs: Segment[]; totalLen: number }[] {
  const clusters: { angle: number; segs: Segment[]; totalLen: number }[] = [];
  for (const seg of [...segs].sort((a, b) => b.len - a.len)) {
    const c = clusters.find((cl) => orientationDiff(cl.angle, seg.angle) <= mergeDeg);
    if (c) {
      // Weighted circular-ish mean over [0,180): rotate into the cluster frame.
      const w = seg.len / (c.totalLen + seg.len);
      let delta = seg.angle - c.angle;
      if (delta > 90) delta -= 180;
      if (delta < -90) delta += 180;
      c.angle = (((c.angle + delta * w) % 180) + 180) % 180;
      c.segs.push(seg);
      c.totalLen += seg.len;
    } else {
      clusters.push({ angle: seg.angle, segs: [seg], totalLen: seg.len });
    }
  }
  return clusters.sort((a, b) => b.totalLen - a.totalLen);
}
