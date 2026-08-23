import type { ScoreResult } from '../core/types';

/**
 * MoCA serial-7s chaining rule: each of the 5 responses is correct if it is
 * exactly 7 less than the PREVIOUS RESPONSE (first response vs 100), so a
 * single early slip does not cascade. 4-5 correct → 3 pts, 2-3 → 2, 1 → 1.
 */
export function scoreSerial7(responses: (number | null)[], usedKeypad = false): ScoreResult {
  let prev = 100;
  let correct = 0;
  const perStep: boolean[] = [];
  for (const r of responses.slice(0, 5)) {
    const ok = r !== null && r === prev - 7;
    perStep.push(ok);
    if (ok) correct++;
    if (r !== null) prev = r;
  }
  const score = correct >= 4 ? 3 : correct >= 2 ? 2 : correct === 1 ? 1 : 0;
  const flags: string[] = [];
  if (usedKeypad) flags.push('keypad_fallback');
  if (responses.some((r) => r === null)) flags.push('missing_responses');
  return { score, max: 3, confidence: 1, flags, detail: { responses, perStep, correct } };
}
