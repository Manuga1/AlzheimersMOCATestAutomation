import { downloadSession } from '../core/session';
import type { Session } from '../core/types';
import { REVIEW_CONFIDENCE_THRESHOLD } from '../core/types';

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
  return (
    <div className="screen" data-testid="results">
      <h1>
        Session complete — score{' '}
        <span data-testid="total-score">
          {session.totalScore} / {session.totalMax}
        </span>
      </h1>
      {session.educationAdjusted && (
        <p className="muted">Includes +1 education adjustment (≤ 12 years of education).</p>
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
              <td>
                {r.max > 0 ? `${r.score} / ${r.max}` : '—'}
              </td>
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
      {needsReview.length > 0 && (
        <p className="disclaimer">
          {needsReview.length} task{needsReview.length > 1 ? 's' : ''} flagged for human review — automated
          scores for flagged items are provisional.
        </p>
      )}
      <div className="disclaimer">
        <strong>Screening aid only.</strong> This result is not a diagnosis. A standard score of 26+ is
        typically considered within normal range on examiner-administered MoCA, but this automated
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
