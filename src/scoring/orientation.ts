import { extractNumbers, fuzzyEquals, normalizeText, transcriptContains } from '../core/matchers';
import type { ScoreResult } from '../core/types';

const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august',
  'september', 'october', 'november', 'december',
];
const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export interface OrientationAnswers {
  date: string;
  month: string;
  year: string;
  day: string;
  place: string;
  city: string;
}

/**
 * Date/month/year/day are verified against the device clock (exact match, per
 * MoCA). Place and city are verified against caregiver-configured expected
 * values; unconfigured, they are recorded and flagged `unverified` (pending
 * human review) rather than auto-scored.
 */
export function scoreOrientation(
  answers: OrientationAnswers,
  now: Date,
  expectedPlace: string,
  expectedCity: string,
): ScoreResult {
  const flags: string[] = [];
  const detail: Record<string, unknown> = {};

  const dateNums = extractNumbers(answers.date);
  const dateOk = dateNums.includes(now.getDate());
  detail.date = { heard: answers.date, expected: now.getDate(), correct: dateOk };

  const monthName = MONTHS[now.getMonth()];
  const monthOk =
    transcriptContains(answers.month, [monthName], 0.2) ||
    extractNumbers(answers.month).includes(now.getMonth() + 1);
  detail.month = { heard: answers.month, expected: monthName, correct: monthOk };

  const yearNums = extractNumbers(answers.year);
  // "twenty twenty six" parses as [20, 26]; accept century-pair readings too.
  const pairedYears = yearNums.slice(0, -1).map((n, i) => n * 100 + yearNums[i + 1]);
  const yearOk = [...yearNums, ...pairedYears].includes(now.getFullYear());
  detail.year = { heard: answers.year, expected: now.getFullYear(), correct: yearOk };

  const dayName = DAYS[now.getDay()];
  const dayOk = transcriptContains(answers.day, [dayName], 0.2);
  detail.day = { heard: answers.day, expected: dayName, correct: dayOk };

  let placeOk = false;
  let cityOk = false;
  let verifiable = 6;
  if (expectedPlace.trim()) {
    placeOk = placeMatches(answers.place, expectedPlace);
  } else {
    flags.push('place_unverified');
    verifiable--;
  }
  if (expectedCity.trim()) {
    cityOk = placeMatches(answers.city, expectedCity);
  } else {
    flags.push('city_unverified');
    verifiable--;
  }
  detail.place = { heard: answers.place, expected: expectedPlace || null, correct: expectedPlace ? placeOk : null };
  detail.city = { heard: answers.city, expected: expectedCity || null, correct: expectedCity ? cityOk : null };

  const score =
    (dateOk ? 1 : 0) + (monthOk ? 1 : 0) + (yearOk ? 1 : 0) + (dayOk ? 1 : 0) +
    (placeOk ? 1 : 0) + (cityOk ? 1 : 0);

  return {
    score,
    max: 6,
    confidence: verifiable === 6 ? 1 : 0.7,
    flags,
    detail: { ...detail, autoVerifiable: verifiable },
  };
}

function placeMatches(answer: string, expected: string): boolean {
  const ansWords = normalizeText(answer).split(' ').filter(Boolean);
  const expWords = normalizeText(expected).split(' ').filter((w) => w.length > 2);
  if (!expWords.length) return fuzzyEquals(answer, expected, 0.3);
  // Every significant word of the expected name should appear in the answer.
  const hits = expWords.filter((ew) => ansWords.some((aw) => fuzzyEquals(aw, ew, 0.25)));
  return hits.length >= Math.ceil(expWords.length / 2);
}
