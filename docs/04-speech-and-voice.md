# Speech & Voice Subsystems

## Voice guide (`src/core/voiceGuide.ts`)

The examiner's script is delivered by speech synthesis at rate 0.9 with **synchronized
on-screen captions** (every prompt is simultaneously readable — the accessibility path for
hearing-impaired users and the debugging path for everyone else).

`speakSequence(items, 1000, onItemStart)` paces word lists, digit strings, and the vigilance
letters at exactly one per second and reports each item's onset time. That timeline is what
makes vigilance scoring deterministic: the scorer knows to the millisecond when each “A” was
spoken. A human examiner cannot match this pacing consistency — one of the few places the
automated administration is *more* standardized than the paper one.

Design rules enforced by the state flow:

- **Never listen while speaking** (no barge-in): speak → short gap → listen, so the
  recognizer can't transcribe the app's own voice.
- A pulsing **“Listening… speak now”** indicator is shown whenever the mic is open.
- Stimulus material is read **once** (digit strings, sentences); only neutral reminders
  (“please say your answer now”) may repeat, and only once — matching protocol limits.

Production note: pre-recorded professional voice clips (with a word-level timestamp
manifest) are the intended upgrade over device TTS — consistent prosody and guaranteed
pacing. The `VoiceGuide` interface is built so clips can replace `speechSynthesis` without
touching any item code. When `speechSynthesis` is unavailable the guide falls back to
caption-plus-timer delivery, which is also what the automated tests exercise.

## Speech recognition (`src/core/speechCapture.ts`)

iOS Safari's `webkitSpeechRecognition` has sharp edges, all of which shaped this wrapper:

| iOS Safari behavior | Mitigation |
|---|---|
| Sessions end after short silences; `continuous` unreliable | auto-restart on `end` while the capture window is open |
| Confidence values often absent/zero | never threshold on confidence; use accept-list agreement + alternatives instead |
| No `SpeechGrammarList` support | per-item closed vocabularies matched in post-processing (fuzzy + homophone tables) |
| Recognizers can replay finals after restart | consecutive-duplicate dedupe |
| Can't distinguish “user silent” from “ASR dropped it” | parallel Web Audio **mic level meter** accumulates voice-activity ms; scorers compare against transcript volume and flag `asr_undercount_suspected` |
| Requires HTTPS + mic permission | Vercel TLS; permission requested at onboarding mic check |

`captureSpeech({maxMs, silenceStopMs})` resolves with `{transcripts, alternatives, text,
voiceActivityMs}`. It never rejects — a capture that hears nothing resolves empty, and item
flows then use their fallback ladders.

### Honest limits

On-device dictation is tuned for fluent connected speech. Elderly, dysarthric, hypophonic,
or heavily accented speech degrades recognition sharply, and **isolated single words —
exactly what delayed recall needs — are the weakest case.** There is no way to plug a custom
acoustic model into `webkitSpeechRecognition`. This is the project's largest validity risk
and is treated as such: review flags instead of hard zeros wherever the level meter and the
transcript disagree, and a planned spike comparing the native recognizer against an
on-device Whisper-tiny (ONNX/WebGPU) on elderly speech samples before any clinical use
([docs/07](07-roadmap.md)).

### Fallback ladder (uniform across speech items)

1. Capture after the prompt (silence-stop once something was heard).
2. Nothing heard → **one** neutral re-prompt → capture again.
3. Still nothing → construct-preserving fallback if one exists (keypad for digits, blank
   typing for naming/abstraction/orientation), always flagged `typed_response`/`keypad_fallback`.
4. No acceptable fallback (recall, sentences, fluency) → item flagged
   `not_administered` / scored with reduced confidence — never silently zeroed as “wrong”.

### Test hooks

`window.__ttsTimeScale` and `window.__speechTimeScale` compress all pacing/timeouts, and
`window.__captureEpoch` increments per capture — this is how the Playwright suite scripts a
complete spoken session against a mock recognizer without touching item code.
