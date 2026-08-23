import { useRef, useState } from 'react';
import type { ItemProps } from '../App';
import { voiceGuide } from '../core/voiceGuide';
import { scoreTrail, TRAIL_SEQUENCE, type TrailTap } from '../scoring/trail';
import { useRunOnce } from './common';

const STAGE_W = 860;
const STAGE_H = 460;

/** Approximate spatial scatter of the paper form's circles (relative coords). */
const POSITIONS: Record<string, [number, number]> = {
  '1': [0.12, 0.72],
  A: [0.09, 0.3],
  '2': [0.3, 0.12],
  B: [0.46, 0.44],
  '3': [0.64, 0.13],
  C: [0.9, 0.26],
  '4': [0.88, 0.66],
  D: [0.64, 0.84],
  '5': [0.42, 0.76],
  E: [0.26, 0.5],
};

const TIME_LIMIT_MS = 90000;

export function TrailItem({ onComplete }: ItemProps): JSX.Element {
  const [progress, setProgress] = useState(0);
  const [errorNode, setErrorNode] = useState<string | null>(null);
  const tapsRef = useRef<TrailTap[]>([]);
  const doneRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  useRunOnce(async () => {
    await voiceGuide.speak(
      'Please touch the circles in order, switching between numbers and letters. Start at one, then A, then two, then B, and keep going until you reach E.',
    );
    timerRef.current = window.setTimeout(() => {
      if (!doneRef.current) {
        doneRef.current = true;
        onComplete({ ...scoreTrail(tapsRef.current, true), response: tapsRef.current });
      }
    }, TIME_LIMIT_MS * (window.__ttsTimeScale ?? 1));
  });

  const tap = (target: string) => {
    if (doneRef.current) return;
    tapsRef.current.push({ target, t: performance.now() });
    if (target === TRAIL_SEQUENCE[progress]) {
      const next = progress + 1;
      setProgress(next);
      setErrorNode(null);
      if (next === TRAIL_SEQUENCE.length) {
        doneRef.current = true;
        if (timerRef.current) clearTimeout(timerRef.current);
        onComplete({ ...scoreTrail(tapsRef.current), response: tapsRef.current });
      }
    } else if (TRAIL_SEQUENCE.indexOf(target as (typeof TRAIL_SEQUENCE)[number]) >= progress) {
      // Wrong tap flashes briefly; already-completed circles are inert.
      setErrorNode(target);
      setTimeout(() => setErrorNode(null), 600);
    }
  };

  const doneSet = new Set(TRAIL_SEQUENCE.slice(0, progress));

  return (
    <>
      <p className="instruction">Touch the circles in order: 1 → A → 2 → B → … → 5 → E</p>
      <div className="trail-stage" style={{ width: STAGE_W, height: STAGE_H }}>
        <svg width={STAGE_W} height={STAGE_H} style={{ position: 'absolute', pointerEvents: 'none' }}>
          {TRAIL_SEQUENCE.slice(1, progress).map((label, i) => {
            const [x1, y1] = POSITIONS[TRAIL_SEQUENCE[i]];
            const [x2, y2] = POSITIONS[label];
            return (
              <line
                key={label}
                x1={x1 * STAGE_W}
                y1={y1 * STAGE_H}
                x2={x2 * STAGE_W}
                y2={y2 * STAGE_H}
                stroke="#2c5f7c"
                strokeWidth={3}
              />
            );
          })}
        </svg>
        {Object.entries(POSITIONS).map(([label, [x, y]]) => (
          <button
            key={label}
            className={`trail-node ${doneSet.has(label as never) ? 'done' : ''} ${errorNode === label ? 'error' : ''}`}
            style={{ left: x * STAGE_W, top: y * STAGE_H }}
            data-testid={`trail-${label}`}
            onClick={() => tap(label)}
          >
            {label}
          </button>
        ))}
      </div>
    </>
  );
}
