import type { ScoreResult } from '../core/types';

export const VIGILANCE_LETTERS = 'FBACMNAAJKLBAFAKDEAAAJAMOFAAB'.split('');

export interface LetterOnset {
  letter: string;
  t: number;
}

export const VIGILANCE_WINDOW_MS = 1400;

/**
 * Deterministic scoring from the audio timeline: a tap within
 * [onset, onset + windowMs] of an "A" is a hit (nearest-onset assignment);
 * any unassigned tap is a false positive; each missed A is an omission.
 * MoCA: 1 point if total errors (misses + false taps) ≤ 1.
 */
export function scoreVigilance(
  onsets: LetterOnset[],
  taps: number[],
  windowMs = VIGILANCE_WINDOW_MS,
): ScoreResult {
  const aOnsets = onsets.filter((o) => o.letter === 'A').map((o) => o.t);
  const assigned = new Set<number>();
  const earlyMargin = windowMs / 10;
  let falseTaps = 0;

  for (const tap of [...taps].sort((a, b) => a - b)) {
    let best = -1;
    let bestDelta = Infinity;
    for (let i = 0; i < aOnsets.length; i++) {
      if (assigned.has(i)) continue;
      const delta = tap - aOnsets[i];
      if (delta >= -earlyMargin && delta <= windowMs && Math.abs(delta) < bestDelta) {
        best = i;
        bestDelta = Math.abs(delta);
      }
    }
    if (best >= 0) assigned.add(best);
    else falseTaps++;
  }

  const misses = aOnsets.length - assigned.size;
  const errors = misses + falseTaps;
  return {
    score: errors <= 1 ? 1 : 0,
    max: 1,
    confidence: 1,
    flags: [],
    detail: { targets: aOnsets.length, hits: assigned.size, misses, falseTaps, errors },
  };
}
