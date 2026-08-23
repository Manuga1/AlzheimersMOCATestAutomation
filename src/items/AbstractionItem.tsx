import { useRef, useState } from 'react';
import type { ItemProps } from '../App';
import { transcriptContains } from '../core/matchers';
import { voiceGuide } from '../core/voiceGuide';
import { ABSTRACTION_PAIRS, scoreAbstraction } from '../scoring/abstraction';
import { askSpoken, ListeningIndicator, TypedInput, useRunOnce } from './common';
import { speechAvailable } from '../core/speechCapture';

/**
 * Abstraction with the protocol's unscored practice pair (orange–banana) and
 * its single corrective prompt. Typing preserves the verbal-abstraction
 * construct acceptably, so a flagged typed fallback is allowed here.
 */
export function AbstractionItem({ onComplete }: ItemProps): JSX.Element {
  const [listening, setListening] = useState(false);
  const [needTyped, setNeedTyped] = useState(false);
  const typedResolver = useRef<((v: string) => void) | null>(null);
  const typedUsed = useRef(false);

  const awaitTyped = (): Promise<string> =>
    new Promise((resolve) => {
      typedResolver.current = resolve;
      setNeedTyped(true);
    });

  const askPair = async (question: string): Promise<string> => {
    const res = await askSpoken(question, {
      reprompt: 'Please say your answer now.',
      onListening: setListening,
    });
    if (res.text) return res.text;
    if (!speechAvailable()) {
      typedUsed.current = true;
      const typed = await awaitTyped();
      setNeedTyped(false);
      return typed;
    }
    return '';
  };

  useRunOnce(async () => {
    // Practice pair (unscored) with the one corrective prompt from the protocol.
    const practice = await askPair(
      'Tell me how an orange and a banana are alike. What do they have in common?',
    );
    if (!transcriptContains(practice, ['fruit', 'fruits'], 0.2)) {
      await voiceGuide.speak('Yes, and they are also both fruit.');
    }
    const a1 = await askPair('Now, tell me how a train and a bicycle are alike.');
    const a2 = await askPair('Now, tell me how a watch and a ruler are alike.');
    const answers = [
      { pairId: ABSTRACTION_PAIRS[0].id, transcript: a1 },
      { pairId: ABSTRACTION_PAIRS[1].id, transcript: a2 },
    ];
    const result = scoreAbstraction(answers);
    onComplete({
      ...result,
      flags: typedUsed.current ? [...result.flags, 'typed_response'] : result.flags,
      response: { practice, answers },
    });
  });

  return (
    <>
      <p className="instruction">How are the two things alike? Say what they have in common.</p>
      <ListeningIndicator on={listening} />
      {needTyped && (
        <TypedInput placeholder="Type what they have in common" onSubmit={(v) => typedResolver.current?.(v)} />
      )}
    </>
  );
}
