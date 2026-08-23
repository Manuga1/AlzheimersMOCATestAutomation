import { useEffect, useRef, useState } from 'react';
import { captureSpeech, speechAvailable, type CaptureResult } from '../core/speechCapture';
import { voiceGuide } from '../core/voiceGuide';

/** Run an async item flow exactly once on mount. */
export function useRunOnce(fn: () => void | Promise<void>): void {
  const ran = useRef(false);
  useEffect(() => {
    if (!ran.current) {
      ran.current = true;
      void fn();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

export interface AskOptions {
  maxMs?: number;
  silenceStopMs?: number;
  /** Spoken once if the first capture hears nothing. */
  reprompt?: string;
  onListening?: (on: boolean) => void;
}

/**
 * Standard voice interaction: speak the prompt, listen, and if nothing was
 * heard re-prompt once (protocol permits a single reminder, never a
 * re-reading of stimulus material).
 */
export async function askSpoken(prompt: string, opts: AskOptions = {}): Promise<CaptureResult> {
  const { maxMs = 12000, silenceStopMs = 2500, reprompt, onListening } = opts;
  await voiceGuide.speak(prompt);
  if (!speechAvailable()) {
    return { transcripts: [], alternatives: [], text: '', voiceActivityMs: null };
  }
  let result = await captureSpeech({ maxMs, silenceStopMs, onListening });
  if (!result.text && reprompt) {
    await voiceGuide.speak(reprompt);
    result = await captureSpeech({ maxMs, silenceStopMs, onListening });
  }
  return result;
}

export function ListeningIndicator({ on }: { on: boolean }): JSX.Element | null {
  if (!on) return null;
  return (
    <div className="listening" data-testid="listening">
      <span className="dot" /> Listening… speak now
    </div>
  );
}

/** On-screen keypad for digit entry fallbacks (no echo of prior digits kept). */
export function Keypad({
  onSubmit,
  allowClear = true,
}: {
  onSubmit: (value: string) => void;
  allowClear?: boolean;
}): JSX.Element {
  const [value, setValue] = useState('');
  return (
    <div className="col" data-testid="keypad">
      <div className="keypad-display">{value || ' '}</div>
      <div className="keypad">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
          <button key={d} onClick={() => setValue(value + d)}>
            {d}
          </button>
        ))}
        <button onClick={() => allowClear && setValue('')}>⌫</button>
        <button onClick={() => setValue(value + '0')}>0</button>
        <button onClick={() => onSubmit(value)} data-testid="keypad-ok">
          OK
        </button>
      </div>
    </div>
  );
}

/** Free-text fallback input, used when speech recognition is unavailable. */
export function TypedInput({
  placeholder,
  onSubmit,
}: {
  placeholder: string;
  onSubmit: (value: string) => void;
}): JSX.Element {
  const [value, setValue] = useState('');
  return (
    <div className="row" data-testid="typed-input">
      <input
        className="typed-input"
        placeholder={placeholder}
        value={value}
        autoFocus
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onSubmit(value)}
      />
      <button className="primary" onClick={() => onSubmit(value)} data-testid="typed-submit">
        Done
      </button>
    </div>
  );
}
