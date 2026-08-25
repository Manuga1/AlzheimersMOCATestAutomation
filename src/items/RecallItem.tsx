import { useState } from 'react';
import type { ItemProps } from '../App';
import { transcriptContains } from '../core/matchers';
import { captureSpeech, speechAvailable } from '../core/speechCapture';
import { voiceGuide } from '../core/voiceGuide';
import { matchRecalledWords, MEMORY_WORDS } from '../scoring/recall';
import { ListeningIndicator, useRunOnce } from './common';

/** Official MoCA cue sets: category cue, then multiple-choice options. */
export const RECALL_CUES: Record<
  (typeof MEMORY_WORDS)[number],
  { category: string; choices: [string, string, string] }
> = {
  face: { category: 'a part of the body', choices: ['nose', 'face', 'hand'] },
  velvet: { category: 'a type of fabric', choices: ['denim', 'cotton', 'velvet'] },
  church: { category: 'a type of building', choices: ['church', 'school', 'hospital'] },
  daisy: { category: 'a type of flower', choices: ['rose', 'daisy', 'tulip'] },
  red: { category: 'a color', choices: ['red', 'blue', 'green'] },
};

type CueStage = 'free' | 'category' | 'multiple_choice' | 'not_recalled';

/**
 * Delayed recall (5 points, free recall only) followed by the protocol's
 * optional two-stage cues for each word not freely recalled: first the
 * category cue, then spoken multiple choice. Cued recall earns NO points but
 * distinguishes an encoding deficit from a retrieval deficit; the Memory
 * Index Score (free x3 + category x2 + choice x1, max 15) is reported in the
 * detail for the interpreter.
 */
export function RecallItem({ onComplete }: ItemProps): JSX.Element {
  const [listening, setListening] = useState(false);

  useRunOnce(async (alive) => {
    await voiceGuide.speak(
      'Earlier in the test, I read you a list of five words and asked you to remember them. Tell me as many of those words as you can remember now.',
    );
    if (!alive()) return;
    if (!speechAvailable()) {
      onComplete({
        score: 0,
        max: 5,
        confidence: 0.2,
        flags: ['not_administered'],
        detail: { reason: 'speech recognition unavailable' },
      });
      return;
    }
    let res = await captureSpeech({ maxMs: 30000, silenceStopMs: 4000, onListening: setListening });
    if (!res.text) {
      await voiceGuide.speak('Take your time. Say any of the words you remember now.');
      res = await captureSpeech({ maxMs: 20000, silenceStopMs: 4000, onListening: setListening });
    }
    const outcome = matchRecalledWords(res.text);
    const freeRecalled = new Set(outcome.recalled);

    // Two-stage cues (unscored) for each word missed in free recall.
    const stages: Record<string, CueStage> = {};
    const cueTranscripts: Record<string, string[]> = {};
    for (const word of MEMORY_WORDS) {
      if (!alive()) return;
      if (freeRecalled.has(word)) {
        stages[word] = 'free';
        continue;
      }
      const cue = RECALL_CUES[word];
      await voiceGuide.speak(`I will give you a hint. One of the words was ${cue.category}. What was the word?`);
      const catRes = await captureSpeech({ maxMs: 12000, silenceStopMs: 3000, onListening: setListening });
      cueTranscripts[word] = [catRes.text];
      if (transcriptContains(catRes.text, [word], 0.2)) {
        stages[word] = 'category';
        continue;
      }
      await voiceGuide.speak(`Was it ${cue.choices[0]}, ${cue.choices[1]}, or ${cue.choices[2]}?`);
      const mcRes = await captureSpeech({ maxMs: 12000, silenceStopMs: 3000, onListening: setListening });
      cueTranscripts[word].push(mcRes.text);
      stages[word] = transcriptContains(mcRes.text, [word], 0.2) ? 'multiple_choice' : 'not_recalled';
    }

    // Memory Index Score: free x3, category-cued x2, multiple-choice x1.
    const mis = MEMORY_WORDS.reduce((acc, w) => {
      const s = stages[w];
      return acc + (s === 'free' ? 3 : s === 'category' ? 2 : s === 'multiple_choice' ? 1 : 0);
    }, 0);

    const flags = [...outcome.flags];
    let confidence = outcome.confidence;
    if (res.voiceActivityMs !== null && res.voiceActivityMs > 3000 && outcome.recalled.length === 0) {
      // The participant spoke but nothing was transcribed — likely ASR loss.
      flags.push('asr_undercount_suspected');
      confidence = 0.4;
    }
    onComplete({
      ...outcome,
      flags,
      confidence,
      detail: {
        ...outcome.detail,
        cueStages: stages,
        memoryIndexScore: mis,
        memoryIndexMax: 15,
      },
      response: { freeRecall: res.transcripts, cueTranscripts },
    });
  });

  return (
    <>
      <p className="instruction">Say as many of the five words from earlier as you can remember.</p>
      <ListeningIndicator on={listening} />
    </>
  );
}
