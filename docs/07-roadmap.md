# Roadmap

## Shipped (this repo)

- Full 13-item hands-free session: voice guide with captions, deterministic pacing,
  onboarding gates, per-item fallback ladders, review-flag system.
- Deterministic scorers (trail, vigilance, digit span, serial 7s, orientation-to-time),
  language scorers (naming, recall, fluency, sentences, abstraction), drawing heuristics
  (clock contour/hands, cube), and the clock-digit CNN in-browser via ONNX.
- IndexedDB persistence, JSON export, education adjustment, PWA offline build, Vercel config.
- 54 unit tests over every scorer (synthetic stroke fixtures for clock/cube) and two
  Playwright end-to-end sessions (a perfect 30/30 run and an impaired 4/30 run) driving the
  real production build through all 13 items.

## Phase 2 — speech robustness

- Record raw audio (opt-in consent) for all speech items → clinician re-listening and
  re-scoring.
- Spike: `webkitSpeechRecognition` vs Whisper-tiny ONNX (WebGPU) on elderly speech corpora;
  adopt the winner as a pluggable `SpeechCapture` backend.
- Pre-recorded professional voice clips with word-timestamp manifest replacing device TTS.
- Session resume after tab kill (state machine already persists per item).

## Phase 3 — drawing models

- Clock quality CNN (NHANES/CDT datasets) arbitrating borderline contour/hand judgments.
- Cube quality classifier from opt-in collected drawings with human labels.
- EMNIST fine-tuning of the digit model on collected clock-face glyphs (real elderly
  handwriting, two-digit composition).

## Phase 4 — clinical evaluation

- IRB-approved validation study: n ≥ 100, age 65+, concurrent standard MoCA by a blinded
  certified rater; agreement (κ, ICC), sensitivity/specificity at the 26-point cutoff;
  per-item automated-vs-human agreement to find weak scorers.
- Licensing decision with mocatest.org (official stimuli) or validated replacement stimuli.
- Regulatory pathway assessment (FDA SaMD pre-sub) if clinical marketing is pursued.

## Engineering backlog

- Localization framework (prompts, matchers, and word lists are locale-coupled).
- Configurable strictness (e.g., trail any-error-fails mode).
- Passcode-gated results screen; encrypted export.
- Alternate stimulus forms to blunt practice effects on retest.
