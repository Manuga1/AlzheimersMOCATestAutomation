import { expect, test, type Locator, type Page } from '@playwright/test';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
  'September', 'October', 'November', 'December',
];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function speechScript(now: Date): string[] {
  return [
    // naming
    'lion',
    'rhino',
    'camel',
    // registration, two trials
    'face velvet church daisy red',
    'face velvet church daisy red',
    // digit span forward, then backward (7-4-2 reversed)
    '2 1 8 5 4',
    '2 4 7',
    // serial 7s
    '93',
    '86',
    '79',
    '72',
    '65',
    // sentence repetition
    'I only know that John is the one to help today',
    'The cat always hid under the couch when dogs were in the room',
    // fluency (11 valid F words)
    'fish farm fold fast fine fire fork frame fruit floor flag',
    // abstraction: practice + two pairs
    'they are both fruit',
    'they are both means of transportation',
    'they are used to measure things',
    // delayed recall
    'face velvet church daisy red',
    // orientation
    String(now.getDate()),
    MONTHS[now.getMonth()],
    String(now.getFullYear()),
    DAYS[now.getDay()],
    'Lakeside Clinic',
    'Springfield',
  ];
}

async function drawStroke(page: Page, canvas: Locator, pts: [number, number][]): Promise<void> {
  const box = await canvas.boundingBox();
  if (!box) throw new Error('canvas not visible');
  await page.mouse.move(box.x + pts[0][0], box.y + pts[0][1]);
  await page.mouse.down();
  for (const [x, y] of pts.slice(1)) {
    await page.mouse.move(box.x + x, box.y + y, { steps: 2 });
  }
  await page.mouse.up();
}

function cubeEdges(): [number, number][][] {
  const s = 150;
  const f: [number, number][] = [
    [60, 120],
    [60 + s, 120],
    [60 + s, 120 + s],
    [60, 120 + s],
  ];
  const b = f.map(([x, y]) => [x + 80, y - 60] as [number, number]);
  const edges: [number, number][][] = [];
  for (let i = 0; i < 4; i++) {
    edges.push([f[i], f[(i + 1) % 4]]);
    edges.push([b[i], b[(i + 1) % 4]]);
    edges.push([f[i], b[i]]);
  }
  return edges;
}

function clockStrokes(): [number, number][][] {
  const cx = 260;
  const cy = 210;
  const r = 150;
  const strokes: [number, number][][] = [];
  const circle: [number, number][] = [];
  for (let i = 0; i <= 48; i++) {
    const a = (2 * Math.PI * i) / 48;
    circle.push([cx + r * Math.sin(a), cy - r * Math.cos(a)]);
  }
  strokes.push(circle);
  for (let k = 1; k <= 12; k++) {
    const a = ((k % 12) * 30 * Math.PI) / 180;
    const gx = cx + 0.78 * r * Math.sin(a);
    const gy = cy - 0.78 * r * Math.cos(a);
    strokes.push([
      [gx, gy - 8],
      [gx, gy + 8],
    ]);
  }
  const minuteA = (60 * Math.PI) / 180;
  const hourA = (335 * Math.PI) / 180;
  strokes.push([
    [cx, cy],
    [cx + 0.62 * r * Math.sin(minuteA), cy - 0.62 * r * Math.cos(minuteA)],
  ]);
  strokes.push([
    [cx, cy],
    [cx + 0.38 * r * Math.sin(hourA), cy - 0.38 * r * Math.cos(hourA)],
  ]);
  return strokes;
}

async function installHarness(
  page: Page,
  script: string[],
  opts: { vigilanceTaps: boolean },
): Promise<void> {
  await page.addInitScript(
    ({ speech, vigilanceTaps }: { speech: string[]; vigilanceTaps: boolean }) => {
      const w = window as unknown as Record<string, unknown>;
      w.__ttsTimeScale = 0.15;
      w.__speechTimeScale = 0.15;
      // Force the voice guide onto its deterministic timer fallback.
      Object.defineProperty(window, 'speechSynthesis', { value: undefined });
      w.__speechQueue = speech.slice();

      let lastEpoch = -1;
      class MockRecognition {
        lang = '';
        continuous = false;
        interimResults = false;
        maxAlternatives = 1;
        onresult: ((ev: unknown) => void) | null = null;
        onend: (() => void) | null = null;
        onerror: ((ev: unknown) => void) | null = null;
        start(): void {
          setTimeout(() => {
            const epoch = (w.__captureEpoch as number) ?? 0;
            const queue = w.__speechQueue as string[];
            if (epoch !== lastEpoch && queue.length) {
              lastEpoch = epoch;
              const text = queue.shift()!;
              const result = { isFinal: true, length: 1, 0: { transcript: text } };
              this.onresult?.({ results: [result] });
            }
            setTimeout(() => this.onend?.(), 60);
          }, 50);
        }
        stop(): void {
          this.onend?.();
        }
        abort(): void {
          /* no-op */
        }
      }
      w.SpeechRecognition = MockRecognition;

      if (vigilanceTaps) {
        // Auto-tapper for the vigilance item: tap whenever the caption shows "A".
        const observer = new MutationObserver(() => {
          const cap = document.querySelector('[data-testid="caption"]');
          const txt = cap?.textContent?.trim() ?? '';
          if (/\sA$/.test(txt) && txt.length <= 5) {
            const btn = document.querySelector('[data-testid="vigilance-tap"]');
            if (btn && !(btn as HTMLButtonElement).disabled) {
              btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
            }
          }
        });
        window.addEventListener('DOMContentLoaded', () =>
          observer.observe(document.body, { childList: true, subtree: true, characterData: true }),
        );
      }
    },
    { speech: script, vigilanceTaps: opts.vigilanceTaps },
  );
}

