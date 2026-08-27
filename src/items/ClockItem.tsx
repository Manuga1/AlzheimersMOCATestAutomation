import { useRef, useState } from 'react';
import type { ItemProps } from '../App';
import { DrawingCanvas, fitWidth, type DrawingCanvasHandle } from '../components/DrawingCanvas';
import { loadDigitClassifier } from '../core/digitClassifier';
import { voiceGuide } from '../core/voiceGuide';
import { scoreClock } from '../scoring/clock';
import { useRunOnce } from './common';

export function ClockItem({ onComplete }: ItemProps): JSX.Element {
  const canvasRef = useRef<DrawingCanvasHandle>(null);
  const [scoring, setScoring] = useState(false);
  const [canvasW] = useState(() => fitWidth(520));

  useRunOnce(async (alive) => {
    await voiceGuide.speak(
      'Now, draw a clock. Put in all the numbers, and set the time to ten past eleven. Tap Done when you are finished.',
      alive,
    );
  });

  const finish = async () => {
    setScoring(true);
    const strokes = canvasRef.current?.getStrokes() ?? [];
    const classifier = await loadDigitClassifier();
    const result = await scoreClock(strokes, classifier);
    onComplete({ ...result, response: strokes });
  };

  return (
    <>
      <p className="instruction">Draw a clock: put in all the numbers and set the time to ten past eleven.</p>
      <DrawingCanvas ref={canvasRef} width={canvasW} height={420} />
      <div className="row">
        <button className="secondary" onClick={() => canvasRef.current?.undo()}>
          Undo
        </button>
        <button className="secondary" onClick={() => canvasRef.current?.clear()}>
          Clear
        </button>
        <button className="primary" data-testid="clock-done" disabled={scoring} onClick={finish}>
          {scoring ? 'Checking…' : 'Done'}
        </button>
      </div>
    </>
  );
}
