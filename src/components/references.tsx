import { STAGE_H, STAGE_W, TRAIL_POSITIONS } from '../items/TrailItem';
import { TRAIL_SEQUENCE, type TrailTap } from '../scoring/trail';

/** Wireframe cube model, matching the paper stimulus proportions. */
export function CubeModel({ scale = 1 }: { scale?: number }): JSX.Element {
  // Front square (40,60)-(160,180), offset (60,-40) for the back square.
  const f = { x: 40, y: 60, s: 120 };
  const o = { x: 60, y: -40 };
  const b = { x: f.x + o.x, y: f.y + o.y };
  const line = (x1: number, y1: number, x2: number, y2: number, key: string, dashed = false) => (
    <line
      key={key}
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke="#23303a"
      strokeWidth={3}
      strokeDasharray={dashed ? '6 5' : undefined}
    />
  );
  return (
    <svg
      className="cube-model"
      width={260 * scale}
      height={220 * scale}
      viewBox="0 0 260 220"
      data-testid="cube-model"
    >
      {line(f.x, f.y, f.x + f.s, f.y, 'f-top')}
      {line(f.x + f.s, f.y, f.x + f.s, f.y + f.s, 'f-right')}
      {line(f.x + f.s, f.y + f.s, f.x, f.y + f.s, 'f-bottom')}
      {line(f.x, f.y + f.s, f.x, f.y, 'f-left')}
      {line(b.x, b.y, b.x + f.s, b.y, 'b-top')}
      {line(b.x + f.s, b.y, b.x + f.s, b.y + f.s, 'b-right')}
      {line(b.x + f.s, b.y + f.s, b.x, b.y + f.s, 'b-bottom', true)}
      {line(b.x, b.y + f.s, b.x, b.y, 'b-left', true)}
      {line(f.x, f.y, b.x, b.y, 'c-tl')}
      {line(f.x + f.s, f.y, b.x + f.s, b.y, 'c-tr')}
      {line(f.x + f.s, f.y + f.s, b.x + f.s, b.y + f.s, 'c-br')}
      {line(f.x, f.y + f.s, b.x, b.y + f.s, 'c-bl', true)}
    </svg>
  );
}

/** The ideal clock answer: contour, numbers 1-12, hands at ten past eleven. */
export function ClockReference({ size = 200 }: { size?: number }): JSX.Element {
  const c = 110;
  const r = 100;
  const pos = (clockDeg: number, radius: number) => ({
    x: c + radius * Math.sin((clockDeg * Math.PI) / 180),
    y: c - radius * Math.cos((clockDeg * Math.PI) / 180),
  });
  const minute = pos(60, 0.62 * r); // pointing at the 2
  const hour = pos(335, 0.38 * r); // 11 o'clock, drifted for the 10 minutes
  return (
    <svg width={size} height={size} viewBox="0 0 220 220" data-testid="clock-reference">
      <circle cx={c} cy={c} r={r} fill="none" stroke="#23303a" strokeWidth={3} />
      {Array.from({ length: 12 }, (_, i) => {
        const n = i + 1;
        const p = pos(n * 30, 0.82 * r);
        return (
          <text key={n} x={p.x} y={p.y + 6} textAnchor="middle" fontSize={18} fill="#23303a">
            {n}
          </text>
        );
      })}
      <line x1={c} y1={c} x2={minute.x} y2={minute.y} stroke="#23303a" strokeWidth={3} />
      <line x1={c} y1={c} x2={hour.x} y2={hour.y} stroke="#23303a" strokeWidth={4} />
      <circle cx={c} cy={c} r={3.5} fill="#23303a" />
    </svg>
  );
}

const TRAIL_VIEW_W = 320;
const TRAIL_VIEW_H = (TRAIL_VIEW_W * STAGE_H) / STAGE_W;

function TrailLayout({
  path,
  errorTargets,
}: {
  /** Sequence of target labels to connect with lines, in order. */
  path: string[];
  /** Targets to mark red (wrong taps). */
  errorTargets?: Set<string>;
}): JSX.Element {
  const at = (label: string) => {
    const [x, y] = TRAIL_POSITIONS[label];
    return { x: x * TRAIL_VIEW_W, y: y * TRAIL_VIEW_H };
  };
  return (
    <svg width={TRAIL_VIEW_W} height={TRAIL_VIEW_H}>
      {path.slice(1).map((label, i) => {
        const a = at(path[i]);
        const b = at(label);
        return (
          <line key={`${i}-${label}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#2c5f7c" strokeWidth={2} />
        );
      })}
      {Object.keys(TRAIL_POSITIONS).map((label) => {
        const p = at(label);
        const isError = errorTargets?.has(label);
        return (
          <g key={label}>
            <circle
              cx={p.x}
              cy={p.y}
              r={14}
              fill={isError ? '#b3402a' : '#fff'}
              stroke={isError ? '#b3402a' : '#23303a'}
              strokeWidth={2}
            />
            <text x={p.x} y={p.y + 5} textAnchor="middle" fontSize={13} fill={isError ? '#fff' : '#23303a'}>
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** The correct 1→A→…→E path. */
export function TrailReference(): JSX.Element {
  return <TrailLayout path={[...TRAIL_SEQUENCE]} />;
}

/** The participant's actual tap sequence; wrong taps are marked red. */
export function TrailActual({ taps }: { taps: TrailTap[] }): JSX.Element {
  const errorTargets = new Set<string>();
  let expected = 0;
  const path: string[] = [];
  for (const tap of taps) {
    if (tap.target === TRAIL_SEQUENCE[expected]) {
      path.push(tap.target);
      expected++;
    } else if (TRAIL_SEQUENCE.indexOf(tap.target as (typeof TRAIL_SEQUENCE)[number]) >= expected) {
      errorTargets.add(tap.target);
    }
  }
  return <TrailLayout path={path} errorTargets={errorTargets} />;
}