test('complete hands-free session scores 30/30', async ({ page }) => {
  test.setTimeout(300_000);
  await installHarness(page, speechScript(new Date()), { vigilanceTaps: true });

  await page.goto('/');

  // --- Setup (caregiver)
  await page.getByTestId('setup-education').fill('16');
  await page.getByTestId('setup-place').fill('Lakeside Clinic');
  await page.getByTestId('setup-city').fill('Springfield');
  await page.getByTestId('setup-start').click();

  // --- Onboarding: audio + pen check
  await page.getByTestId('audio-ok').click();
  await expect(page.getByTestId('drawing-canvas')).toBeVisible();
  await drawStroke(page, page.getByTestId('drawing-canvas'), [
    [60, 100],
    [400, 120],
  ]);
  await page.getByTestId('pen-next').click();
  await page.getByTestId('start-test').click();

  // --- 1. Trail making
  await expect(page.getByTestId('item-trail')).toBeVisible();
  for (const t of ['1', 'A', '2', 'B', '3', 'C', '4', 'D', '5', 'E']) {
    await page.getByTestId(`trail-${t}`).click();
  }

  // --- 2. Cube copy
  await expect(page.getByTestId('item-cube')).toBeVisible();
  const cubeCanvas = page.getByTestId('item-cube').getByTestId('drawing-canvas');
  await expect(cubeCanvas).toBeVisible();
  for (const edge of cubeEdges()) {
    await drawStroke(page, cubeCanvas, edge);
  }
  await page.getByTestId('cube-done').click();

  // --- 3. Clock drawing
  await expect(page.getByTestId('item-clock')).toBeVisible();
  const clockCanvas = page.getByTestId('item-clock').getByTestId('drawing-canvas');
  await expect(clockCanvas).toBeVisible();
  for (const stroke of clockStrokes()) {
    await drawStroke(page, clockCanvas, stroke);
  }
  await page.getByTestId('clock-done').click();

  // --- 4-13. Speech-driven items run hands-free via the mock recognizer;
  // vigilance taps itself via the caption observer. Wait for the results.
  await expect(page.getByTestId('results')).toBeVisible({ timeout: 240_000 });

  // --- Assertions: per-item scores
  const expectRow = async (item: string, text: string) => {
    await expect(page.getByTestId(`result-${item}`)).toContainText(text);
  };
  await expectRow('trail', '1 / 1');
  await expectRow('cube', '1 / 1');
  await expectRow('clock', '3 / 3');
  await expectRow('naming', '3 / 3');
  await expectRow('digitspan', '2 / 2');
  await expectRow('vigilance', '1 / 1');
  await expectRow('serial7', '3 / 3');
  await expectRow('sentence', '2 / 2');
  await expectRow('fluency', '1 / 1');
  await expectRow('abstraction', '2 / 2');
  await expectRow('recall', '5 / 5');
  await expectRow('orientation', '6 / 6');

  await expect(page.getByTestId('total-score')).toHaveText(/30\s*\/\s*30/);

  // Verdict banner: 30 is at/above the standard cutoff of 26.
  await expect(page.getByTestId('verdict')).toContainText('At or above the standard cutoff');

  // Qualitative drawing review: reference next to the participant's drawing.
  await expect(page.getByTestId('review-trail')).toBeVisible();
  await expect(page.getByTestId('review-cube')).toBeVisible();
  await expect(page.getByTestId('review-clock')).toBeVisible();
  await expect(page.getByTestId('review-cube').getByTestId('cube-model')).toBeVisible();
  await expect(page.getByTestId('review-clock').getByTestId('clock-reference')).toBeVisible();
  // The participant panels render the captured strokes as SVG polylines.
  expect(
    await page.getByTestId('review-clock').locator('polyline').count(),
  ).toBeGreaterThan(3);

  // The clock must have been scored WITH the CNN (proves ONNX ran in-browser).
  await expect(page.getByTestId('result-clock')).not.toContainText('digit_cnn_unavailable');
});

