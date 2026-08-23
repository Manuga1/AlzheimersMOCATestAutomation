import { useState } from 'react';
import type { ItemProps } from '../App';
import { captureSpeech, speechAvailable } from '../core/speechCapture';
import { voiceGuide } from '../core/voiceGuide';
import { matchRecalledWords, MEMORY_WORDS } from '../scoring/recall';
import { ListeningIndicator, useRunOnce } from './common';

/**
 * Memory registration: the five words are read at exactly one per second
 * (a pacing guarantee no human examiner can match), two trials per protocol.
 * Immediate recall is captured for clinical context but carries no points;
 * an ASR failure here does not invalidate the scored delayed-recall item.
 */
export function RegistrationItem({ onComplete }: ItemProps): JSX.Element {
  const [listening, setListening] = useState(false);

  useRunOnce(async () => {
    const trials: { transcript: string; recalled: string[] }[] = [];
    await voiceGuide.speak(
      'This is a memory test. I am going to read you a list of five words that you will have to remember now, and later on. Listen carefully.',
    );
    for (let trial = 0; trial < 2; trial++) {
      if (trial === 1) {
        await voiceGuide.speak(
          'I am going to read the same list one more time. Try to remember and tell me as many words as you can, including words you said the first time.',
        );
      }
      await voiceGuide.speakSequence(
        MEMORY_WORDS.map((w) => w.toUpperCase()),
        1000,
      );
      await voiceGuide.speak('Now, tell me as many of those words as you can remember.');
      const res = speechAvailable()
        ? await captureSpeech({ maxMs: 20000, silenceStopMs: 3500, onListening: setListening })
        : { text: '', transcripts: [], alternatives: [], voiceActivityMs: null };
      trials.push({ transcript: res.text, recalled: matchRecalledWords(res.text).recalled });
    }
    await voiceGuide.speak('I will ask you to recall those words again at the end of the test.');
    onComplete({
      score: 0,
      max: 0,
      confidence: 1,
      flags: speechAvailable() ? [] : ['registration_recall_not_captured'],
      detail: { trials },
      response: trials,
    });
  });

  return (
    <>
      <p className="instruction">Listen carefully to the five words, then say back as many as you can.</p>
      <ListeningIndicator on={listening} />
    </>
  );
}
