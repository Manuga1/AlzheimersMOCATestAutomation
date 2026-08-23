/** Text matching utilities for speech-recognized responses. */

export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[n];
}

/** Normalized edit distance ≤ maxNorm counts as a match. */
export function fuzzyEquals(word: string, target: string, maxNorm = 0.25): boolean {
  const a = normalizeText(word);
  const b = normalizeText(target);
  if (!a || !b) return false;
  if (a === b) return true;
  const d = levenshtein(a, b);
  return d / Math.max(a.length, b.length) <= maxNorm;
}

/** Does any word (or bigram) of the transcript fuzzily match any accepted form? */
export function transcriptContains(transcript: string, accepted: string[], maxNorm = 0.25): boolean {
  const words = normalizeText(transcript).split(' ').filter(Boolean);
  const grams = [...words];
  for (let i = 0; i < words.length - 1; i++) grams.push(`${words[i]} ${words[i + 1]}`);
  return grams.some((g) => accepted.some((t) => fuzzyEquals(g, t, maxNorm)));
}

const UNITS: Record<string, number> = {
  zero: 0, oh: 0, one: 1, won: 1, two: 2, to: 2, too: 2, three: 3, four: 4, for: 4,
  five: 5, six: 6, seven: 7, eight: 8, ate: 8, nine: 9, ten: 10, eleven: 11,
  twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19,
};
const TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70,
  eighty: 80, ninety: 90,
};
const ORDINALS: Record<string, number> = {
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7,
  eighth: 8, ninth: 9, tenth: 10, eleventh: 11, twelfth: 12, thirteenth: 13,
  fourteenth: 14, fifteenth: 15, sixteenth: 16, seventeenth: 17,
  eighteenth: 18, nineteenth: 19, twentieth: 20, thirtieth: 30,
};

/**
 * Extract whole numbers from a spoken transcript, combining number words
 * ("ninety three" → 93, "one hundred" → 100, "two thousand twenty six" →
 * 2026, "twenty third" → 23) and numerals ("93", "23rd").
 */
export function extractNumbers(transcript: string): number[] {
  const tokens = normalizeText(transcript).replace(/-/g, ' ').split(' ').filter(Boolean);
  const out: number[] = [];
  let current: number | null = null;
  let lastWasTens = false;
  let afterMultiplier = false;

  const flush = () => {
    if (current !== null) out.push(current);
    current = null;
    lastWasTens = false;
    afterMultiplier = false;
  };

  for (const tok of tokens) {
    const numeral = /^(\d+)(st|nd|rd|th)?$/.exec(tok);
    if (numeral) {
      flush();
      out.push(parseInt(numeral[1], 10));
    } else if (tok in TENS) {
      if (afterMultiplier) {
        current = (current ?? 0) + TENS[tok];
      } else {
        flush();
        current = TENS[tok];
      }
      lastWasTens = true;
      afterMultiplier = false;
    } else if (tok in UNITS || tok in ORDINALS) {
      const v = tok in UNITS ? UNITS[tok] : ORDINALS[tok];
      if (lastWasTens && v < 10) {
        current = (current ?? 0) + v;
        lastWasTens = false;
      } else if (afterMultiplier && v < 100) {
        current = (current ?? 0) + v;
        afterMultiplier = false;
      } else {
        flush();
        current = v;
      }
      if (tok in ORDINALS) flush();
    } else if (tok === 'hundred') {
      current = (current ?? 1) * 100;
      lastWasTens = false;
      afterMultiplier = true;
    } else if (tok === 'thousand') {
      current = (current ?? 1) * 1000;
      lastWasTens = false;
      afterMultiplier = true;
    } else if (tok === 'and') {
      continue;
    } else {
      flush();
    }
  }
  flush();
  return out;
}

/**
 * Extract a digit sequence (0-9 each) from speech or typed input:
 * "two one eight five four" → [2,1,8,5,4]; "21854" → [2,1,8,5,4].
 * Used for digit span, where each spoken token is one digit.
 */
export function extractDigitSequence(transcript: string): number[] {
  const tokens = normalizeText(transcript).replace(/-/g, ' ').split(' ').filter(Boolean);
  const out: number[] = [];
  for (const tok of tokens) {
    if (/^\d+$/.test(tok)) {
      for (const ch of tok) out.push(parseInt(ch, 10));
    } else if (tok in UNITS && UNITS[tok] <= 9) {
      out.push(UNITS[tok]);
    }
  }
  return out;
}

/** Very small stemmer for fluency dedup: strips common suffixes. */
export function crudeStem(word: string): string {
  let w = normalizeText(word);
  for (const suf of ['ings', 'ing', 'ers', 'er', 'ies', 'es', 's', 'ed']) {
    if (w.length > 3 + suf.length && w.endsWith(suf)) {
      w = w.slice(0, -suf.length);
      break;
    }
  }
  return w;
}
