import { openDB, type IDBPDatabase } from 'idb';
import type { ItemResult, Session, SessionConfig } from './types';
import { REVIEW_CONFIDENCE_THRESHOLD } from './types';

const DB_NAME = 'moca-auto';
const STORE = 'sessions';

let dbPromise: Promise<IDBPDatabase> | null = null;

function db(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(d) {
        d.createObjectStore(STORE, { keyPath: 'id' });
      },
    });
  }
  return dbPromise;
}

export function newSession(config: SessionConfig): Session {
  return {
    id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    startedAt: Date.now(),
    appVersion: '0.1.0',
    config,
    results: [],
    flags: [],
  };
}

export async function saveSession(session: Session): Promise<void> {
  try {
    await (await db()).put(STORE, session);
  } catch {
    // Storage failure must never interrupt a test in progress.
  }
}

export async function listSessions(): Promise<Session[]> {
  try {
    const all = (await (await db()).getAll(STORE)) as Session[];
    return all.sort((a, b) => b.startedAt - a.startedAt);
  } catch {
    return [];
  }
}

/** Compute totals and roll up review flags once all items are complete. */
export function finalizeSession(session: Session): Session {
  const totalScore = session.results.reduce((a, r) => a + r.score, 0);
  const totalMax = session.results.reduce((a, r) => a + r.max, 0);
  const educationAdjusted =
    session.config.educationYears !== null && session.config.educationYears <= 12 && totalScore < 30;
  const flags = [
    ...session.flags,
    ...session.results
      .filter((r) => r.confidence < REVIEW_CONFIDENCE_THRESHOLD || r.flags.length > 0)
      .map((r) => `review:${r.itemId}`),
  ];
  return {
    ...session,
    finishedAt: Date.now(),
    totalScore: totalScore + (educationAdjusted ? 1 : 0),
    totalMax,
    educationAdjusted,
    flags: [...new Set(flags)],
  };
}

/** Serialize a session (raw responses included) for export/clinician review. */
export function exportSessionJson(session: Session): string {
  return JSON.stringify(
    {
      disclaimer:
        'Screening aid only. Not a diagnostic instrument. Results must be interpreted by a qualified clinician.',
      ...session,
    },
    null,
    2,
  );
}

export function downloadSession(session: Session): void {
  const blob = new Blob([exportSessionJson(session)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cognitive-screen-${session.id}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function addResult(session: Session, result: ItemResult): Session {
  return { ...session, results: [...session.results.filter((r) => r.itemId !== result.itemId), result] };
}