test('impaired responses produce a low score with review flags', async ({ page }) => {
  test.setTimeout(300_000);
  const now = new Date();
  const wrongMonth = MONTHS[(now.getMonth() + 5) % 12];
  const wrongDay = DAYS[(now.getDay() + 3) % 7];
  const script = [
    // naming: all wrong
    'horse',
    'hippo',
    'dog',
    // registration
    'face red',
    'face red',
    // digit span: forward wrong length, backward not reversed
    '2 1 8 5',
    '7 4 2',
    // serial 7s: none correct under the chaining rule
    '90',
    '85',
    '80',
    '75',
    '70',
    // sentence repetition: both wrong
    'I know John helps',
    'the cat hid somewhere',
    // fluency: far below 11 words
    'fish farm',
    // abstraction: non-abstract practice answer triggers the corrective prompt
    'they are both yellow',
    'they both have wheels',
    'they both have numbers',
    // delayed recall: 2 of 5
    'face red',
    // orientation: everything wrong
    '1',
    wrongMonth,
    '1999',
    wrongDay,
    'somewhere else',
    'nowhere',
  ];
  await installHarness(page, script, { vigilanceTaps: false });

  await page.goto('/');
  await page.getByTestId('setup-education').fill('8'); // triggers +1 adjustment
  await page.getByTestId('setup-place').fill('Lakeside Clinic');
  await page.getByTestId('setup-city').fill('Springfield');
  await page.getByTestId('setup-start').click();

  await page.getByTestId('audio-ok').click();
  await drawStroke(page, page.getByTestId('drawing-canvas'), [
    [60, 100],
    [400, 120],
  ]);
  await page.getByTestId('pen-next').click();
  await page.getByTestId('start-test').click();

  // Trail: two consecutive wrong taps → 0, then finish the pattern.
  await expect(page.getByTestId('item-trail')).toBeVisible();
  for (const t of ['1', '2', '3', 'A', '2', 'B', '3', 'C', '4', 'D', '5', 'E']) {
    await page.getByTestId(`trail-${t}`).click();
  }

  // Cube: a flat square is not a cube → 0.
  const cubeCanvas = page.getByTestId('item-cube').getByTestId('drawing-canvas');
  await expect(cubeCanvas).toBeVisible();
  await drawStroke(page, cubeCanvas, [
    [80, 80],
    [280, 80],
    [280, 280],
    [80, 280],
    [80, 80],
  ]);
  await page.getByTestId('cube-done').click();

  // Clock: contour only → 1 of 3.
  const clockCanvas = page.getByTestId('item-clock').getByTestId('drawing-canvas');
  await expect(clockCanvas).toBeVisible();
  await drawStroke(page, clockCanvas, clockStrokes()[0]);
  await page.getByTestId('clock-done').click();

  // Vigilance receives no taps at all → 11 misses → 0.
  await expect(page.getByTestId('results')).toBeVisible({ timeout: 240_000 });

  await expect(page.getByTestId('result-trail')).toContainText('0 / 1');
  await expect(page.getByTestId('result-cube')).toContainText('0 / 1');
  await expect(page.getByTestId('result-clock')).toContainText('1 / 3');
  await expect(page.getByTestId('result-naming')).toContainText('0 / 3');
  await expect(page.getByTestId('result-digitspan')).toContainText('0 / 2');
  await expect(page.getByTestId('result-vigilance')).toContainText('0 / 1');
  await expect(page.getByTestId('result-serial7')).toContainText('0 / 3');
  await expect(page.getByTestId('result-sentence')).toContainText('0 / 2');
  await expect(page.getByTestId('result-fluency')).toContainText('0 / 1');
  await expect(page.getByTestId('result-abstraction')).toContainText('0 / 2');
  await expect(page.getByTestId('result-recall')).toContainText('2 / 5');
  await expect(page.getByTestId('result-orientation')).toContainText('0 / 6');

  // 3 raw points + 1 education adjustment
  await expect(page.getByTestId('total-score')).toHaveText(/4\s*\/\s*30/);
  await expect(page.getByTestId('results')).toContainText('education adjustment');

  // Verdict banner: 4 is below the standard cutoff → follow-up wording.
  await expect(page.getByTestId('verdict')).toContainText('Below the standard cutoff');

  // Drawing review still renders for the imperfect drawings.
  await expect(page.getByTestId('review-cube')).toBeVisible();
  await expect(page.getByTestId('review-trail')).toBeVisible();
});
