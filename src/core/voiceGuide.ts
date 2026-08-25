/**
 * Voice guide: delivers every instruction aloud. Playback chain per utterance:
 *
 *  1. Pre-recorded clip from /audio/manifest.json (natural neural-TTS voice,
 *     generated offline by ml/generate_audio.py) when one exists;
 *  2. speechSynthesis fallback, with capitals normalized so engines never
 *     announce "capital A";
 *  3. deterministic timer fallback (no audio available / automated tests).
 *
 * Nothing spoken is ever rendered on screen — patients must listen, not read
 * (PI requirement; showing stimuli like the vigilance letters or memory words
 * would invalidate those items). Each utterance start dispatches a
 * `moca:speech` CustomEvent for test harnesses.
 *
 * speakSequence paces item lists (memory words, digits, vigilance letters) at
 * a fixed cadence and reports each item's onset time — the timeline used for
 * deterministic vigilance scoring.
 */

declare global {
  interface Window {
    /** Test hook: scales all voice-guide durations (e.g. 0.15 in e2e). */
    __ttsTimeScale?: number;
  }
}

type ClipManifest = Record<string, string>;

/** Manifest keys are normalized utterance text. */
export function clipKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** TTS engines read "A" / "FACE" as "capital ..."; speak lowercase instead. */
function normalizeForTts(text: string): string {
  return text.replace(/\b[A-Z]\b/g, (m) => m.toLowerCase()).replace(/\b[A-Z]{2,}\b/g, (m) => m.toLowerCase());
}

export class VoiceGuide {
  private cancelled = false;
  private manifest: ClipManifest | null | undefined;
  private currentAudio: HTMLAudioElement | null = null;

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
    try {
      this.currentAudio?.pause();
    } catch {
      /* no clip playing */
    }
    this.currentAudio = null;
  }

  /** Speak a full instruction; resolves when the audio finishes. */
  async speak(text: string): Promise<void> {
    this.cancelled = false;
    await this.utter(text);
  }

  /**
   * Speak items one per `intervalMs` (protocol: 1 per second for word lists,
   * digits, and vigilance letters). onItemStart receives performance.now() at
   * each item's onset. Items are spoken only — never displayed.
   */
  async speakSequence(
    items: string[],
    intervalMs: number,
    onItemStart?: (item: string, t: number) => void,
  ): Promise<void> {
    this.cancelled = false;
    for (const item of items) {
      if (this.cancelled) return;
      const start = performance.now();
      onItemStart?.(item, start);
      await this.utter(item);
      const elapsed = performance.now() - start;
      const remaining = intervalMs * this.timeScale - elapsed;
      if (remaining > 0) await sleep(remaining);
    }
  }

  private async utter(text: string): Promise<void> {
    try {
      window.dispatchEvent(new CustomEvent('moca:speech', { detail: { text } }));
    } catch {
      /* non-browser environment */
    }
    // Automated tests force the deterministic timer path.
    if (this.timeScale !== 1) {
      await sleep(Math.max(60, text.length * 55) * this.timeScale);
      return;
    }
    if (await this.playClip(text)) return;
    await this.speakWithTts(text);
  }

  private async loadManifest(): Promise<ClipManifest | null> {
    if (this.manifest !== undefined) return this.manifest;
    try {
      const res = await fetch('/audio/manifest.json');
      this.manifest = res.ok ? ((await res.json()) as ClipManifest) : null;
    } catch {
      this.manifest = null;
    }
    return this.manifest;
  }

  /** Returns true when a pre-recorded clip existed and finished playing. */
  private async playClip(text: string): Promise<boolean> {
    const manifest = await this.loadManifest();
    const file = manifest?.[clipKey(text)];
    if (!file) return false;
    return new Promise<boolean>((resolve) => {
      let done = false;
      const finish = (ok: boolean) => {
        if (!done) {
          done = true;
          this.currentAudio = null;
          resolve(ok);
        }
      };
      try {
        const audio = new Audio(`/audio/${file}`);
        this.currentAudio = audio;
        audio.onended = () => finish(true);
        audio.onerror = () => finish(false);
        audio.onpause = () => {
          if (audio.ended === false && this.cancelled) finish(true);
        };
        void audio.play().catch(() => finish(false));
        setTimeout(() => finish(true), 30000); // safety ceiling
      } catch {
        finish(false);
      }
    });
  }

  private speakWithTts(text: string): Promise<void> {
    return new Promise((resolve) => {
      const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
      const fallbackMs = Math.max(400, text.length * 55);
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
        const u = new SpeechSynthesisUtterance(normalizeForTts(text));
        u.rate = 0.9; // slightly slower for older adults
        u.pitch = 1;
        u.onend = finish;
        u.onerror = finish;
        synth.speak(u);
        // Safari sometimes drops onend; hard ceiling keeps the flow alive.
        setTimeout(finish, Math.max(fallbackMs * 3, 15000));
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
