import { useContext, useEffect, useRef, useState } from 'react';
import type { ItemProps } from '../App';
import { DoneContext } from '../doneContext';
import { voiceGuide } from '../core/voiceGuide';
import type { Stroke, StrokePoint } from '../core/types';
import { scoreTrail, TRAIL_SEQUENCE, type TrailTap } from '../scoring/trail';
import { useRunOnce } from './common';

export const STAGE_W = 860;
export const STAGE_H = 460;
const NODE_R = 36;

/**
 * Circle layout reproducing the official MoCA trail figure's arrangement:
 * Begin at 1 (lower left), End at E (upper right), with a non-crossing
 * solution path. Coordinates are relative (x, y as fractions of the stage).
 */
export const TRAIL_POSITIONS: Record<string, [number, number]> = {
  '1': [0.1, 0.8],
  A: [0.07, 0.42],
  '2': [0.3, 0.62],
  B: [0.32, 0.18],
  '3': [0.55, 0.45],
  C: [0.62, 0.82],
  '4': [0.72, 0.6],
  D: [0.85, 0.78],
  '5': [0.62, 0.15],
  E: [0.9, 0.2],
};

/** Segments shown as dotted example guides the patient traces over. */
const GUIDED_SEGMENTS: [string, string][] = [
  ['1', 'A'],
  ['A', '2'],
];

export interface TrailResponse {
  taps: TrailTap[];
  strokes: Stroke[];
}

const px = (label: string): { x: number; y: number } => ({
  x: TRAIL_POSITIONS[label][0] * STAGE_W,
  y: TRAIL_POSITIONS[label][1] * STAGE_H,
});

/**
 * Trail making, official-style: the patient DRAWS a continuous line with the
 * stylus from circle to circle (1→A→2→B→…→E). Dotted guide lines over the
 * first two segments show what to do; the patient traces them and continues
 * unguided. Entering the correct next circle advances; entering a wrong
 * circle records an error (self-correction rule handled by scoreTrail).
 */
