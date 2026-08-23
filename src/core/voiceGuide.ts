/**
 * Voice guide: delivers every instruction aloud via speech synthesis with
 * synchronized on-screen captions (accessibility for hearing-impaired users).
 * speakSequence paces item lists (memory words, digits, vigilance letters) at
 * a fixed cadence — a fidelity advantage over variable human examiners — and
 * reports each item's onset time so vigilance can be scored deterministically.
 *
 * When speechSynthesis is unavailable (or in automated tests) a timer-based
 * fallback keeps the flow fully functional; captions carry the content.
 */

export type CaptionListener = (caption: string | null) => void;

declare global {
  interface Window {
    /** Test hook: scales all voice-guide durations (e.g. 0.05 in e2e). */
    __ttsTimeScale?: number;
  }
}

export class VoiceGuide {
  private listeners = new Set<CaptionListener>();
  private cancelled = false;

  onCaption(fn: CaptionListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(caption: string | null): void {
    for (const fn of this.listeners) fn(caption);
  }

  private get timeScale(): number {
    return typeof window !== 'undefined' && window.__ttsTimeScale ? window.__ttsTimeScale : 1;
  }

  cancel(): void {
    this.cancelled = true;
    try {
      window.speechSynthesis?.cancel();
    } catch {
      /* no speech synthesis */
    }
    this.emit(null);
  }

  /** Speak a full instruction; resolves when the audio finishes. */
  async speak(text: string): Promise<void> {
    this.cancelled = false;
    this.emit(text);
    await this.utter(text);
    this.emit(null);
  }

  /**
   * Speak items one per `intervalMs` (protocol: 1 per second for word lists,
   * digits, and vigilance letters). onItemStart receives performance.now() at
   * each item's onset — the timeline used by the vigilance scorer.
   */
  async speakSequence(
    items: string[],
    intervalMs: number,
    onItemStart?: (item: string, t: number) => void,
  ): Promise<void> {
    this.cancelled = false;
    for (const item of items) {
      if (this.cancelled) return;
      // Clear the caption first so repeated items (e.g. "A", "A") still
      // produce a visible caption change for each occurrence.
      this.emit(null);
      await sleep(10);
      const start = performance.now();
      onItemStart?.(item, start);
      this.emit(item);
      await this.utter(item);
      const elapsed = performance.now() - start;
      const remaining = intervalMs * this.timeScale - elapsed;
      if (remaining > 0) await sleep(remaining);
    }
    this.emit(null);
  }

  private utter(text: string): Promise<void> {
    return new Promise((resolve) => {
      const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
      const fallbackMs = Math.max(400, text.length * 55) * this.timeScale;
      if (!synth || typeof SpeechSynthesisUtterance === 'undefined') {
        setTimeout(resolve, fallbackMs);
        return;
      }
      let done = false;
      const finish = () => {
        if (!done) {
          done = true;
          resolve();
        }
      };
      try {
        const u = new SpeechSynthesisUtterance(text);
        u.rate = 0.9; // slightly slower for older adults
        u.pitch = 1;
        u.onend = finish;
        u.onerror = finish;
        synth.speak(u);
        // Safari sometimes drops onend; hard ceiling keeps the flow alive.
        setTimeout(finish, Math.max(fallbackMs * 3, 15000 * this.timeScale));
      } catch {
        setTimeout(finish, fallbackMs);
      }
    });
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export const voiceGuide = new VoiceGuide();
