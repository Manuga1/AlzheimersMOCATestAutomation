# Clinical Validity & Privacy

## Positioning

**Screening aid. Not diagnostic. Not the licensed MoCA. Not validated.** The app repeats
this on the setup screen, the results screen, and inside every exported report. A standard
MoCA cutoff (26/30) is mentioned on the results screen only as context for the clinician who
receives the export — the app itself never renders a normal/impaired judgment.

## Regulatory & licensing

- The MoCA instrument, stimuli, and name are property of mocatest.org; clinical deployment
  requires their license/certification program (or validated replacement stimuli). This
  build uses structure + public scoring rules with stand-in stimuli (emoji animals) and is
  suitable for research and engineering evaluation.
- Marketed for clinical decision-making, this would likely qualify as FDA SaMD (and MDR in
  the EU); a validation study under IRB and an intended-use statement come first
  ([docs/07](07-roadmap.md)).

## Known validity gaps (deliberately surfaced, not hidden)

| Gap | Handling |
|---|---|
| ASR quality on elderly/impaired speech | level-meter cross-check, `asr_undercount_suspected` flags, no hard zeros on suspected dropouts |
| Sentence exact-match conflates ASR error with patient error | scored via alternatives; near-misses score *with* review flag |
| Drawing heuristics operationalize “approximately correct” with fixed thresholds | thresholds documented in code; borderline results flagged; CNN arbitration planned |
| Tap-to-connect trail vs drawn line; glass vs paper drawing feel | low-impact deviations, documented; digital trail/clock tasks are well precedented (dCDT/DctClock literature) |
| Orientation place/city unverifiable without configuration | caregiver setup screen; else excluded from auto-score with `unverified` flags |
| Practice effects / fixed stimuli | single fixed form; alternate forms (7.2/7.3-style) are licensed content — retest intervals must be respected |
| Self-reported education | recorded as-is; noted in export |

## Accessibility

- Every spoken prompt has a synchronized caption (deaf/hard-of-hearing path — note this
  changes vigilance and memory items' modality; captions during those items show only the
  current stimulus exactly as speech does).
- Large touch targets (≥ 60 px), high-contrast palette, no time-pressure countdowns.
- Onboarding gates: hearing check and pen check must pass before testing starts; failure
  instructs the participant to get a helper rather than starting a doomed session.
- Not served: severe combined vision+hearing impairment, non-English speakers (single-locale
  build today).

## Privacy & security

- **Everything stays on the device.** No backend, no analytics, no third-party requests.
  Speech recognition uses the OS recognizer (on-device for supported languages on modern
  iOS; treated as potentially network-mediated in the docs for honesty).
- Session data (scores + raw responses) lives in IndexedDB; export is an explicit user
  action producing a JSON file via the share sheet. Deleting the PWA deletes the data.
- Raw audio is **not recorded** in this build. The planned re-scoring pipeline
  ([docs/07](07-roadmap.md)) would add opt-in audio retention behind its own consent screen.
- Results are shown at session end for the participant/caregiver to export; a passcode gate
  for score visibility (so a participant isn't confronted with a number without counseling
  context) is a planned configuration.
- iOS evicts browser-tab IndexedDB after 7 days of disuse — the results screen prompts
  export after every session, and home-screen installation reduces the risk.
