# Items & Scoring Specification

Summary matrix, then per-item details. “Fallback” is what happens when the primary modality
fails (always flagged). Scorers live in `src/scoring/`, one file per item, each returning
`{score, max, confidence, flags, detail}`.

| Item (pts) | Input | Scoring type | Fallback | Key flags |
|---|---|---|---|---|
| Trail (1) | taps | deterministic | — | `timeout`, `self_corrected_errors` |
| Cube (1) | stylus | heuristic | — | `borderline_cube`, `failed_<check>` |
| Clock (3) | stylus | heuristic + CNN | position-only scoring | `digit_cnn_unavailable`, `digit_identity_uncertain` |
| Naming (3) | speech | accept lists | typed (flagged) | `typed_response_*`, `no_response_*` |
| Registration (0) | speech | fuzzy match, unscored | none (by design) | `registration_recall_not_captured` |
| Digit span (2) | speech | exact sequence | keypad (flagged) | `keypad_fallback` |
| Vigilance (1) | taps | deterministic windows | — | — |
| Serial 7s (3) | speech | chaining rule | keypad (flagged) | `keypad_fallback`, `missing_responses` |
| Sentences (2) | speech | exact vs alternatives | none (by design) | `asr_ambiguous_*`, `not_administered` |
| Fluency (1) | speech 60 s | F-word count | none (by design) | `asr_undercount_suspected`, `not_administered` |
| Abstraction (2) | speech | keyword ontology | typed (flagged) | `unlisted_answer_*` |
| Recall (5) | speech | fuzzy free recall | none (by design) | `asr_undercount_suspected`, `not_administered` |
| Orientation (6) | speech | clock + config | typed (flagged) | `place_unverified`, `city_unverified` |

## 1. Trail making — `trail.ts`

Ten 72 px circular targets in a scatter approximating the paper layout. Tapping the next
expected target (`1→A→2→B→3→C→4→D→5→E`) advances and draws the connecting line; a wrong tap
flashes red (no verbal correction — mirrors the participant noticing on paper). **Rule:** a
wrong tap immediately followed by the correct target counts as self-corrected; two wrong taps
in a row, an incomplete pattern, or the 90 s cap scores 0.

## 2. Cube copy — `cube.ts`

