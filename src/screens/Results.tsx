import { ClockReference, CubeModel, TrailActual, TrailReference } from '../components/references';
import { StrokePreview } from '../components/StrokePreview';
import { downloadSession } from '../core/session';
import type { ItemResult, Session, Stroke } from '../core/types';
import { REVIEW_CONFIDENCE_THRESHOLD } from '../core/types';
import type { TrailTap } from '../scoring/trail';

const ITEM_LABELS: Record<string, string> = {
  trail: 'Trail making',
  cube: 'Cube copy',
  clock: 'Clock drawing',
  naming: 'Naming',
  registration: 'Memory registration (unscored)',
  digitspan: 'Digit span',
  vigilance: 'Vigilance',
  serial7: 'Serial 7s',
  sentence: 'Sentence repetition',
  fluency: 'Verbal fluency',
  abstraction: 'Abstraction',
  recall: 'Delayed recall',
  orientation: 'Orientation',
};

/** Standard MoCA cutoff: 26+ is typically normal; ≤25 prompts follow-up. */
const CUTOFF = 26;

export function ResultsScreen({
  session,
  onRestart,
}: {
  session: Session;
  onRestart: () => void;
}): JSX.Element {
  const needsReview = session.results.filter(
    (r) => r.confidence < REVIEW_CONFIDENCE_THRESHOLD || r.flags.length > 0,
  );
  const total = session.totalScore ?? 0;
  const orientation = session.results.find((r) => r.itemId === 'orientation');
  const pendingPoints =
    (orientation?.flags.includes('place_unverified') ? 1 : 0) +
    (orientation?.flags.includes('city_unverified') ? 1 : 0);

  return (
    <div className="screen" data-testid="results">
      <h1>Session complete</h1>

      <div className="score-card" data-testid="score-card">
        <div className="score-value">
          <span data-testid="total-score">
            {total} / {session.totalMax}
          </span>
        </div>
        <div className="score-caption">Total MoCA-structure score (summed automatically)</div>
        {session.educationAdjusted && (
          <div className="muted">Includes +1 education adjustment (≤ 12 years of education).</div>
        )}
        {pendingPoints > 0 && (
          <div className="muted">
            {pendingPoints} orientation point{pendingPoints > 1 ? 's' : ''} pending human verification
            (place/city not configured at setup) — the total may undercount by up to {pendingPoints}.
          </div>
        )}
      </div>

      {total >= CUTOFF ? (
        <div className="verdict good" data-testid="verdict">
          At or above the standard cutoff of {CUTOFF}. Scores of {CUTOFF - 1} or below on the MoCA
          typically prompt further evaluation; this score is within the typically-normal range.
        </div>
      ) : (
        <div className="verdict warn" data-testid="verdict">
          Below the standard cutoff — a score of {CUTOFF - 1} or less on the MoCA typically prompts
          clinical follow-up for possible cognitive impairment. This is a screening signal, not a
          diagnosis.
        </div>
      )}

      <table className="results-table" data-testid="results-table">
        <thead>
          <tr>
            <th>Task</th>
            <th>Score</th>
            <th>Flags</th>
          </tr>
        </thead>
        <tbody>
          {session.results.map((r) => (
            <tr key={r.itemId} data-testid={`result-${r.itemId}`}>
              <td>{ITEM_LABELS[r.itemId] ?? r.itemId}</td>
              <td>{r.max > 0 ? `${r.score} / ${r.max}` : '—'}</td>
              <td>
                {r.flags.map((f) => (
                  <span key={f} className="flag-chip">
                    {f}
                  </span>
                ))}
                {r.confidence < REVIEW_CONFIDENCE_THRESHOLD && (
                  <span className="flag-chip">low confidence</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <DrawingReview results={session.results} />

      {needsReview.length > 0 && (
        <p className="disclaimer">
          {needsReview.length} task{needsReview.length > 1 ? 's' : ''} flagged for human review — automated
          scores for flagged items are provisional.
        </p>
      )}
      <div className="disclaimer">
        <strong>Screening aid only.</strong> This result is not a diagnosis and this automated
        adaptation has not been clinically validated. Share the exported report with a qualified
        clinician.
      </div>
      <div className="row">
        <button className="primary" data-testid="export" onClick={() => downloadSession(session)}>
          Export report (JSON)
        </button>
        <button className="secondary" onClick={onRestart}>
          New session
        </button>
      </div>
    </div>
  );
}

/**
 * Qualitative review: each drawn response side by side with its reference so
 * the interpreter can judge the drawings directly rather than relying on the
 * automated score.
 */
function DrawingReview({ results }: { results: ItemResult[] }): JSX.Element | null {
  const trail = results.find((r) => r.itemId === 'trail');
  const cube = results.find((r) => r.itemId === 'cube');
  const clock = results.find((r) => r.itemId === 'clock');
  const trailTaps = (trail?.response as TrailTap[] | undefined) ?? null;
  const cubeStrokes = (cube?.response as Stroke[] | undefined) ?? null;
  const clockStrokes = (clock?.response as Stroke[] | undefined) ?? null;
  if (!trailTaps && !cubeStrokes && !clockStrokes) return null;

  return (
    <div className="col" data-testid="drawing-review">
      <h2>Drawing review</h2>
      <p className="muted">
        Reference on the left, the participant's actual response on the right. Automated drawing
        scores are provisional — interpret visually.
      </p>
      {trailTaps && (
        <ReviewPair
          testId="review-trail"
          title={`Trail making — ${trail!.score} / ${trail!.max}`}
          reference={<TrailReference />}
          actual={<TrailActual taps={trailTaps} />}
        />
      )}
      {cubeStrokes && (
        <ReviewPair
          testId="review-cube"
          title={`Cube copy — ${cube!.score} / ${cube!.max}`}
          reference={<CubeModel scale={0.85} />}
          actual={<StrokePreview strokes={cubeStrokes} />}
        />
      )}
      {clockStrokes && (
        <ReviewPair
          testId="review-clock"
          title={`Clock drawing ("ten past eleven") — ${clock!.score} / ${clock!.max}`}
          reference={<ClockReference />}
          actual={<StrokePreview strokes={clockStrokes} />}
        />
      )}
    </div>
  );
}

function ReviewPair({
  testId,
  title,
  reference,
  actual,
}: {
  testId: string;
  title: string;
  reference: JSX.Element;
  actual: JSX.Element;
}): JSX.Element {
  return (
    <div className="review-block" data-testid={testId}>
      <h3 className="review-title">{title}</h3>
      <div className="review-pair">
        <figure className="review-panel">
          {reference}
          <figcaption>Reference</figcaption>
        </figure>
        <figure className="review-panel">
          {actual}
          <figcaption>Participant</figcaption>
        </figure>
      </div>
    </div>
  );
}
