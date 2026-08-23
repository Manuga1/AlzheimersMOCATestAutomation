import { useContext, useRef, useState } from 'react';
import type { ItemProps } from '../App';
import { ConfigContext } from '../configContext';
import { speechAvailable } from '../core/speechCapture';
import { scoreOrientation, type OrientationAnswers } from '../scoring/orientation';
import { askSpoken, ListeningIndicator, TypedInput, useRunOnce } from './common';

const QUESTIONS: { key: keyof OrientationAnswers; prompt: string; typedPlaceholder: string }[] = [
  { key: 'date', prompt: 'Tell me the date today. What day of the month is it?', typedPlaceholder: 'Day of the month (e.g. 23)' },
  { key: 'month', prompt: 'What month is it?', typedPlaceholder: 'Month' },
  { key: 'year', prompt: 'What year is it?', typedPlaceholder: 'Year' },
  { key: 'day', prompt: 'What day of the week is it?', typedPlaceholder: 'Day of the week' },
  { key: 'place', prompt: 'Tell me the name of this place. Where are you right now?', typedPlaceholder: 'Name of this place' },
  { key: 'city', prompt: 'Which city are you in?', typedPlaceholder: 'City' },
];

/**
 * Orientation. Date, month, year, and day are verified against the device
 * clock. Place and city are checked against the caregiver-configured expected
 * values; free typing (never a picker — visible options would cue the answer).
 */
export function OrientationItem({ onComplete }: ItemProps): JSX.Element {
  const config = useContext(ConfigContext);
  const [listening, setListening] = useState(false);
  const [needTyped, setNeedTyped] = useState<string | null>(null);
  const typedResolver = useRef<((v: string) => void) | null>(null);

  const awaitTyped = (placeholder: string): Promise<string> =>
    new Promise((resolve) => {
      typedResolver.current = resolve;
      setNeedTyped(placeholder);
    });

  useRunOnce(async () => {
    const answers = {} as OrientationAnswers;
    let typedUsed = false;
    for (const q of QUESTIONS) {
      const res = await askSpoken(q.prompt, {
        reprompt: 'Please say your answer now.',
        onListening: setListening,
      });
      if (res.text) {
        answers[q.key] = res.text;
      } else if (!speechAvailable()) {
        typedUsed = true;
        answers[q.key] = await awaitTyped(q.typedPlaceholder);
        setNeedTyped(null);
      } else {
        answers[q.key] = '';
      }
    }
    const result = scoreOrientation(
      answers,
      new Date(),
      config?.expectedPlace ?? '',
      config?.expectedCity ?? '',
    );
    onComplete({
      ...result,
      flags: typedUsed ? [...result.flags, 'typed_response'] : result.flags,
      response: answers,
    });
  });

  return (
    <>
      <p className="instruction">Answer each question about today and where you are.</p>
      <ListeningIndicator on={listening} />
      {needTyped && (
        <TypedInput placeholder={needTyped} onSubmit={(v) => typedResolver.current?.(v)} />
      )}
    </>
  );
}
