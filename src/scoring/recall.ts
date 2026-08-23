import { fuzzyEquals, normalizeText } from '../core/matchers';
import type { ScoreResult } from '../core/types';

export const MEMORY_WORDS = ['face', 'velvet', 'church', 'daisy', 'red'] as const;

/** Homophones and common ASR confusions per target word. */
const ALIASES: Record<string, string[]> = {
  face: ['face', 'faces', 'phase'],
  velvet: ['velvet'],
  church: ['church'],
  daisy: ['daisy', 'daisies'],
  red: ['red', 'read'],
};

export interface RecallOutcome extends ScoreResult {
  recalled: string[];
  intrusions: string[];
}

/**
 * Free-recall matching for registration (unscored) and delayed recall
 * (1 pt/word). Order-independent fuzzy match with homophone aliases.
 */
export function matchRecalledWords(transcript: string): RecallOutcome {
  const words = normalizeText(transcript).split(' ').filter(Boolean);
  const recalled = new Set<string>();
  const intrusions: string[] = [];
  for (const w of words) {
    const hit = MEMORY_WORDS.find((target) =>
      ALIASES[target].some((alias) => fuzzyEquals(w, alias, 0.2)),
    );
    if (hit) recalled.add(hit);
    else if (w.length > 2) intrusions.push(w);
  }
  return {
    score: recalled.size,
    max: 5,
    confidence: 1,
    flags: [],
    detail: { recalled: [...recalled], intrusions },
    recalled: [...recalled],
    intrusions,
  };
}
