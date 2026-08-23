export interface StrokePoint {
  x: number;
  y: number;
  t: number;
  pressure: number;
}

export interface Stroke {
  points: StrokePoint[];
  pointerType: string;
}

export interface TapEvent {
  x: number;
  y: number;
  t: number;
}

/** Output of every scorer: score plus confidence and review flags. */
export interface ScoreResult {
  score: number;
  max: number;
  /** 0..1 — below ~0.6 the item is flagged for human review. */
  confidence: number;
  flags: string[];
  detail?: Record<string, unknown>;
}

export interface ItemResult extends ScoreResult {
  itemId: ItemId;
  /** Raw captured response (strokes, transcripts, taps, typed text). */
  response?: unknown;
  startedAt: number;
  finishedAt: number;
}

export type ItemId =
  | 'trail'
  | 'cube'
  | 'clock'
  | 'naming'
  | 'registration'
  | 'digitspan'
  | 'vigilance'
  | 'serial7'
  | 'sentence'
  | 'fluency'
  | 'abstraction'
  | 'recall'
  | 'orientation';

export interface SessionConfig {
  participantId: string;
  educationYears: number | null;
  /** Expected answers for orientation-to-place, entered by caregiver at setup. */
  expectedPlace: string;
  expectedCity: string;
}

export interface Session {
  id: string;
  startedAt: number;
  finishedAt?: number;
  appVersion: string;
  config: SessionConfig;
  results: ItemResult[];
  totalScore?: number;
  totalMax?: number;
  educationAdjusted?: boolean;
  flags: string[];
}

export const REVIEW_CONFIDENCE_THRESHOLD = 0.6;
