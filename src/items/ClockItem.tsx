import { useRef, useState } from 'react';
import type { ItemProps } from '../App';
import { DrawingCanvas, type DrawingCanvasHandle } from '../components/DrawingCanvas';
import { loadDigitClassifier } from '../core/digitClassifier';
import { voiceGuide } from '../core/voiceGuide';
import { scoreClock } from '../scoring/clock';
import { useRunOnce } from './common';

export function ClockItem({ onComplete }: ItemProps): JSX.Element {
  const canvasRef = useRef<DrawingCanvasHandle>(null);
  const [strokeCount, setStrokeCount] = useState(0);
  const [scoring, setScoring] = useState(false);

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
      <DrawingCanvas ref={canvasRef} width={520} height={420} onStrokeCountChange={setStrokeCount} />
      <div className="row">
        <button className="secondary" onClick={() => canvasRef.current?.undo()}>
          Undo
        </button>
        <button className="secondary" onClick={() => canvasRef.current?.clear()}>
          Clear
        </button>
        <button
          className="primary"
          data-testid="clock-done"
          disabled={strokeCount === 0 || scoring}
          onClick={finish}
        >
          {scoring ? 'Checking…' : 'Done'}
        </button>
      </div>
    </>
  );
}
