import { useMemo, useRef, useState } from 'react';
import { ConfigContext } from './configContext';
import { DoneContext } from './doneContext';
import { abortActiveCaptures } from './core/speechCapture';
import { voiceGuide } from './core/voiceGuide';
import { addResult, finalizeSession, newSession, saveSession } from './core/session';
import type { ItemId, ItemResult, ScoreResult, Session, SessionConfig } from './core/types';
import { SetupScreen } from './screens/Setup';
import { OnboardingScreen } from './screens/Onboarding';
import { ResultsScreen } from './screens/Results';
import { TrailItem } from './items/TrailItem';
import { CubeItem } from './items/CubeItem';
import { ClockItem } from './items/ClockItem';
import { NamingItem } from './items/NamingItem';
import { RegistrationItem } from './items/RegistrationItem';
import { DigitSpanItem } from './items/DigitSpanItem';
import { VigilanceItem } from './items/VigilanceItem';
import { Serial7Item } from './items/Serial7Item';
import { SentenceItem } from './items/SentenceItem';
import { FluencyItem } from './items/FluencyItem';
import { AbstractionItem } from './items/AbstractionItem';
import { RecallItem } from './items/RecallItem';
import { OrientationItem } from './items/OrientationItem';

/**
 * TESTING ONLY — set to false (or delete SkipButton and this flag) before any
 * real administration. Shows a skip control on onboarding and on every item;
 * skipped items score 0 and are flagged `skipped_for_testing`.
 */
const TESTING_SKIP_ENABLED = true;

export interface ItemProps {
  onComplete: (result: ScoreResult & { response?: unknown }) => void;
}

const ITEM_ORDER: {
  id: ItemId;
  label: string;
  max: number;
  /** Item renders its own Done button; the generic one is hidden. */
  hasOwnDone?: boolean;
  component: (p: ItemProps) => JSX.Element;
}[] = [
  { id: 'trail', label: 'Connecting circles', max: 1, component: TrailItem },
  { id: 'cube', label: 'Copying a shape', max: 1, hasOwnDone: true, component: CubeItem },
  { id: 'clock', label: 'Drawing a clock', max: 3, hasOwnDone: true, component: ClockItem },
  { id: 'naming', label: 'Naming animals', max: 3, component: NamingItem },
  { id: 'registration', label: 'Remembering words', max: 0, component: RegistrationItem },
  { id: 'digitspan', label: 'Repeating numbers', max: 2, component: DigitSpanItem },
  { id: 'vigilance', label: 'Listening for a letter', max: 1, component: VigilanceItem },
  { id: 'serial7', label: 'Subtracting numbers', max: 3, component: Serial7Item },
  { id: 'sentence', label: 'Repeating sentences', max: 2, component: SentenceItem },
  { id: 'fluency', label: 'Naming words', max: 1, component: FluencyItem },
  { id: 'abstraction', label: 'Finding similarities', max: 2, component: AbstractionItem },
  { id: 'recall', label: 'Remembering the words', max: 5, component: RecallItem },
  { id: 'orientation', label: 'Date and place', max: 6, component: OrientationItem },
];

type Phase = { kind: 'setup' } | { kind: 'onboarding' } | { kind: 'item'; index: number } | { kind: 'results' };

