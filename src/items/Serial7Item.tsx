import { useRef, useState } from 'react';
import type { ItemProps } from '../App';
import { extractNumbers } from '../core/matchers';
import { captureSpeech, speechAvailable } from '../core/speechCapture';
import { voiceGuide } from '../core/voiceGuide';
import { scoreSerial7 } from '../scoring/serial7';
import { Keypad, ListeningIndicator, useRunOnce } from './common';

export function Serial7Item({ onComplete }: ItemProps): JSX.Element {
  const [listening, setListening] = useState(false);
  const [needKeypad, setNeedKeypad] = useState(false);
  const [step, setStep] = useState(0);
  const keypadResolver = useRef<((v: string) => void) | null>(null);
  const usedKeypad = useRef(false);

  const awaitKeypad = (): Promise<string> =>
    new Promise((resolve) => {
      keypadResolver.current = resolve;
      setNeedKeypad(true);
    });

  const oneResponse = async (i: number): Promise<number | null> => {
    setStep(i);
    if (speechAvailable()) {
      const res = await captureSpeech({ maxMs: 15000, silenceStopMs: 3000, onListening: setListening });
      const nums = extractNumbers(res.text);
      if (nums.length) return nums[nums.length - 1];
      if (i === 0) {
        // One protocol-permitted reminder, then keep listening.
        await voiceGuide.speak('Say your answer out loud, please.');
        const retry = await captureSpeech({ maxMs: 12000, silenceStopMs: 3000, onListening: setListening });
        const retryNums = extractNumbers(retry.text);
        if (retryNums.length) return retryNums[retryNums.length - 1];
      }
    }
    usedKeypad.current = true;
    if (!needKeypad) await voiceGuide.speak('Enter your answer with the keypad, then tap OK.');
    const typed = await awaitKeypad();
    setNeedKeypad(false);
    return typed ? parseInt(typed, 10) : null;
  };

  useRunOnce(async () => {
    await voiceGuide.speak(
      'Now, I will ask you to count by subtracting seven from one hundred. Then keep subtracting seven from your answer until I tell you to stop. What is one hundred minus seven?',
    );
    const responses: (number | null)[] = [];
    for (let i = 0; i < 5; i++) {
      responses.push(await oneResponse(i));
      if (i < 4) await voiceGuide.speak('And seven less than that?');
    }
    onComplete({ ...scoreSerial7(responses, usedKeypad.current), response: responses });
  });

  return (
    <>
      <p className="instruction">Keep subtracting 7, starting from 100. Say each answer out loud.</p>
      <p className="progress">Answer {Math.min(step + 1, 5)} of 5</p>
      <ListeningIndicator on={listening} />
      {needKeypad && <Keypad onSubmit={(v) => keypadResolver.current?.(v)} />}
    </>
  );
}
