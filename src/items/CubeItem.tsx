import { useRef, useState } from 'react';
import type { ItemProps } from '../App';
import { DrawingCanvas, type DrawingCanvasHandle } from '../components/DrawingCanvas';
import { voiceGuide } from '../core/voiceGuide';
import { scoreCube } from '../scoring/cube';
import { useRunOnce } from './common';

/** Wireframe cube model, matching the paper stimulus proportions. */
function CubeModel(): JSX.Element {
  // Front square (40,60)-(160,180), offset (60,-40) for the back square.
  const f = { x: 40, y: 60, s: 120 };
  const o = { x: 60, y: -40 };
  const b = { x: f.x + o.x, y: f.y + o.y };
  const line = (x1: number, y1: number, x2: number, y2: number, key: string, dashed = false) => (
    <line key={key} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#23303a" strokeWidth={3} strokeDasharray={dashed ? '6 5' : undefined} />
  );
  return (
    <svg className="cube-model" width={260} height={220} data-testid="cube-model">
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

export function CubeItem({ onComplete }: ItemProps): JSX.Element {
  const canvasRef = useRef<DrawingCanvasHandle>(null);
  const [strokeCount, setStrokeCount] = useState(0);

  useRunOnce(async () => {
    await voiceGuide.speak(
      'Copy this drawing as accurately as you can in the space on the right. Tap Done when you are finished.',
    );
  });

  const finish = () => {
    const strokes = canvasRef.current?.getStrokes() ?? [];
    onComplete({ ...scoreCube(strokes), response: strokes });
  };

  return (
    <>
      <p className="instruction">Copy the drawing on the left into the box on the right.</p>
      <div className="row">
        <CubeModel />
        <DrawingCanvas ref={canvasRef} width={430} height={380} onStrokeCountChange={setStrokeCount} />
      </div>
      <div className="row">
        <button className="secondary" onClick={() => canvasRef.current?.undo()}>
          Undo
        </button>
        <button className="secondary" onClick={() => canvasRef.current?.clear()}>
          Clear
        </button>
        <button className="primary" data-testid="cube-done" disabled={strokeCount === 0} onClick={finish}>
          Done
        </button>
      </div>
    </>
  );
}
