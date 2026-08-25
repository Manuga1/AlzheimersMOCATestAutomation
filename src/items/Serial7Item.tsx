import { useState } from 'react';
import type { ItemProps } from '../App';
import { extractNumbers } from '../core/matchers';
import { captureSpeech, speechAvailable } from '../core/speechCapture';
import { voiceGuide } from '../core/voiceGuide';
import { scoreSerial7 } from '../scoring/serial7';
import { ListeningIndicator, useRunOnce } from './common';

/**
 * Serial 7s: a single instruction, then ONE open listening window in which
 * the participant says all five numbers in progression (per PI: no per-step
 * prompting, no keypad — the response must be spoken). Numbers are parsed
 * from the running transcript in order; the window closes once five numbers
 * are heard or on sustained silence.
 */
export function Serial7Item({ onComplete }: ItemProps): JSX.Element {
  const [listening, setListening] = useState(false);

  useRunOnce(async () => {
    await voiceGuide.speak(
      'Now, I will ask you to count by subtracting seven from one hundred, and then, keep subtracting seven from your answer until I tell you to stop. Say each number out loud. Begin now: what is one hundred minus seven?',
    );
    if (!speechAvailable()) {
      onComplete({
        score: 0,
        max: 3,
        confidence: 0.2,
        flags: ['not_administered'],
        detail: { reason: 'speech recognition unavailable' },
      });
      return;
    }
    const res = await captureSpeech({
      maxMs: 90000,
      silenceStopMs: 12000,
      stopWhen: (text) => extractNumbers(text).length >= 5,
      onListening: setListening,
    });
    const numbers = extractNumbers(res.text).slice(0, 5);
    await voiceGuide.speak('Stop. Well done.');
    const responses: (number | null)[] = Array.from({ length: 5 }, (_, i) => numbers[i] ?? null);
    onComplete({ ...scoreSerial7(responses, false), response: { transcript: res.text, numbers } });
  });

  return (
    <>
      <p className="instruction">Keep subtracting 7, starting from 100. Say each answer out loud.</p>
      <ListeningIndicator on={listening} />
    </>
  );
}