export function TrailItem({ onComplete }: ItemProps): JSX.Element {
  const [, setInkVersion] = useState(0);

  const tapsRef = useRef<TrailTap[]>([]);
  const strokesRef = useRef<Stroke[]>([]);
  const activeStroke = useRef<Stroke | null>(null);
  const activePointerId = useRef<number | null>(null);
  const progressRef = useRef(0);
  const insideRef = useRef<string | null>(null);
  const doneRef = useRef(false);
  const svgRef = useRef<SVGSVGElement>(null);

  const finish = (timedOut: boolean) => {
    if (doneRef.current) return;
    doneRef.current = true;
    // Include the in-flight stroke: the pattern completes while the pen is
    // still down on the final circle.
    const strokes = activeStroke.current
      ? [...strokesRef.current, activeStroke.current]
      : strokesRef.current;
    const response: TrailResponse = { taps: tapsRef.current, strokes };
    const result = scoreTrail(tapsRef.current, timedOut);
    onComplete({
      ...result,
      detail: { ...result.detail, guidedSegments: GUIDED_SEGMENTS.map((s) => s.join('-')) },
      response,
    });
  };

  // The always-available Done button submits the drawing as-is: the taps so
  // far are scored normally (incomplete pattern → 0 per MoCA rule) and the
  // partial drawing is kept for the results-page review.
  const doneRegistry = useContext(DoneContext);
  useEffect(() => {
    doneRegistry?.register(() => finish(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // No auto-advance and no time-limit cutoff: the participant works at their
  // own pace and only the Done button submits (timing data lives in the
  // recorded tap/stroke timestamps).
  useRunOnce(async (alive) => {
    await voiceGuide.speak(
      'Please draw a line going from a number to a letter, in increasing order, using the pen. Begin at the circle marked one, and trace over the dotted line to A, and then to two. Then continue on your own: draw from two to B, and keep switching between numbers and letters until you reach the circle marked E.',
      alive,
    );
  });

  const hitNode = (x: number, y: number): string | null => {
    for (const label of Object.keys(TRAIL_POSITIONS)) {
      const p = px(label);
      if (Math.hypot(x - p.x, y - p.y) <= NODE_R + 6) return label;
    }
    return null;
  };

  const handlePoint = (x: number, y: number, t: number) => {
    if (doneRef.current) return;
    const node = hitNode(x, y);
    if (node === insideRef.current) return;
    insideRef.current = node;
    if (!node) return;
    const expected = TRAIL_SEQUENCE[progressRef.current];
    const idx = TRAIL_SEQUENCE.indexOf(node as (typeof TRAIL_SEQUENCE)[number]);
    // No right/wrong feedback is shown (per protocol — the examiner does not
    // correct the patient); progress and errors are recorded silently.
    if (node === expected) {
      tapsRef.current.push({ target: node, t });
      progressRef.current++;
      if (progressRef.current === TRAIL_SEQUENCE.length) {
        // Let the pen-up handler store the final stroke before finishing.
        setTimeout(() => finish(false), 50);
      }
    } else if (idx >= progressRef.current) {
      // Entering a future circle out of order is an error; circles already
      // completed are inert (the line legitimately passes back near them).
      tapsRef.current.push({ target: node, t });
    }
  };

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const toLocal = (ev: PointerEvent): StrokePoint => {
      const rect = svg.getBoundingClientRect();
      return {
        x: ((ev.clientX - rect.left) / rect.width) * STAGE_W,
        y: ((ev.clientY - rect.top) / rect.height) * STAGE_H,
        t: performance.now(),
        pressure: ev.pressure,
      };
    };

    // Pen, mouse, and finger all draw — one pointer at a time, pen taking
    // over from an active touch stroke (palm handling).
    const down = (ev: PointerEvent) => {
      if (doneRef.current) return;
      if (activeStroke.current) {
        if (ev.pointerType === 'pen' && activeStroke.current.pointerType === 'touch') {
          activeStroke.current = null; // palm landed first; the pen wins
        } else {
          return;
        }
      }
      ev.preventDefault();
      try {
        svg.setPointerCapture(ev.pointerId);
      } catch {
        /* synthetic or already-released pointer */
      }
      activePointerId.current = ev.pointerId;
      const p = toLocal(ev);
      activeStroke.current = { points: [p], pointerType: ev.pointerType };
      insideRef.current = null;
      handlePoint(p.x, p.y, p.t);
    };
    const move = (ev: PointerEvent) => {
      if (!activeStroke.current || ev.pointerId !== activePointerId.current) return;
      ev.preventDefault();
      const events = typeof ev.getCoalescedEvents === 'function' ? ev.getCoalescedEvents() : [ev];
      for (const e of events.length ? events : [ev]) {
        const p = toLocal(e as PointerEvent);
        activeStroke.current.points.push(p);
        handlePoint(p.x, p.y, p.t);
      }
      setInkVersion((v) => v + 1);
    };
    const up = (ev: PointerEvent) => {
      if (!activeStroke.current || ev.pointerId !== activePointerId.current) return;
      if (activeStroke.current.points.length > 1) {
        strokesRef.current = [...strokesRef.current, activeStroke.current];
      }
      activeStroke.current = null;
      activePointerId.current = null;
      insideRef.current = null;
      setInkVersion((v) => v + 1);
    };

    svg.addEventListener('pointerdown', down);
    svg.addEventListener('pointermove', move);
    svg.addEventListener('pointerup', up);
    svg.addEventListener('pointercancel', up);
    return () => {
      svg.removeEventListener('pointerdown', down);
      svg.removeEventListener('pointermove', move);
      svg.removeEventListener('pointerup', up);
      svg.removeEventListener('pointercancel', up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const inkStrokes = activeStroke.current
    ? [...strokesRef.current, activeStroke.current]
    : strokesRef.current;

  return (
    <>
      <p className="instruction">
        Draw a line from circle to circle in order: 1 → A → 2 → B → … → 5 → E
      </p>
      <svg
        ref={svgRef}
        className="trail-stage"
        viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}
        style={{ touchAction: 'none', width: '100%', maxWidth: STAGE_W, height: 'auto' }}
        data-testid="trail-svg"
      >
        {/* Dotted example guides over the first two segments */}
        {GUIDED_SEGMENTS.map(([a, b]) => {
          const pa = px(a);
          const pb = px(b);
          return (
            <line
              key={`${a}${b}`}
              x1={pa.x}
              y1={pa.y}
              x2={pb.x}
              y2={pb.y}
              stroke="#9aa7b0"
              strokeWidth={3}
              strokeDasharray="4 10"
              data-testid={`trail-guide-${a}-${b}`}
            />
          );
        })}
        {/* Participant ink */}
        {inkStrokes.map((s, i) => (
          <polyline
            key={i}
            points={s.points.map((p) => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke="#2c5f7c"
            strokeWidth={4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        {/* Circles — no right/wrong or progress coloring (no feedback, per protocol) */}
        {Object.keys(TRAIL_POSITIONS).map((label) => {
          const p = px(label);
          return (
            <g key={label} data-testid={`trail-${label}`}>
              <circle cx={p.x} cy={p.y} r={NODE_R} fill="#fff" stroke="#23303a" strokeWidth={3} />
              <text
                x={p.x}
                y={p.y + 10}
                textAnchor="middle"
                fontSize={30}
                fontWeight={700}
                fill="#23303a"
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {label}
              </text>
            </g>
          );
        })}
        {/* Begin / End labels, as on the paper form */}
        <text x={px('1').x} y={px('1').y + NODE_R + 24} textAnchor="middle" fontSize={16} fill="#6b7680">
          Begin
        </text>
        <text x={px('E').x} y={px('E').y - NODE_R - 10} textAnchor="middle" fontSize={16} fill="#6b7680">
          End
        </text>
      </svg>
    </>
  );
}
