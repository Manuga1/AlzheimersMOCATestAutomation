import type { ScoreResult } from '../core/types';

export const TRAIL_SEQUENCE = ['1', 'A', '2', 'B', '3', 'C', '4', 'D', '5', 'E'] as const;

export interface TrailTap {
  target: string;
  t: number;
}

/**
 * MoCA rule: 1 point when the pattern is fully completed with no errors that
 * are not immediately self-corrected. Operationalized digitally: a wrong tap
 * followed directly by the correct next target counts as self-corrected; two
 * wrong taps in a row, or an incomplete pattern, scores 0.
 */
export function scoreTrail(taps: TrailTap[], timedOut = false): ScoreResult {
  const flags: string[] = [];
  let expectedIdx = 0;
  let uncorrectedError = false;
  let errors = 0;
  let prevWasError = false;

  for (const tap of taps) {
    if (tap.target === TRAIL_SEQUENCE[expectedIdx]) {
      expectedIdx++;
      prevWasError = false;
    } else {
      errors++;
      if (prevWasError) uncorrectedError = true;
      prevWasError = true;
    }
  }

  const completed = expectedIdx === TRAIL_SEQUENCE.length;
  if (timedOut) flags.push('timeout');
  if (errors > 0) flags.push('self_corrected_errors');
  const pass = completed && !uncorrectedError && !timedOut;
  return {
    score: pass ? 1 : 0,
    max: 1,
    confidence: 1,
    flags,
    detail: { completed, errors, uncorrectedError },
  };
}
