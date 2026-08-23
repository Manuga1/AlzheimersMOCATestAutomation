# CNN Pipeline

## What actually needs a CNN

Most items are scored deterministically or with explainable geometry — a model would add
opacity without accuracy. Three drawing judgments genuinely need learned vision:

1. **Clock-face digit identity** (shipped). The “numbers” point requires knowing that the
   glyph at the 3-o'clock position *is a 3*. Positions can be checked geometrically; identity
   cannot. This model runs today.
2. **Clock overall quality** (planned). A Rouleau/Shulman-style quality classifier as a
   second opinion on borderline contours/hands. Candidate training data: NHANES 2011–2014
   scored clock drawings; academic CDT datasets. Digitally-drawn strokes rasterize cleanly
   into their domain.
3. **Cube quality** (planned, data-starved). No public dataset of scored cube copies exists;
   requires opt-in in-app data collection with human labels. Until then the geometric
   heuristics + `borderline_cube` review flags stand alone.

## The shipped digit model

- **Architecture**: 3×conv(16/32/64) + 2×FC, ~120 k params — LeNet-class (`ml/train_digits.py`).
- **Training**: MNIST with random affine augmentation (±12° rotation, ±10 % translation,
  0.8–1.15 scale) to approximate elderly handwriting variability; 3 epochs, Adam 1e-3;
  **98.7 % test accuracy** (ship gate asserts > 97 %).
- **Export**: `torch.onnx.export` (opset 13, dynamic batch) → `public/models/digits.onnx`
  (386 KB).
- **Inference**: `onnxruntime-web` wasm backend, single-threaded (no COOP/COEP headers
  needed), warmed at app start. The runtime and model are precached by the service worker,
  so classification works offline.
- **Input contract**: 28×28 float32, ink = 1 on background = 0, glyph scaled to a 20 px box
  and centered — produced by `src/scoring/rasterize.ts`, which stamps soft-edged strokes to
  approximate MNIST's pen thickness.

## In the clock scorer

Number clusters are found geometrically first (12 slots, angular tolerance). Only then does
the CNN weigh in on identity: two-digit slots (10–12) are split left/right by stroke
mid-line; each glyph is rasterized and classified; agreement below 70 % keeps the positional
score but adds `digit_identity_uncertain` + reduced confidence. **The CNN never silently
overrides the geometry** — models arbitrate and flag; deterministic logic decides.

## Evaluation methodology (for the planned models)

- Hold out sessions scored independently by ≥ 2 MoCA-certified human raters.
- Report Cohen's κ (model vs each rater) against the human inter-rater κ.
- Ship gate: model-vs-human κ ≥ human-vs-human κ − 0.05.
- Borderline-band audit: the model may only *flip* items already flagged borderline by the
  heuristics; measure how often it flips toward the human consensus.

## Retraining

```bash
pip install torch torchvision
python3 ml/train_digits.py --epochs 3    # rewrites public/models/digits.onnx
npm run build                            # repackage the PWA precache
```
