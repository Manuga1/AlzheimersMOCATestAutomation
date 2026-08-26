import { useState } from 'react';
import type { ItemProps } from '../App';
import { captureSpeech, speechAvailable } from '../core/speechCapture';
import { voiceGuide } from '../core/voiceGuide';
import { scoreFluency } from '../scoring/fluency';
import { ListeningIndicator, useRunOnce } from './common';

const WINDOW_MS = 60000;

/**
 * Verbal fluency (letter F, 60 seconds). No visible countdown — the paper
 * test shows none and time pressure could alter performance; a subtle
 * progress arc communicates that the task is running.
 */
export function FluencyItem({ onComplete }: ItemProps): JSX.Element {
  const [listening, setListening] = useState(false);
  const [running, setRunning] = useState(false);

  useRunOnce(async (alive) => {
    await voiceGuide.speak(
      'Tell me as many words as you can think of that begin with the letter F. Proper nouns like names of people or places do not count, and numbers do not count. You will have one minute. Ready? Begin.',
      alive,
    );
    if (!alive()) return;
    if (!speechAvailable()) {
      onComplete({
        score: 0,
        max: 1,
        confidence: 0.3,
        flags: ['not_administered'],
        detail: { reason: 'speech recognition unavailable' },
      });
      return;
    }
    setRunning(true);
    const res = await captureSpeech({
      maxMs: WINDOW_MS * (window.__ttsTimeScale ?? 1),
      alive,
      onListening: setListening,
    });
    setRunning(false);
    if (!alive()) return;
    await voiceGuide.speak('Time is up. Well done.', alive);
    onComplete({
      ...scoreFluency(res.transcripts.length ? res.transcripts : [res.text], res.voiceActivityMs),
      response: res.transcripts,
    });
  });

  return (
    <>
      <p className="instruction">Say as many words starting with “F” as you can. Keep going until I say stop.</p>
      {running && <p className="progress">Task in progress…</p>}
      <ListeningIndicator on={listening} />
    </>
  );
}
