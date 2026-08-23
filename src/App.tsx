import { useEffect, useState } from 'react';
import { ConfigContext } from './configContext';
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

export interface ItemProps {
  onComplete: (result: ScoreResult & { response?: unknown }) => void;
}

const ITEM_ORDER: { id: ItemId; label: string; component: (p: ItemProps) => JSX.Element }[] = [
  { id: 'trail', label: 'Connecting circles', component: TrailItem },
  { id: 'cube', label: 'Copying a shape', component: CubeItem },
  { id: 'clock', label: 'Drawing a clock', component: ClockItem },
  { id: 'naming', label: 'Naming animals', component: NamingItem },
  { id: 'registration', label: 'Remembering words', component: RegistrationItem },
  { id: 'digitspan', label: 'Repeating numbers', component: DigitSpanItem },
  { id: 'vigilance', label: 'Listening for a letter', component: VigilanceItem },
  { id: 'serial7', label: 'Subtracting numbers', component: Serial7Item },
  { id: 'sentence', label: 'Repeating sentences', component: SentenceItem },
  { id: 'fluency', label: 'Naming words', component: FluencyItem },
  { id: 'abstraction', label: 'Finding similarities', component: AbstractionItem },
  { id: 'recall', label: 'Remembering the words', component: RecallItem },
  { id: 'orientation', label: 'Date and place', component: OrientationItem },
];

type Phase = { kind: 'setup' } | { kind: 'onboarding' } | { kind: 'item'; index: number } | { kind: 'results' };

export default function App(): JSX.Element {
  const [phase, setPhase] = useState<Phase>({ kind: 'setup' });
  const [session, setSession] = useState<Session | null>(null);
  const [caption, setCaption] = useState<string | null>(null);
  const [itemStartedAt, setItemStartedAt] = useState(0);

  useEffect(() => voiceGuide.onCaption(setCaption), []);

  const startSession = (config: SessionConfig, flags: string[]) => {
    const s = { ...newSession(config), flags };
    setSession(s);
    setPhase({ kind: 'onboarding' });
  };

  const beginItems = () => {
    setItemStartedAt(Date.now());
    setPhase({ kind: 'item', index: 0 });
  };

  const completeItem = (index: number, partial: ScoreResult & { response?: unknown }) => {
    if (!session) return;
    const item = ITEM_ORDER[index];
    const result: ItemResult = {
      itemId: item.id,
      startedAt: itemStartedAt,
      finishedAt: Date.now(),
      ...partial,
    };
    let next = addResult(session, result);
    if (index + 1 < ITEM_ORDER.length) {
      setSession(next);
      void saveSession(next);
      setItemStartedAt(Date.now());
      setPhase({ kind: 'item', index: index + 1 });
    } else {
      next = finalizeSession(next);
      setSession(next);
      void saveSession(next);
      setPhase({ kind: 'results' });
    }
  };

  const restart = () => {
    voiceGuide.cancel();
    setSession(null);
    setPhase({ kind: 'setup' });
  };

  return (
    <div className="app">
      <CaptionBar caption={caption} phase={phase} />
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

function CaptionBar({ caption, phase }: { caption: string | null; phase: Phase }): JSX.Element {
  if (caption) {
    return (
      <div className="caption-bar" data-testid="caption">
        🔊 {caption}
      </div>
    );
  }
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
  const Item = ITEM_ORDER[index].component;
  return (
    <div className="screen" data-testid={`item-${ITEM_ORDER[index].id}`}>
      <Item onComplete={(r) => onComplete(index, r)} />
    </div>
  );
}
