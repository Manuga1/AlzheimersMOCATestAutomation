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

  // Do the lines all meet, and at the right number of corners? Cluster
  // segment endpoints into junction points: a wireframe cube has ~8 corners
  // and no dangling line ends.
  const { vertices, meetFraction } = junctionStats(segs, 0.07 * diag);
  checks.linesMeet = meetFraction >= 0.85;
  checks.vertexCount = vertices >= 6 && vertices <= 10;

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
    detail: {
      checks,
      segments: segs.length,
      orientationClusters: clusters.length,
      hullVertices: hullSimple.length,
      vertices,
      meetFraction: Math.round(meetFraction * 100) / 100,
    },
  };
}

/**
 * Cluster segment endpoints into junctions. Returns the junction (corner)
 * count and the fraction of endpoints that meet at least one other segment's
 * endpoint — dangling ends lower this.
 */
function junctionStats(segs: Segment[], eps: number): { vertices: number; meetFraction: number } {
  const endpoints: Pt[] = segs.flatMap((s) => [
    { x: s.x1, y: s.y1 },
    { x: s.x2, y: s.y2 },
  ]);
  const n = endpoints.length;
  if (!n) return { vertices: 0, meetFraction: 0 };
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (Math.hypot(endpoints[i].x - endpoints[j].x, endpoints[i].y - endpoints[j].y) <= eps) {
        parent[find(i)] = find(j);
      }
    }
  }
  const sizes = new Map<number, number>();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    sizes.set(r, (sizes.get(r) ?? 0) + 1);
  }
  let met = 0;
  for (const size of sizes.values()) if (size >= 2) met += size;
  return { vertices: sizes.size, meetFraction: met / n };
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
