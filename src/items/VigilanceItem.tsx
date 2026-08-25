import { useRef, useState } from 'react';
import type { ItemProps } from '../App';
import { voiceGuide } from '../core/voiceGuide';
import {
  scoreVigilance,
  VIGILANCE_LETTERS,
  VIGILANCE_WINDOW_MS,
  type LetterOnset,
} from '../scoring/vigilance';
import { useRunOnce } from './common';

/**
 * Vigilance: the app reads a letter sequence at one per second; the
 * participant taps the target whenever they hear "A". Letter onsets come from
 * the voice guide's timeline, so scoring is fully deterministic.
 */
export function VigilanceItem({ onComplete }: ItemProps): JSX.Element {
  const [active, setActive] = useState(false);
  const onsetsRef = useRef<LetterOnset[]>([]);
  const tapsRef = useRef<number[]>([]);
  const lastTapRef = useRef(0);

  useRunOnce(async () => {
    await voiceGuide.speak(
      'I am going to read a list of letters. Every time I say the letter A, tap the large button once. If I say a different letter, do not tap.',
    );
    setActive(true);
    await voiceGuide.speakSequence(VIGILANCE_LETTERS, 1000, (letter, t) => {
      onsetsRef.current.push({ letter, t });
    });
    // Grace period so a tap on the final A still lands in its window.
    const scale = window.__ttsTimeScale ?? 1;
    await new Promise((r) => setTimeout(r, 1200 * scale));
    setActive(false);
    onComplete({
      ...scoreVigilance(onsetsRef.current, tapsRef.current, VIGILANCE_WINDOW_MS * scale),
      response: { onsets: onsetsRef.current, taps: tapsRef.current },
    });
  });

  const tap = () => {
    const now = performance.now();
    const debounce = 250 * (window.__ttsTimeScale ?? 1);
    if (now - lastTapRef.current < debounce) return; // debounce resting fingers
    lastTapRef.current = now;
    tapsRef.current.push(now);
  };

  // No on-screen instructions or letter display (PI requirement): the task is
  // purely auditory — showing the target letter or instructions would let the
  // patient read instead of listen.
  return (
    <>
      <button
        className="tap-target"
        aria-label="tap target"
        data-testid="vigilance-tap"
        onPointerDown={tap}
        disabled={!active}
      >
        👆
      </button>
    </>
  );
}
