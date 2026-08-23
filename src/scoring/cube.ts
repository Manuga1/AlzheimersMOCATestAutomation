import {
  allPoints,
  boundingBox,
  clusterOrientations,
  convexHull,
  distToPolygonBoundary,
  pointInPolygon,
  rdp,
  segmentsFromStroke,
  type Pt,
  type Segment,
} from '../core/geometry';
import type { ScoreResult, Stroke } from '../core/types';

/**
 * Cube copy, 1 point. MoCA criteria: drawing is three-dimensional, all lines
 * present, no extra lines, lines roughly parallel with similar lengths.
 * Heuristic operationalization:
 *  - 8-16 line segments after corner splitting (wireframe 12, solid-face 9)
 *  - 3 dominant orientation families covering most of the ink (3D parallelism)
 *  - similar lengths within each family
 *  - roughly hexagonal outer silhouette
 *  - an interior junction where edges from 3 different families meet
 * Failing exactly one check lands in an uncertain band → review flag.
 */
export function scoreCube(strokes: Stroke[]): ScoreResult {
  if (!strokes.length) {
    return { score: 0, max: 1, confidence: 1, flags: ['no_response'], detail: {} };
  }
  const pts = allPoints(strokes);
  const box = boundingBox(pts);
  const diag = Math.hypot(box.w, box.h);

  const segs: Segment[] = strokes
    .flatMap((s) => segmentsFromStroke(s, 0.03 * diag))
    .filter((s) => s.len > 0.08 * diag);

  const checks: Record<string, boolean> = {};
  checks.segmentCount = segs.length >= 8 && segs.length <= 16;

  const clusters = clusterOrientations(segs, 22);
  const top3 = clusters.slice(0, 3);
  const totalLen = segs.reduce((a, s) => a + s.len, 0);
  const top3Len = top3.reduce((a, c) => a + c.totalLen, 0);
  checks.threeDirections = clusters.length >= 3 && top3Len >= 0.75 * totalLen;

  checks.similarLengths = top3.every((c) => {
    const lens = c.segs.map((s) => s.len);
    return Math.max(...lens) / Math.min(...lens) <= 3;
  });

  const hull = convexHull(pts);
  const hullSimple = rdp([...hull, hull[0]], 0.04 * diag).slice(0, -1);
  checks.hexSilhouette = hullSimple.length >= 5 && hullSimple.length <= 7;

  checks.interiorJunction = hasInteriorJunction(segs, top3, hull, diag);

  const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([k]) => k);
  const flags: string[] = [];
  let confidence = 1;
  if (failed.length === 1) {
    flags.push('borderline_cube', `failed_${failed[0]}`);
    confidence = 0.4;
  }
  return {
    score: failed.length === 0 ? 1 : 0,
    max: 1,
    confidence,
    flags,
    detail: { checks, segments: segs.length, orientationClusters: clusters.length, hullVertices: hullSimple.length },
  };
}

function hasInteriorJunction(
  segs: Segment[],
  clusters: { segs: Segment[] }[],
  hull: Pt[],
  diag: number,
): boolean {
  const eps = 0.07 * diag;
  const clusterIdx = (seg: Segment): number => clusters.findIndex((c) => c.segs.includes(seg));
  const endpoints: { p: Pt; cluster: number }[] = [];
  for (const seg of segs) {
    const c = clusterIdx(seg);
    if (c < 0) continue;
    endpoints.push({ p: { x: seg.x1, y: seg.y1 }, cluster: c });
    endpoints.push({ p: { x: seg.x2, y: seg.y2 }, cluster: c });
  }
  for (const e of endpoints) {
    const families = new Set<number>();
    for (const other of endpoints) {
      if (Math.hypot(e.p.x - other.p.x, e.p.y - other.p.y) <= eps) families.add(other.cluster);
    }
    if (families.size >= 3) {
      const interior = pointInPolygon(e.p, hull) && distToPolygonBoundary(e.p, hull) > 0.06 * diag;
      if (interior) return true;
    }
  }
  return false;
}
