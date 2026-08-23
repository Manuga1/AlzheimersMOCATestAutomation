import * as ort from 'onnxruntime-web/wasm';
import type { DigitClassifier } from '../scoring/clock';

let cached: Promise<DigitClassifier | null> | null = null;

/**
 * Load the digit CNN (trained in ml/train_digits.py, exported to ONNX) and
 * wrap it as a batch classifier for 28x28 glyph images. Returns null when the
 * model or WASM runtime cannot load — the clock scorer then falls back to
 * position-only scoring with a review flag.
 */
export function loadDigitClassifier(): Promise<DigitClassifier | null> {
  if (!cached) cached = load();
  return cached;
}

async function load(): Promise<DigitClassifier | null> {
  try {
    ort.env.wasm.numThreads = 1; // single-thread wasm: no COOP/COEP headers needed
    const session = await ort.InferenceSession.create('/models/digits.onnx', {
      executionProviders: ['wasm'],
    });
    return async (images: Float32Array[]) => {
      const preds: number[] = [];
      for (const img of images) {
        const input = new ort.Tensor('float32', img, [1, 1, 28, 28]);
        const out = await session.run({ image: input });
        const logits = out.logits.data as Float32Array;
        let best = 0;
        for (let i = 1; i < logits.length; i++) if (logits[i] > logits[best]) best = i;
        preds.push(best);
      }
      return preds;
    };
  } catch (err) {
    console.warn('digit classifier unavailable', err);
    return null;
  }
}
