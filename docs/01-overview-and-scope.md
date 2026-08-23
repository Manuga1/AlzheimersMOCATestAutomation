# Overview & Scope

## Goal

An automated adaptation of the MoCA (Montreal Cognitive Assessment) that a person can take
**alone with an iPad and a stylus**: a voice guide administers every item, all responses are
captured digitally, and scoring is automated. The examiner's three roles — instructing,
timing/pacing, and judging responses — are replaced respectively by the voice guide, by
deterministic timers (often *more* protocol-faithful than a human, e.g. word lists at exactly
one word per second), and by the scoring engines described in
[docs/03](03-items-and-scoring.md).

## What this is not

- **Not the licensed MoCA.** The MoCA instrument is copyrighted (mocatest.org requires
  training/licensing). This project follows the *structure and scoring rules* of the public
  MoCA specification for research/engineering purposes. A clinical deployment needs either a
  license for the official stimuli or validated replacement stimuli (word lists, sentences,
  images). The animal images used here are emoji stand-ins for exactly this reason.
- **Not a diagnostic device.** It is a screening aid. Marketed clinically it would likely be
  FDA Software-as-a-Medical-Device; current wording keeps it in research/wellness territory.
- **Not clinically validated.** Threshold choices in the drawing heuristics and the
  ASR-dependent items are engineering operationalizations of the paper rules and require
  a validation study against human raters ([docs/07](07-roadmap.md)).

## Fidelity philosophy

Every deviation from the standardized administration is (a) minimized, (b) recorded as a
per-item flag, and (c) documented. Three principles:

1. **Fail toward review, not toward impairment.** When automation is uncertain (ASR may have
   dropped words, a drawing is borderline), the item is flagged `review:*` with reduced
   confidence instead of silently scoring 0. False "impaired" signals are the worst failure
   mode of an unattended screen.
2. **Never change the construct silently.** Recognition is not recall, so delayed recall has
   *no* word-bank fallback; a picker would cue orientation answers, so fallbacks are blank
   typing only; sentence repetition has no typed fallback at all (flagged `not_administered`).
   Where a fallback is construct-preserving (keypad for digits), it is allowed but flagged.
3. **Keep the raw data.** Strokes (with time/pressure/tilt), transcripts (with alternatives),
   and tap timelines are stored and exported so every score can be re-derived, audited, or
   re-scored by better models later.

## The five honestly-hard problems

1. **Delayed recall & registration via on-device ASR** — isolated single words from elderly
   voices are ASR's weakest case, and delayed recall is worth 5/30 points. Mitigations: a
   parallel mic level meter flags "spoke but nothing transcribed" (`asr_undercount_suspected`),
   and the protocol-sanctioned unscored cue phase doubles as a data-recovery path.
2. **Serial 7s over ASR** — five short numeric utterances with thinking pauses across
   recognizer restarts. Mitigations: number-word parsing, one permitted reminder, flagged
   keypad fallback.
3. **Verbal fluency undercounting** — the recognizer dropping valid F-words biases toward
   false impairment; the level-meter cross-check flags suspected undercounts for review.
4. **Orientation to place/city** — fundamentally unverifiable by the device. Solved
   organizationally: the caregiver enters the expected place/city at setup; unconfigured,
   those two points are recorded, excluded from auto-scoring, and flagged `unverified`.
5. **Clinical-fidelity 0/1 judgments on cube and clock** — heuristics are explainable but
   brittle against legitimate drawing styles; the clock "numbers" point inherently requires
   handwriting recognition (hence the digit CNN from day one). Borderline results carry
   `borderline_*` flags and reduced confidence.
