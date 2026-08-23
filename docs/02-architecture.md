# Architecture

## Client-only PWA

The app is a static Vite + React + TypeScript PWA with **no backend**: all administration,
scoring, and storage happen on the device. `vite-plugin-pwa` precaches every asset —
including the ONNX model and the onnxruntime wasm — so after the first load the app runs
fully offline (the one caveat: `webkitSpeechRecognition` on iOS is on-device for supported
languages but should be treated as potentially network-dependent).

```
┌───────────────────────────── iPad Safari / Home-Screen PWA ─────────────────────────────┐
│                                                                                          │
│  App.tsx ── phase machine: setup → onboarding → item[0..12] → results                    │
│     │                                                                                    │
│     ├── screens/Setup        caregiver config (education, expected place/city)           │
│     ├── screens/Onboarding   hearing check → pen check → start gate                      │
│     ├── items/*              one component per MoCA item                                 │
│     │      │                                                                             │
│     │      ├── core/voiceGuide      TTS + captions + 1/sec sequenced lists               │
│     │      ├── core/speechCapture   ASR wrapper + auto-restart + mic level meter         │
│     │      ├── components/DrawingCanvas   pen/mouse strokes, pressure, coalesced events  │
│     │      └── scoring/*            pure scorers → {score, confidence, flags, detail}    │
│     │             └── core/digitClassifier  ONNX Runtime Web (wasm) → digits.onnx        │
│     └── screens/Results      per-item table, review flags, JSON export                   │
│                                                                                          │
│  core/session  IndexedDB (idb): Session / ItemResult / raw responses                     │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

## Test flow

`App.tsx` holds a simple explicit phase machine. Each item component receives a single
`onComplete(result)` callback and internally runs its own flow (instruct → capture →
score) as one async function (`useRunOnce`), so the timing structure of an item reads
top-to-bottom like the examiner script it replaces. The session is persisted to IndexedDB
after every item.

Items run in the standard MoCA order — registration early, delayed recall late — and the
app's deterministic pacing keeps the registration→recall delay inside the protocol window
without an examiner watching a clock.

## Data model (`src/core/types.ts`)

- `Session { id, startedAt, config { educationYears, expectedPlace, expectedCity }, results[], totalScore, flags[] }`
- `ItemResult { itemId, score, max, confidence, flags[], detail, response, startedAt, finishedAt }`
- `Stroke { points: {x, y, t, pressure}[], pointerType }` — logical canvas coordinates
- Speech responses keep `transcripts[]` **and** `alternatives[][]` (top-5 per utterance)

`confidence < 0.6` or any flag rolls up to a session-level `review:<itemId>` flag at
finalization (`finalizeSession`). The +1 education adjustment (≤ 12 years) is applied there,
never exceeding 30.

## Stylus capture

`DrawingCanvas` listens to Pointer Events, accepts `pen` and `mouse` (desktop/dev), and
ignores `touch` on the canvas — belt-and-braces palm rejection on top of iPadOS's own.
`getCoalescedEvents()` recovers the full ~240 Hz Pencil sample stream; each point records
time and pressure. `touch-action: none` prevents scroll/zoom gestures from fighting the pen.

## Deployment

Static host; Vercel config included (`vercel.json`: build → `dist/`, SPA rewrites, immutable
cache for models). HTTPS is required for microphone access. Install to home screen for
fullscreen and more durable storage (browser-tab IndexedDB is subject to iOS's 7-day
inactivity eviction — the results screen prompts export after each session for this reason).
