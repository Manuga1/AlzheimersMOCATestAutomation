import { transcriptContains } from '../core/matchers';
import type { ScoreResult } from '../core/types';

export interface NamingAnimal {
  id: string;
  accepted: string[];
}

export const NAMING_ANIMALS: NamingAnimal[] = [
  { id: 'lion', accepted: ['lion', 'lioness'] },
  { id: 'rhinoceros', accepted: ['rhinoceros', 'rhino'] },
  { id: 'camel', accepted: ['camel', 'dromedary'] },
];

/** 1 point per correctly named animal (speech or flagged typed fallback). */
export function scoreNaming(
  answers: { animalId: string; transcript: string; typed: boolean }[],
): ScoreResult {
  let score = 0;
  const flags: string[] = [];
  const detail: Record<string, unknown> = {};
  for (const animal of NAMING_ANIMALS) {
    const ans = answers.find((a) => a.animalId === animal.id);
    const ok = !!ans && transcriptContains(ans.transcript, animal.accepted);
    detail[animal.id] = { heard: ans?.transcript ?? null, correct: ok };
    if (ok) score++;
    if (ans?.typed) flags.push(`typed_response_${animal.id}`);
    if (!ans || !ans.transcript) flags.push(`no_response_${animal.id}`);
  }
  return { score, max: 3, confidence: 1, flags, detail };
}
