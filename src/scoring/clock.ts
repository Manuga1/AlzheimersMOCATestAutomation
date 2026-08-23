import {
  allPoints,
  angleDiff,
  boundingBox,
  clockAngle,
  clusterStrokes,
  dist,
  fitCircle,
  pathLength,
  rdp,
} from '../core/geometry';
import type { ScoreResult, Stroke } from '../core/types';
import { rasterizeToDigitInput } from './rasterize';

/** Classifies 28x28 glyph images; returns the predicted digit (0-9) per image. */
export type DigitClassifier = (images: Float32Array[]) => Promise<number[]>;

const TARGET_MINUTE_ANGLE = 60; // minute hand pointing at the 2 ("ten past")
const TARGET_HOUR_ANGLE = 335; // 11 o'clock plus 10-minute drift (330 + 5)

/**
 * Clock drawing ("ten past eleven"), 3 points: contour, numbers, hands.
 * Stroke roles are classified by geometry (order-independent), the contour is
 * checked with a least-squares circle fit, number clusters are verified by
 * position and (when the CNN is available) identity, and hands are checked
 * against the target angles with minute > hour length.
 */
export async function scoreClock(
  strokes: Stroke[],
  classifier: DigitClassifier | null,
): Promise<ScoreResult> {
  const flags: string[] = [];
  if (!strokes.length) {
    return { score: 0, max: 3, confidence: 1, flags: ['no_response'], detail: {} };
  }

  const overall = boundingBox(allPoints(strokes));
  const diag = Math.hypot(overall.w, overall.h);

  // --- Contour: the longest closed-ish stroke spanning most of the drawing.
  let contour: Stroke | null = null;
  let contourFit = { cx: overall.cx, cy: overall.cy, r: Math.max(overall.w, overall.h) / 2, rms: Infinity };
  let bestLen = 0;
  for (const s of strokes) {
    if (s.points.length < 8) continue;
    const len = pathLength(s.points);
    const gap = dist(s.points[0], s.points[s.points.length - 1]);
    const box = boundingBox(s.points);
    const spansDrawing = box.w > 0.5 * overall.w && box.h > 0.5 * overall.h;
    if (len > bestLen && gap < 0.3 * len && spansDrawing) {
      const fit = fitCircle(s.points);
      if (fit.r > 0.15 * diag) {
        contour = s;
        contourFit = fit;
        bestLen = len;
      }
    }
  }

  let contourScore = 0;
  if (contour) {
    const gap = dist(contour.points[0], contour.points[contour.points.length - 1]);
    const circumference = 2 * Math.PI * contourFit.r;
    const box = boundingBox(contour.points);
    const aspect = box.w / Math.max(box.h, 1e-6);
    const roundEnough = contourFit.rms < 0.15 * contourFit.r;
    const closedEnough = gap < 0.2 * circumference;
    const notOval = aspect > 0.65 && aspect < 1.55;
    if (roundEnough && closedEnough && notOval) contourScore = 1;
  } else {
    flags.push('no_contour_found');
  }
  const { cx, cy, r } = contourFit;
  const center = { x: cx, y: cy };

  // --- Hands: near-straight strokes with an endpoint near the center.
  const rest = strokes.filter((s) => s !== contour);
  const handStrokes: { stroke: Stroke; outward: number; len: number; innerDist: number }[] = [];
  const numberStrokes: Stroke[] = [];
  for (const s of rest) {
    const simplified = rdp(s.points, 0.04 * r);
    const straight = simplified.length <= 3;
    const p0 = s.points[0];
    const p1 = s.points[s.points.length - 1];
    const d0 = dist(p0, center);
    const d1 = dist(p1, center);
    const inner = Math.min(d0, d1);
    const outer = Math.max(d0, d1);
    const len = pathLength(s.points);
    if (straight && inner < 0.35 * r && outer > 0.25 * r && outer < 1.15 * r && len > 0.2 * r) {
      const tip = d0 > d1 ? p0 : p1;
      handStrokes.push({ stroke: s, outward: clockAngle(center, tip), len, innerDist: inner });
    } else {
      numberStrokes.push(s);
    }
  }

  let handsScore = 0;
  if (handStrokes.length >= 2) {
    const [a, b] = [...handStrokes].sort((x, y) => y.len - x.len);
    const minute = a.len >= b.len ? a : b;
    const hour = minute === a ? b : a;
    const minuteOk = angleDiff(minute.outward, TARGET_MINUTE_ANGLE) <= 16;
    const hourOk = angleDiff(hour.outward, TARGET_HOUR_ANGLE) <= 16;
    const proportionOk = minute.len > hour.len;
    const joined = minute.innerDist < 0.3 * r && hour.innerDist < 0.3 * r;
    if (minuteOk && hourOk && proportionOk && joined) handsScore = 1;
  } else {
    flags.push('hands_not_found');
  }

  // --- Numbers: cluster remaining strokes, verify 12 positions (+identity via CNN).
  const clusters = clusterStrokes(numberStrokes, 0.12 * r);
  const slotOf = new Map<number, { angle: number; err: number; strokes: Stroke[] }>();
  let duplicates = 0;
  for (const cluster of clusters) {
    const box = boundingBox(allPoints(cluster));
    const ang = clockAngle(center, { x: box.cx, y: box.cy });
    let slot = Math.round(ang / 30) % 12;
    if (slot === 0) slot = 12;
    const err = angleDiff(ang, (slot % 12) * 30);
    if (slotOf.has(slot)) duplicates++;
    else slotOf.set(slot, { angle: ang, err, strokes: cluster });
  }
  const positionsOk =
    slotOf.size === 12 && duplicates === 0 && [...slotOf.values()].every((v) => v.err <= 18);

  let numbersScore = 0;
  let identityAgreement: number | null = null;
  let confidence = 1;
  if (positionsOk) {
    if (classifier) {
      const expected: number[] = [];
      const images: Float32Array[] = [];
      for (const [slot, v] of slotOf) {
        for (const { glyph, digit } of splitGlyphs(slot, v.strokes)) {
          images.push(rasterizeToDigitInput(glyph));
          expected.push(digit);
        }
      }
      const preds = await classifier(images);
      const agree = preds.filter((p, i) => p === expected[i]).length;
      identityAgreement = agree / Math.max(expected.length, 1);
      numbersScore = 1;
      if (identityAgreement < 0.7) {
        flags.push('digit_identity_uncertain');
        confidence = Math.min(confidence, 0.5);
      }
    } else {
      numbersScore = 1;
      flags.push('digit_cnn_unavailable');
      confidence = Math.min(confidence, 0.7);
    }
  } else if (numberStrokes.length > 0) {
    flags.push('number_positions_incorrect');
  } else {
    flags.push('no_numbers_found');
  }

  return {
    score: contourScore + numbersScore + handsScore,
    max: 3,
    confidence,
    flags,
    detail: {
      contour: { found: !!contour, rms: contourFit.rms, r, score: contourScore },
      numbers: {
        clusters: clusters.length,
        slotsFilled: slotOf.size,
        duplicates,
        positionsOk,
        identityAgreement,
        score: numbersScore,
      },
      hands: {
        candidates: handStrokes.map((h) => ({ angle: Math.round(h.outward), len: Math.round(h.len) })),
        score: handsScore,
      },
    },
  };
}

/**
 * Split a slot's stroke cluster into per-digit glyphs, left-to-right.
 * Slots 1-9 are single glyphs; 10-12 are two glyphs when strokes separate.
 */
function splitGlyphs(slot: number, strokes: Stroke[]): { glyph: Stroke[]; digit: number }[] {
  const digits = slot <= 9 ? [slot] : [1, slot - 10];
  if (digits.length === 1 || strokes.length < 2) {
    // Two-digit number drawn as one connected blob: classify against the
    // second (dominant-width) digit only as a weak check.
    return [{ glyph: strokes, digit: digits[digits.length - 1] }];
  }
  const sorted = [...strokes].sort(
    (a, b) => boundingBox(a.points).cx - boundingBox(b.points).cx,
  );
  // Partition strokes into two groups by x-midpoint gap.
  const mid = boundingBox(allPoints(sorted)).cx;
  const left = sorted.filter((s) => boundingBox(s.points).cx <= mid);
  const right = sorted.filter((s) => boundingBox(s.points).cx > mid);
  if (!left.length || !right.length) {
    return [{ glyph: strokes, digit: digits[1] }];
  }
  return [
    { glyph: left, digit: digits[0] },
    { glyph: right, digit: digits[1] },
  ];
}
