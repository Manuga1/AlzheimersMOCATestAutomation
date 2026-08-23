import { useState } from 'react';
import type { ItemProps } from '../App';
import { captureSpeech, speechAvailable } from '../core/speechCapture';
import { voiceGuide } from '../core/voiceGuide';
import { matchRecalledWords } from '../scoring/recall';
import { ListeningIndicator, useRunOnce } from './common';

/**
 * Delayed recall (5 points, free recall only). There is deliberately NO word
 * bank or multiple-choice fallback: recognition is a different construct from
 * recall. With unusable speech the item is flagged `not_administered` rather
 * than silently scored zero.
 */
export function RecallItem({ onComplete }: ItemProps): JSX.Element {
  const [listening, setListening] = useState(false);

  useRunOnce(async () => {
    await voiceGuide.speak(
      'Earlier in the test, I read you a list of five words and asked you to remember them. Tell me as many of those words as you can remember now.',
    );
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
    const flags = [...outcome.flags];
    let confidence = outcome.confidence;
    if (
      res.voiceActivityMs !== null &&
      res.voiceActivityMs > 3000 &&
      outcome.recalled.length === 0
    ) {
      // The participant spoke but nothing was transcribed — likely ASR loss.
      flags.push('asr_undercount_suspected');
      confidence = 0.4;
    }
    onComplete({ ...outcome, flags, confidence, response: res.transcripts });
  });

  return (
    <>
      <p className="instruction">Say as many of the five words from earlier as you can remember.</p>
      <ListeningIndicator on={listening} />
    </>
  );
}
