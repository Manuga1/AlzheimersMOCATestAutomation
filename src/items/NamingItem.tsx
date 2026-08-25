import { useRef, useState } from 'react';
import type { ItemProps } from '../App';
import { ANIMAL_DRAWINGS } from '../components/animals';
import { NAMING_ANIMALS, scoreNaming } from '../scoring/naming';
import { askSpoken, ListeningIndicator, TypedInput, useRunOnce } from './common';

export function NamingItem({ onComplete }: ItemProps): JSX.Element {
  const [index, setIndex] = useState(0);
  const [listening, setListening] = useState(false);
  const [needTyped, setNeedTyped] = useState(false);
  const typedResolver = useRef<((v: string) => void) | null>(null);

  const awaitTyped = (): Promise<string> =>
    new Promise((resolve) => {
      typedResolver.current = resolve;
      setNeedTyped(true);
    });

  useRunOnce(async () => {
    const answers: { animalId: string; transcript: string; typed: boolean }[] = [];
    for (let i = 0; i < NAMING_ANIMALS.length; i++) {
      setIndex(i);
      setNeedTyped(false);
      const res = await askSpoken('Tell me the name of this animal.', {
        reprompt: 'Please say the name of the animal now.',
        onListening: setListening,
      });
      if (res.text) {
        answers.push({ animalId: NAMING_ANIMALS[i].id, transcript: res.text, typed: false });
      } else {
        const typed = await awaitTyped();
        answers.push({ animalId: NAMING_ANIMALS[i].id, transcript: typed, typed: true });
        setNeedTyped(false);
      }
    }
    onComplete({ ...scoreNaming(answers), response: answers });
  });

  const Drawing = ANIMAL_DRAWINGS[NAMING_ANIMALS[index].id];
  return (
    <>
      <p className="instruction">What is the name of this animal?</p>
      <div className="animal-glyph" data-testid={`animal-${NAMING_ANIMALS[index].id}`}>
        <Drawing />
      </div>
      <ListeningIndicator on={listening} />
      {needTyped && (
        <TypedInput
          placeholder="Type the animal's name"
          onSubmit={(v) => typedResolver.current?.(v)}
        />
      )}
    </>
  );
}