export default function App(): JSX.Element {
  const [phase, setPhase] = useState<Phase>({ kind: 'setup' });
  const [session, setSession] = useState<Session | null>(null);
  const [itemStartedAt, setItemStartedAt] = useState(0);
  // The index the flow currently accepts a completion for. A skipped item's
  // still-running async flow (voice prompt, speech capture) may call
  // onComplete later; this guard makes those late calls no-ops.
  const currentIndexRef = useRef(-1);
  const sessionRef = useRef<Session | null>(null);

  const startSession = (config: SessionConfig, flags: string[]) => {
    const s = { ...newSession(config), flags };
    setSession(s);
    sessionRef.current = s;
    setPhase({ kind: 'onboarding' });
  };

  const beginItems = () => {
    setItemStartedAt(Date.now());
    currentIndexRef.current = 0;
    setPhase({ kind: 'item', index: 0 });
  };

  const completeItem = (index: number, partial: ScoreResult & { response?: unknown }) => {
    const current = sessionRef.current;
    if (!current || index !== currentIndexRef.current) return;
    const item = ITEM_ORDER[index];
    const result: ItemResult = {
      itemId: item.id,
      startedAt: itemStartedAt,
      finishedAt: Date.now(),
      ...partial,
    };
    let next = addResult(current, result);
    if (index + 1 < ITEM_ORDER.length) {
      sessionRef.current = next;
      setSession(next);
      void saveSession(next);
      setItemStartedAt(Date.now());
      currentIndexRef.current = index + 1;
      setPhase({ kind: 'item', index: index + 1 });
    } else {
      next = finalizeSession(next);
      sessionRef.current = next;
      setSession(next);
      void saveSession(next);
      currentIndexRef.current = -1;
      setPhase({ kind: 'results' });
    }
  };

  const skipCurrent = () => {
    if (phase.kind === 'onboarding') {
      voiceGuide.cancel();
      abortActiveCaptures();
      beginItems();
      return;
    }
    if (phase.kind !== 'item') return;
    voiceGuide.cancel();
    abortActiveCaptures();
    completeItem(phase.index, {
      score: 0,
      max: ITEM_ORDER[phase.index].max,
      confidence: 0,
      flags: ['skipped_for_testing'],
    });
  };

  const restart = () => {
    voiceGuide.cancel();
    abortActiveCaptures();
    setSession(null);
    sessionRef.current = null;
    currentIndexRef.current = -1;
    setPhase({ kind: 'setup' });
  };

  const showSkip = TESTING_SKIP_ENABLED && (phase.kind === 'onboarding' || phase.kind === 'item');

  return (
    <div className="app">
      <CaptionBar phase={phase} />
      {showSkip && (
        <button className="skip-button" data-testid="skip-button" onClick={skipCurrent}>
          Skip ▸ (testing)
        </button>
      )}
      {phase.kind === 'setup' && <SetupScreen onStart={startSession} />}
      {phase.kind === 'onboarding' && <OnboardingScreen onReady={beginItems} />}
      {phase.kind === 'item' && (
        <ConfigContext.Provider value={session?.config ?? null}>
          <ItemHost key={ITEM_ORDER[phase.index].id} index={phase.index} onComplete={completeItem} />
        </ConfigContext.Provider>
      )}
      {phase.kind === 'results' && session && <ResultsScreen session={session} onRestart={restart} />}
    </div>
  );
}

/**
 * Top bar shows only the task name — never a transcript of the audio.
 * Displaying spoken content would let patients read stimuli (memory words,
 * vigilance letters) instead of listening, invalidating those items.
 */
function CaptionBar({ phase }: { phase: Phase }): JSX.Element {
  const label =
    phase.kind === 'item'
      ? `Task ${phase.index + 1} of ${ITEM_ORDER.length}: ${ITEM_ORDER[phase.index].label}`
      : 'Cognitive Screen';
  return (
    <div className="caption-bar idle" data-testid="caption-idle">
      {label}
    </div>
  );
}

function ItemHost({
  index,
  onComplete,
}: {
  index: number;
  onComplete: (index: number, r: ScoreResult & { response?: unknown }) => void;
}): JSX.Element {
  const item = ITEM_ORDER[index];
  const Item = item.component;
  const doneHandler = useRef<(() => void) | null>(null);
  // No task ever advances on its own: when an item's flow finishes, its
  // result is STAGED here and the participant advances by tapping Done.
  // (Cube/clock render their own Done button, so their click IS the
  // submission and they bypass staging.)
  const stagedRef = useRef<(ScoreResult & { response?: unknown }) | null>(null);
  const [ready, setReady] = useState(false);
  const registry = useMemo(
    () => ({
      register: (fn: () => void) => {
        doneHandler.current = fn;
      },
    }),
    [],
  );

  const itemComplete = (r: ScoreResult & { response?: unknown }) => {
    if (item.hasOwnDone) {
      onComplete(index, r);
    } else {
      stagedRef.current = r;
      setReady(true);
    }
  };

  // "Done — move on" is always available so the participant is never stuck.
  // Priority: a staged result (flow finished) → the item's registered
  // finisher (scores partial work, staging synchronously) → `ended_early`.
  const done = () => {
    voiceGuide.cancel();
    abortActiveCaptures();
    if (!stagedRef.current && doneHandler.current) {
      doneHandler.current();
    }
    if (stagedRef.current) {
      onComplete(index, stagedRef.current);
    } else {
      onComplete(index, {
        score: 0,
        max: item.max,
        confidence: 0.5,
        flags: ['ended_early'],
      });
    }
  };

  return (
    <div className="screen" data-testid={`item-${item.id}`}>
      <DoneContext.Provider value={registry}>
        <Item onComplete={itemComplete} />
      </DoneContext.Provider>
      {!item.hasOwnDone && (
        <button
          className={ready ? 'primary item-done ready' : 'secondary item-done'}
          data-testid="item-done"
          data-ready={ready ? 'true' : 'false'}
          onClick={done}
        >
          Done — move on
        </button>
      )}
    </div>
  );
}
