import { useRef } from 'react';
import type { ItemProps } from '../App';
import { DrawingCanvas, type DrawingCanvasHandle } from '../components/DrawingCanvas';
import { CubeModel } from '../components/references';
import { voiceGuide } from '../core/voiceGuide';
import { scoreCube } from '../scoring/cube';
import { useRunOnce } from './common';

export function CubeItem({ onComplete }: ItemProps): JSX.Element {
  const canvasRef = useRef<DrawingCanvasHandle>(null);

  useRunOnce(async (alive) => {
    await voiceGuide.speak(
      'Copy this drawing as accurately as you can in the space on the right. Tap Done when you are finished.',
      alive,
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
        <DrawingCanvas ref={canvasRef} width={430} height={380} />
      </div>
      <div className="row">
        <button className="secondary" onClick={() => canvasRef.current?.undo()}>
          Undo
        </button>
        <button className="secondary" onClick={() => canvasRef.current?.clear()}>
          Clear
        </button>
        <button className="primary" data-testid="cube-done" onClick={finish}>
          Done
        </button>
      </div>
    </>
  );
}
