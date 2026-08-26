import { useState } from 'react';
import { speechAvailable } from '../core/speechCapture';
import type { SessionConfig } from '../core/types';

/**
 * Caregiver/clinician setup, completed BEFORE the iPad is handed over.
 * Education years drives the +1 adjustment; expected place/city make the two
 * orientation-to-place points auto-scorable (unconfigured, they are recorded
 * and flagged for human review).
 */
export function SetupScreen({
  onStart,
}: {
  onStart: (config: SessionConfig, flags: string[]) => void;
}): JSX.Element {
  const [participantId, setParticipantId] = useState('');
  const [education, setEducation] = useState('');
  const [place, setPlace] = useState('');
  const [city, setCity] = useState('');
  const asr = speechAvailable();

  const start = () => {
    const flags: string[] = [];
    if (!asr) flags.push('speech_recognition_unavailable');
    if (!place.trim() || !city.trim()) flags.push('orientation_place_unconfigured');
    onStart(
      {
        participantId: participantId.trim() || 'anonymous',
        educationYears: education.trim() ? parseInt(education, 10) : null,
        expectedPlace: place.trim(),
        expectedCity: city.trim(),
      },
      flags,
    );
  };

  return (
    <div className="screen top-align" data-testid="setup">
      <h1>Cognitive Screen — Setup</h1>
      <p className="muted">To be completed by a caregiver or clinician before handing over the iPad.</p>
      <div className="setup-form">
        <label htmlFor="pid">Participant ID (optional)</label>
        <input id="pid" data-testid="setup-pid" value={participantId} onChange={(e) => setParticipantId(e.target.value)} />
        <label htmlFor="edu">Years of education</label>
        <input
          id="edu"
          data-testid="setup-education"
          inputMode="numeric"
          value={education}
          onChange={(e) => setEducation(e.target.value.replace(/\D/g, ''))}
        />
        <label htmlFor="place">Current place (e.g. clinic or home name)</label>
        <input id="place" data-testid="setup-place" value={place} onChange={(e) => setPlace(e.target.value)} />
        <label htmlFor="city">Current city</label>
        <input id="city" data-testid="setup-city" value={city} onChange={(e) => setCity(e.target.value)} />
      </div>
      {!asr && (
        <p className="disclaimer">
          Speech recognition is not available in this browser. The test will run with touch and typing
          fallbacks; affected items are flagged in the results. On an iPad, use Safari and allow
          microphone access for the intended voice-driven experience.
        </p>
      )}
      <div className="disclaimer">
        <strong>Screening aid only.</strong> This application is not a diagnostic instrument and is not a
        substitute for clinical evaluation. Results must be interpreted by a qualified professional.
      </div>
      <button className="primary" data-testid="setup-start" onClick={start}>
        Continue to sound &amp; pen check
      </button>
    </div>
  );
}
