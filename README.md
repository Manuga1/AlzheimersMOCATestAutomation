# Automated Cognitive Screen (MoCA-structure)

A fully self-administered, MoCA-structure cognitive screening app for **iPad + Apple Pencil**.
A voice guide delivers every instruction; the participant answers by **speaking, tapping, and
drawing** — no examiner is present during testing. Scoring is automated: deterministic
algorithms where possible, stroke-geometry heuristics for the drawing tasks, and a
**CNN (trained in PyTorch, running in-browser via ONNX Runtime Web)** for handwritten
digit recognition on the clock face.

> **Screening aid only.** This is not the licensed MoCA®, not a diagnostic instrument, and
> not a substitute for clinical evaluation. It has not been clinically validated. Results must
> be interpreted by a qualified professional. See
> [docs/06-clinical-validity-privacy.md](docs/06-clinical-validity-privacy.md).

## What it does

All 13 MoCA-structure items (30 points), administered hands-free:

| # | Item | Input | Scoring |
|---|------|-------|---------|
| 1 | Trail making (1-A-2-B…) | taps | deterministic sequence machine |
| 2 | Cube copy | stylus | stroke-geometry heuristics |
| 3 | Clock drawing (“ten past eleven”) | stylus | circle fit + hand angles + **digit CNN** |
| 4 | Naming (3 animals) | speech | accept-list fuzzy matching |
| 5 | Memory registration (5 words ×2) | speech | unscored, logged |
| 6 | Digit span (forward/backward) | speech (keypad fallback) | exact sequence match |
| 7 | Vigilance (tap on “A”) | taps | audio-timeline windows |
| 8 | Serial 7s | speech (keypad fallback) | MoCA chaining rule |
| 9 | Sentence repetition | speech | exact match vs ASR alternatives |
| 10 | Verbal fluency (letter F, 60 s) | speech | F-word count w/ stem dedupe |
| 11 | Abstraction | speech | accept/reject keyword ontology |
| 12 | Delayed recall (5 words) | speech | fuzzy free-recall match |
| 13 | Orientation | speech | device clock + caregiver-configured place |

Every scorer emits `{score, confidence, flags}`; anything ambiguous is **flagged for human
review** rather than silently scored. Raw responses (stroke data with pressure/tilt,
transcripts with alternatives, tap timings) are stored and exportable as JSON.

## Stack

- **PWA**: Vite + React + TypeScript, installable, offline after first load (`vite-plugin-pwa`)
- **Stylus**: Pointer Events with coalesced ~240 Hz Pencil sampling, pressure/tilt, palm rejection
- **Voice guide**: speech synthesis with synchronized captions; word lists and letters paced at exactly 1/second
- **Speech input**: `webkitSpeechRecognition` (on-device on iOS) with auto-restart, alternatives, and a mic level meter to distinguish silence from recognizer dropout
- **ML**: LeNet-class digit CNN (98.7% MNIST test accuracy), trained by `ml/train_digits.py`, exported to ONNX (386 KB), inference in-browser via `onnxruntime-web` (wasm)
- **Storage**: IndexedDB, no server, no analytics; JSON export for clinicians

## Develop

```bash
npm install
npm run dev          # local dev server
npm test             # unit tests (scorers, matchers, geometry fixtures)
npm run build        # production build (dist/)
PW_CHROMIUM_PATH=... npx playwright test   # e2e: two full 13-item sessions
```

Retrain the clock-digit CNN (requires `torch`/`torchvision`):

```bash
python3 ml/train_digits.py --epochs 3   # writes public/models/digits.onnx
```

## Deploy (Vercel)

The repo is Vercel-ready: `vercel.json` sets the build (`npm run build` → `dist/`), SPA
rewrites, and cache headers. Just import the repo in Vercel or run `vercel deploy`.
HTTPS (automatic on Vercel) is required for microphone access and speech recognition.

**On the iPad**: open the deployed URL in Safari → Share → *Add to Home Screen*. Launch
from the home screen, allow microphone access, hand the iPad + Pencil to the participant.

## Repository map

```
src/core/       voice guide, speech capture, session store, geometry, CNN loader
src/scoring/    one scorer per item + synthetic stroke fixtures + tests
src/items/      one React component per test item
src/screens/    caregiver setup, onboarding checks, results
ml/             PyTorch training script for the digit CNN
e2e/            Playwright full-session tests (perfect run + impaired run)
docs/           design documentation (architecture, items, ML, validity, roadmap)
```

## Documentation

1. [Overview & scope](docs/01-overview-and-scope.md)
2. [Architecture](docs/02-architecture.md)
3. [Items & scoring spec](docs/03-items-and-scoring.md)
4. [Speech & voice subsystems](docs/04-speech-and-voice.md)
5. [CNN pipeline](docs/05-cnn-pipeline.md)
6. [Clinical validity & privacy](docs/06-clinical-validity-privacy.md)
7. [Roadmap](docs/07-roadmap.md)
