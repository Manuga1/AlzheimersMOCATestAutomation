import { useRef, useState } from 'react';
import type { ItemProps } from '../App';
import { captureSpeech, speechAvailable } from '../core/speechCapture';
import { voiceGuide } from '../core/voiceGuide';
import { DIGITS_BACKWARD, DIGITS_FORWARD, scoreDigitSpan } from '../scoring/digitSpan';
import { Keypad, ListeningIndicator, useRunOnce } from './common';

export function DigitSpanItem({ onComplete }: ItemProps): JSX.Element {
  const [listening, setListening] = useState(false);
  const [needKeypad, setNeedKeypad] = useState(false);
  const keypadResolver = useRef<((v: string) => void) | null>(null);
  const usedKeypad = useRef(false);

  const awaitKeypad = (): Promise<string> =>
    new Promise((resolve) => {
      keypadResolver.current = resolve;
      setNeedKeypad(true);
    });

  const collect = async (digits: number[], intro: string): Promise<string> => {
    await voiceGuide.speak(intro);
    // Digits are read at exactly one per second; never re-read (protocol).
    await voiceGuide.speakSequence(digits.map(String), 1000);
    if (speechAvailable()) {
      let res = await captureSpeech({ maxMs: 15000, silenceStopMs: 3000, onListening: setListening });
      if (!res.text) {
        await voiceGuide.speak('Please say the numbers now.');
        res = await captureSpeech({ maxMs: 15000, silenceStopMs: 3000, onListening: setListening });
      }
      if (res.text) return res.text;
    }
    await voiceGuide.speak('Please enter the numbers using the keypad, then tap OK.');
    usedKeypad.current = true;
    const typed = await awaitKeypad();
    setNeedKeypad(false);
    return typed;
  };

  useRunOnce(async (alive) => {
    const fwd = await collect(
      DIGITS_FORWARD,
      'I am going to say some numbers. When I am done, repeat them to me exactly as I said them.',
    );
    if (!alive()) return;
    const bwd = await collect(
      DIGITS_BACKWARD,
      'Now I am going to say some more numbers. But this time, when I am done, repeat them to me in the backward order.',
    );
    if (!alive()) return;
    onComplete({
      ...scoreDigitSpan(fwd, bwd, usedKeypad.current),
      response: { forward: fwd, backward: bwd },
    });
  });

  return (
    <>
      <p className="instruction">Listen to the numbers, then repeat them back.</p>
      <ListeningIndicator on={listening} />
      {needKeypad && <Keypad onSubmit={(v) => keypadResolver.current?.(v)} />}
    </>
  );
}
