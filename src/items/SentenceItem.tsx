import { useState } from 'react';
import type { ItemProps } from '../App';
import { captureSpeech, speechAvailable } from '../core/speechCapture';
import { voiceGuide } from '../core/voiceGuide';
import { scoreSentenceRepetition, SENTENCES } from '../scoring/sentence';
import { ListeningIndicator, useRunOnce } from './common';

/**
 * Sentence repetition. Sentences are read once (never repeated, per
 * protocol). There is no typed fallback — typing a sentence would test a
 * different ability — so with no usable speech the item is flagged
 * `not_administered`.
 */
export function SentenceItem({ onComplete }: ItemProps): JSX.Element {
  const [listening, setListening] = useState(false);

  useRunOnce(async (alive) => {
    const responses: { alternatives: string[] }[] = [];
    const flags: string[] = [];
    for (let i = 0; i < SENTENCES.length; i++) {
      if (!alive()) return;
      await voiceGuide.speak(
        i === 0
          ? 'I am going to read you a sentence. Repeat it after me, exactly as I say it.'
          : 'Now I am going to read you another sentence. Repeat it after me, exactly as I say it.',
        alive,
      );
      await voiceGuide.speak(SENTENCES[i], alive);
      if (!speechAvailable()) {
        responses.push({ alternatives: [] });
        continue;
      }
      let res = await captureSpeech({ maxMs: 20000, silenceStopMs: 3000, alive, onListening: setListening });
      if (!res.text && alive()) {
        await voiceGuide.speak('Please repeat the sentence now.', alive);
        res = await captureSpeech({ maxMs: 15000, silenceStopMs: 3000, alive, onListening: setListening });
      }
      responses.push({ alternatives: res.alternatives.flat().length ? res.alternatives.flat() : [res.text] });
    }
    if (!speechAvailable()) flags.push('not_administered');
    const result = scoreSentenceRepetition(responses);
    onComplete({ ...result, flags: [...result.flags, ...flags], response: responses });
  });

  return (
    <>
      <p className="instruction">Listen to each sentence, then repeat it exactly.</p>
      <ListeningIndicator on={listening} />
    </>
  );
}
