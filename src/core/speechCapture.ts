/**
 * Wrapper around webkitSpeechRecognition (iOS Safari) that:
 *  - auto-restarts sessions inside the capture window (iOS ends recognition
 *    after short silences; `continuous` is unreliable),
 *  - aggregates all final transcripts and their alternatives,
 *  - optionally stops early after sustained silence once something was heard,
 *  - runs a parallel microphone level meter (Web Audio) so scorers can
 *    distinguish "user was silent" from "recognizer dropped the audio".
 *
 * The recognition constructor is looked up at call time so test environments
 * can install a mock on window before the app runs.
 */

export interface CaptureResult {
  /** Final transcripts in order heard (one per recognized utterance). */
  transcripts: string[];
  /** All alternatives per utterance (first = best). */
  alternatives: string[][];
  /** Concatenation of all transcripts. */
  text: string;
  /** Milliseconds of detected voice activity, or null when the meter is unavailable. */
  voiceActivityMs: number | null;
}

export interface CaptureOptions {
  maxMs: number;
  /** Stop early after this much silence once at least one result arrived. */
  silenceStopMs?: number;
  onInterim?: (text: string) => void;
  /** Signals the UI that listening started (show the mic indicator). */
  onListening?: (listening: boolean) => void;
}

type RecognitionCtor = new () => SpeechRecognitionLike;

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((ev: { error?: string }) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

function getRecognitionCtor(): RecognitionCtor | null {
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition as RecognitionCtor) || (w.webkitSpeechRecognition as RecognitionCtor) || null;
}

export function speechAvailable(): boolean {
  return typeof window !== 'undefined' && getRecognitionCtor() !== null;
}

declare global {
  interface Window {
    /** Test hook: scales capture windows and silence timeouts. */
    __speechTimeScale?: number;
    /** Incremented per capture; lets test mocks deliver one utterance per capture. */
    __captureEpoch?: number;
  }
}

export async function captureSpeech(rawOpts: CaptureOptions): Promise<CaptureResult> {
  const Ctor = getRecognitionCtor();
  if (!Ctor) {
    return { transcripts: [], alternatives: [], text: '', voiceActivityMs: null };
  }
  const scale = window.__speechTimeScale ?? 1;
  const opts: CaptureOptions = {
    ...rawOpts,
    maxMs: rawOpts.maxMs * scale,
    silenceStopMs: rawOpts.silenceStopMs
      ? Math.max(150, rawOpts.silenceStopMs * scale)
      : undefined,
  };
  window.__captureEpoch = (window.__captureEpoch ?? 0) + 1;

  const transcripts: string[] = [];
  const alternatives: string[][] = [];
  let lastResultAt = performance.now();
  let closed = false;

  const meter = await startLevelMeter();
  opts.onListening?.(true);

  return new Promise<CaptureResult>((resolve) => {
    let rec: SpeechRecognitionLike | null = null;

    const finish = () => {
      if (closed) return;
      closed = true;
      opts.onListening?.(false);
      try {
        rec?.abort();
      } catch {
        /* already stopped */
      }
      clearTimeout(hardStop);
      clearInterval(silencePoll);
      const voiceActivityMs = meter ? meter.stop() : null;
      resolve({
        transcripts,
        alternatives,
        text: transcripts.join(' '),
        voiceActivityMs,
      });
    };

    const startRecognition = () => {
      if (closed) return;
      try {
        rec = new Ctor();
      } catch {
        finish();
        return;
      }
      rec.lang = 'en-US';
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 5;
      rec.onresult = (ev) => {
        for (let i = 0; i < ev.results.length; i++) {
          const res = ev.results[i];
          if (res.isFinal) {
            const alts: string[] = [];
            for (let j = 0; j < res.length; j++) alts.push(res[j].transcript);
            const best = alts[0] ?? '';
            // Recognizers replay earlier finals after restarts; dedupe exact repeats.
            if (best && transcripts[transcripts.length - 1] !== best) {
              transcripts.push(best);
              alternatives.push(alts);
            }
            lastResultAt = performance.now();
          } else if (res[0]?.transcript) {
            opts.onInterim?.(res[0].transcript);
            lastResultAt = performance.now();
          }
        }
      };
      rec.onerror = () => {
        /* handled by onend restart */
      };
      rec.onend = () => {
        if (!closed) setTimeout(startRecognition, 150);
      };
      try {
        rec.start();
      } catch {
        setTimeout(startRecognition, 300);
      }
    };

    const hardStop = setTimeout(finish, opts.maxMs);
    const silencePoll = setInterval(() => {
      if (
        opts.silenceStopMs &&
        transcripts.length > 0 &&
        performance.now() - lastResultAt > opts.silenceStopMs
      ) {
        finish();
      }
    }, 250);

    startRecognition();
  });
}

interface LevelMeter {
  stop: () => number;
}

/** Microphone RMS meter: accumulates ms of frames above a speech threshold. */
async function startLevelMeter(): Promise<LevelMeter | null> {
  try {
    if (!navigator.mediaDevices?.getUserMedia) return null;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const ctx = new AudioContext();
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    src.connect(analyser);
    const buf = new Float32Array(analyser.fftSize);
    let activeMs = 0;
    let last = performance.now();
    const timer = setInterval(() => {
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) sum += v * v;
      const rms = Math.sqrt(sum / buf.length);
      const now = performance.now();
      if (rms > 0.015) activeMs += now - last;
      last = now;
    }, 50);
    return {
      stop: () => {
        clearInterval(timer);
        stream.getTracks().forEach((t) => t.stop());
        void ctx.close();
        return Math.round(activeMs);
      },
    };
  } catch {
    return null;
  }
}
