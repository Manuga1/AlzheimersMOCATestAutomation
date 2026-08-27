import { useRef, useState } from 'react';
import { DrawingCanvas, fitWidth, type DrawingCanvasHandle } from '../components/DrawingCanvas';
import { voiceGuide } from '../core/voiceGuide';
import { useRunOnce } from '../items/common';

type Step = 'audio' | 'pen' | 'ready';

/**
 * Hands-free gate before testing: confirm the participant can hear the voice
 * guide (tap when heard) and use the stylus (draw a line). If either fails,
 * the participant is told to ask a helper — the test never starts silently
 * broken.
 */
export function OnboardingScreen({ onReady }: { onReady: () => void }): JSX.Element {
  const [step, setStep] = useState<Step>('audio');
  const [penOk, setPenOk] = useState(false);
  const canvasRef = useRef<DrawingCanvasHandle>(null);

  useRunOnce(async () => {
    await voiceGuide.speak(
      'Welcome. Before we begin, let us check the sound. If you can hear my voice, tap the large button on the screen now.',
    );
  });

  const audioConfirmed = async () => {
    setStep('pen');
    await voiceGuide.speak(
      'Good. Now, using the pen or your finger, draw a line inside the white box. Then tap Next.',
    );
  };

  const penDone = async () => {
    if ((canvasRef.current?.getStrokes().length ?? 0) > 0) {
      setPenOk(true);
      setStep('ready');
      await voiceGuide.speak(
        'You are ready to begin. There are thirteen short tasks. I will explain each one. Work at your own pace. Tap Start when you are ready.',
      );
    } else {
      await voiceGuide.speak('I did not see a line yet. Please draw a line inside the white box first.');
    }
  };

  return (
    <div className="screen" data-testid="onboarding">
      {step === 'audio' && (
        <>
          <h2>Sound check</h2>
          <p className="instruction">If you can hear the voice, tap the button below.</p>
          <button className="tap-target" data-testid="audio-ok" onClick={audioConfirmed}>
            I can hear the voice
          </button>
          <p className="muted">Can't hear anything? Ask your helper to raise the volume and restart.</p>
        </>
      )}
      {step === 'pen' && (
        <>
          <h2>Pen check</h2>
          <p className="instruction">Draw a line inside the box with your pen or finger, then tap Next.</p>
          <DrawingCanvas ref={canvasRef} width={fitWidth(500)} height={220} />
          <button className="primary" data-testid="pen-next" onClick={penDone}>
            Next
          </button>
        </>
      )}
      {step === 'ready' && (
        <>
          <h2>All set{penOk ? '' : '?'}</h2>
          <p className="instruction">
            There are 13 short tasks. The voice will guide you through each one — there is no need for
            anyone else to be present.
          </p>
          <button className="primary" data-testid="start-test" onClick={onReady}>
            Start
          </button>
        </>
      )}
    </div>
  );
}