MoCA criteria (3-D, all lines, no extra lines, roughly parallel/similar lengths)
operationalized as five checks over RDP-segmented strokes:
`segmentCount` (8–16), `threeDirections` (3 orientation families ≥ 75 % of ink,
22° merge), `similarLengths` (max/min ≤ 3 within family), `hexSilhouette` (convex hull
simplifies to 5–7 vertices), `interiorJunction` (a point inside the silhouette where edges
from ≥ 3 families meet — the cube's characteristic Y-vertex). All pass → 1. Failing exactly
one check → 0 with `borderline_cube` + reduced confidence (review band; the planned cube
quality CNN would arbitrate here, see [docs/05](05-cnn-pipeline.md)).

## 3. Clock drawing — `clock.ts`

Stroke roles are classified by geometry, order-independent:

- **Contour (1 pt):** longest closed-ish stroke spanning the drawing; Kåsa least-squares
  circle fit; pass if radial RMS < 15 % of radius, closure gap < 20 % of circumference,
  aspect within 0.65–1.55.
- **Numbers (1 pt):** remaining non-hand strokes clustered by bbox gap (12 % of r); each
  cluster assigned to its nearest 30° slot. Pass requires all 12 slots covered exactly once
  within 18°. Cluster glyphs are rasterized to 28×28 and classified by the **digit CNN**;
  two-digit numbers are split left/right. Low identity agreement keeps the positional score
  but flags `digit_identity_uncertain` for review. Without the CNN, position-only scoring
  applies with `digit_cnn_unavailable`.
- **Hands (1 pt):** near-straight strokes with an endpoint within 0.35 r of center. The two
  longest are minute/hour by length. “Ten past eleven”: minute at 60°±16°, hour at 335°±16°
  (11 o'clock + 10-minute drift), minute longer than hour, both joined near center. A minute
  hand pointing at the 10 — the classic trap — fails the angle band.

## 4. Naming — `naming.ts`

One animal at a time (emoji stand-ins for the licensed line drawings), spoken answer matched
against per-animal accept lists (`lion`, `rhinoceros/rhino`, `camel/dromedary`) with fuzzy
tolerance ≤ 0.25 normalized edit distance. Category words (“animal”, “horse”) don't match.
Multiple-choice is deliberately **not** offered (it would turn confrontation naming into
recognition); the fallback is blank typing, flagged.

## 5. Registration — `recall.ts` (unscored)

The five words are spoken at exactly 1/second, two trials regardless of first-trial
performance, with the protocol announcement that recall will be tested later. Immediate
recall is captured and logged per trial. ASR failure here never invalidates delayed recall —
encoding happened by listening.

## 6. Digit span — `digitSpan.ts`

Digits at 1/second, never re-read. Spoken responses are digit-token extracted
(“two one eight five four” or “21854”); forward must match `2-1-8-5-4`, backward must be the
reverse of `7-4-2`. Keypad fallback (no echo) is construct-acceptable, flagged.

## 7. Vigilance — `vigilance.ts`

The 29-letter sequence is spoken at 1/second; each letter's onset comes from the voice
guide's timeline. A tap within `[onset, onset+1.4 s]` of an A (nearest-onset assignment) is a
hit; unassigned taps are false positives; ≤ 1 total error → 1 pt. 250 ms debounce guards
against resting fingers. Reaction times per hit are recorded — bonus clinical signal the
paper form can't capture.

## 8. Serial 7s — `serial7.ts`

MoCA's chaining rule exactly: each response is correct iff it equals the *previous response*
minus 7 (first vs 100), so one early slip doesn't cascade. 4–5 correct → 3, 2–3 → 2, 1 → 1.
Number words are parsed (“ninety three” → 93). One protocol-permitted reminder, then flagged
keypad fallback.

## 9. Sentence repetition — `sentence.ts`

Exact repetition is required, but the recognizer itself errs — so the target is compared
against **all** ASR alternatives. An exact alternative scores; ≥ 90 % ordered token overlap
(LCS) scores *with* an `asr_ambiguous` review flag (fail toward review, not impairment);
less scores 0. No typed fallback: typing a sentence tests something else.

## 10. Verbal fluency — `fluency.ts`

60-second continuous capture with recognizer auto-restart. Words count if they start with F,
aren't in a proper-noun blocklist, contain no digits, and have a new stem (crude stemmer
dedupes fix/fixes/fixing). ≥ 11 → 1 pt. If the mic level meter saw > 10 s of voice but fewer
than 11 words were transcribed, the item is flagged `asr_undercount_suspected` (the honest
answer to ASR dropping mumbled single words).

## 11. Abstraction — `abstraction.ts`

The unscored practice pair (orange–banana) runs first with the protocol's single corrective
prompt (“…they are also both fruit”). Scored pairs match accept lists (transportation/travel/
vehicles; measure/measuring instruments) and reject concrete answers (wheels, numbers).
Answers matching neither list score 0 provisionally with `unlisted_answer_*` review flags —
a small curated ontology plus human review beats a model guessing at novel answers.

## 12. Delayed recall — `recall.ts`

Free recall only, fuzzy-matched with homophone aliases (read/red, phase/face); intrusions
are logged. **No word bank, ever** — recognition ≠ recall. Silence gets one gentle
re-prompt. If the level meter saw speech but nothing matched, `asr_undercount_suspected`.

## 13. Orientation — `orientation.ts`

Date, month, year, and weekday are verified against the device clock (exact match per MoCA;
spoken ordinals and year forms like “twenty twenty-six” are parsed). Place and city are
verified against the caregiver-entered expected values from setup; a significant-word match
tolerates fuzz. Unconfigured, those answers are recorded, flagged `unverified`, and excluded
from confident auto-scoring. Typed fallback is a blank field — never a picker, which would
cue the answer.

## Education adjustment

Asked at caregiver setup; +1 if ≤ 12 years of education and the raw score is below 30
(`finalizeSession` in `src/core/session.ts`).
