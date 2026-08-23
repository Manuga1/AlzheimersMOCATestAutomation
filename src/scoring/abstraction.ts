import { transcriptContains } from '../core/matchers';
import type { ScoreResult } from '../core/types';

interface AbstractionPair {
  id: string;
  prompt: [string, string];
  accepted: string[];
  rejected: string[];
}

export const ABSTRACTION_PAIRS: AbstractionPair[] = [
  {
    id: 'train-bicycle',
    prompt: ['a train', 'a bicycle'],
    accepted: [
      'transportation', 'transport', 'travel', 'traveling', 'vehicles', 'vehicle',
      'means of transportation', 'ways to travel', 'take trips', 'get around',
      'means of travel', 'move people',
    ],
    rejected: ['wheels', 'they have wheels', 'fast', 'metal'],
  },
  {
    id: 'watch-ruler',
    prompt: ['a watch', 'a ruler'],
    accepted: [
      'measure', 'measuring', 'measurement', 'measuring instruments',
      'measuring devices', 'used to measure', 'they measure', 'instruments',
    ],
    rejected: ['numbers', 'they have numbers', 'hands', 'straight'],
  },
];

/**
 * 1 point per pair for an abstract-category answer. Answers matching neither
 * list are provisionally 0 and flagged `unlisted_answer` for human review.
 */
export function scoreAbstraction(
  answers: { pairId: string; transcript: string }[],
): ScoreResult {
  let score = 0;
  const flags: string[] = [];
  const detail: Record<string, unknown> = {};
  let confidence = 1;
  for (const pair of ABSTRACTION_PAIRS) {
    const ans = answers.find((a) => a.pairId === pair.id)?.transcript ?? '';
    const accepted = transcriptContains(ans, pair.accepted, 0.2);
    const rejected = transcriptContains(ans, pair.rejected, 0.15);
    if (accepted && !rejected) {
      score++;
    } else if (ans && !accepted && !rejected) {
      flags.push(`unlisted_answer_${pair.id}`);
      confidence = Math.min(confidence, 0.5);
    }
    detail[pair.id] = { heard: ans, accepted, rejected };
  }
  return { score, max: 2, confidence, flags, detail };
}
