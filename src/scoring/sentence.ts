import { normalizeText } from '../core/matchers';
import type { ScoreResult } from '../core/types';

export const SENTENCES = [
  'I only know that John is the one to help today',
  'The cat always hid under the couch when dogs were in the room',
] as const;

/**
 * Exact repetition required by protocol. Because the speech recognizer itself
 * introduces errors, the transcript's alternatives are all checked; a >=90%
 * token overlap that is not exact scores the point but is flagged
 * `asr_ambiguous` for review (fail-safe toward review, not impairment).
 */
export function scoreSentenceRepetition(
  responses: { alternatives: string[] }[],
): ScoreResult {
  let score = 0;
  const flags: string[] = [];
  const detail: Record<string, unknown>[] = [];
  SENTENCES.forEach((target, i) => {
    const alts = responses[i]?.alternatives ?? [];
    const targetTokens = normalizeText(target).split(' ');
    let exact = false;
    let bestOverlap = 0;
    let best = '';
    for (const alt of alts) {
      const tokens = normalizeText(alt).split(' ').filter(Boolean);
      if (tokens.join(' ') === targetTokens.join(' ')) {
        exact = true;
        best = alt;
        break;
      }
      const overlap = tokenOverlap(tokens, targetTokens);
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        best = alt;
      }
    }
    if (exact) {
      score++;
    } else if (bestOverlap >= 0.9) {
      score++;
      flags.push(`asr_ambiguous_sentence_${i + 1}`);
    }
    detail.push({ target, heard: best, exact, overlap: exact ? 1 : bestOverlap });
  });
  return {
    score,
    max: 2,
    confidence: flags.length ? 0.5 : 1,
    flags,
    detail: { sentences: detail },
  };
}

function tokenOverlap(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  // Order-sensitive overlap via longest common subsequence.
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[m][n] / Math.max(m, n);
}
