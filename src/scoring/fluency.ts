import { crudeStem, normalizeText } from '../core/matchers';
import type { ScoreResult } from '../core/types';

/** Common first names / places beginning with F (proper nouns are excluded). */
const PROPER_NOUN_BLOCKLIST = new Set([
  'frank', 'fred', 'freddie', 'freddy', 'frederick', 'fiona', 'felix', 'faith',
  'florence', 'frances', 'francis', 'francisco', 'france', 'florida', 'finland',
  'friday', 'february', 'fresno', 'fargo', 'frankfurt', 'fiji', 'fatima', 'felipe',
]);

/**
 * Verbal fluency, letter F: ≥11 valid words in 60 s → 1 point.
 * Valid: starts with F, not a proper noun, not a number, distinct stem.
 * If voice activity was detected but the transcript is implausibly short,
 * the item is flagged for review instead of silently failing the user.
 */
export function scoreFluency(
  transcripts: string[],
  voiceActivityMs: number | null = null,
): ScoreResult {
  const seen = new Set<string>();
  const valid: string[] = [];
  const rejected: string[] = [];
  for (const t of transcripts) {
    for (const raw of normalizeText(t).split(' ')) {
      if (!raw || raw.length < 2) continue;
      if (!raw.startsWith('f')) continue;
      if (PROPER_NOUN_BLOCKLIST.has(raw)) {
        rejected.push(raw);
        continue;
      }
      if (/\d/.test(raw)) continue;
      const stem = crudeStem(raw);
      if (seen.has(stem)) {
        rejected.push(raw);
        continue;
      }
      seen.add(stem);
      valid.push(raw);
    }
  }
  const flags: string[] = [];
  let confidence = 1;
  if (voiceActivityMs !== null && voiceActivityMs > 10000 && valid.length < 11) {
    flags.push('asr_undercount_suspected');
    confidence = 0.4;
  }
  return {
    score: valid.length >= 11 ? 1 : 0,
    max: 1,
    confidence,
    flags,
    detail: { validWords: valid, rejected, count: valid.length },
  };
}
