import { extractDigitSequence } from '../core/matchers';
import type { ScoreResult } from '../core/types';

export const DIGITS_FORWARD = [2, 1, 8, 5, 4];
export const DIGITS_BACKWARD = [7, 4, 2];

/** Forward: repeat in order. Backward: say in reverse order. 1 point each. */
export function scoreDigitSpan(
  forwardTranscript: string,
  backwardTranscript: string,
  usedKeypad: boolean,
): ScoreResult {
  const fwd = extractDigitSequence(forwardTranscript);
  const bwd = extractDigitSequence(backwardTranscript);
  const expectBwd = [...DIGITS_BACKWARD].reverse();
  const fwdOk = sameSeq(fwd, DIGITS_FORWARD);
  const bwdOk = sameSeq(bwd, expectBwd);
  const flags: string[] = [];
  if (usedKeypad) flags.push('keypad_fallback');
  return {
    score: (fwdOk ? 1 : 0) + (bwdOk ? 1 : 0),
    max: 2,
    confidence: 1,
    flags,
    detail: { heardForward: fwd, heardBackward: bwd, fwdOk, bwdOk },
  };
}

function sameSeq(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}
