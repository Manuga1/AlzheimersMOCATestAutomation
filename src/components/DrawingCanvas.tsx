import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import type { Stroke, StrokePoint } from '../core/types';

export interface DrawingCanvasHandle {
  getStrokes: () => Stroke[];
  undo: () => void;
  clear: () => void;
}

interface Props {
  width: number;
  height: number;
  onStrokeCountChange?: (count: number) => void;
}

/**
 * Stylus capture surface. Accepts Apple Pencil ('pen') and mouse pointers;
 * finger touches are ignored on the canvas itself (belt-and-braces palm
 * rejection on top of iPadOS's own). Coalesced pointer events give full
 * ~240 Hz Pencil sampling with pressure.
 */
export const DrawingCanvas = forwardRef<DrawingCanvasHandle, Props>(function DrawingCanvas(
  { width, height, onStrokeCountChange },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const activeRef = useRef<Stroke | null>(null);

  const redraw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#23303a';
    ctx.lineWidth = 2.5;
    const all = activeRef.current
      ? [...strokesRef.current, activeRef.current]
      : strokesRef.current;
    for (const s of all) {
      if (s.points.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(s.points[0].x, s.points[0].y);
      for (const p of s.points.slice(1)) ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    redraw();

    const toPoint = (ev: PointerEvent): StrokePoint => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: ev.clientX - rect.left,
        y: ev.clientY - rect.top,
        t: ev.timeStamp,
        pressure: ev.pressure,
      };
    };

    const down = (ev: PointerEvent) => {
      if (ev.pointerType === 'touch') return;
      ev.preventDefault();
      canvas.setPointerCapture(ev.pointerId);
      activeRef.current = { points: [toPoint(ev)], pointerType: ev.pointerType };
    };
    const move = (ev: PointerEvent) => {
      if (!activeRef.current || ev.pointerType === 'touch') return;
      ev.preventDefault();
      const events =
        typeof ev.getCoalescedEvents === 'function' ? ev.getCoalescedEvents() : [ev];
      for (const e of events.length ? events : [ev]) {
        activeRef.current.points.push(toPoint(e as PointerEvent));
      }
      redraw();
    };
    const up = (ev: PointerEvent) => {
      if (!activeRef.current || ev.pointerType === 'touch') return;
      if (activeRef.current.points.length > 1) {
        strokesRef.current = [...strokesRef.current, activeRef.current];
        onStrokeCountChange?.(strokesRef.current.length);
      }
      activeRef.current = null;
      redraw();
    };

    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    return () => {
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height]);

  useImperativeHandle(ref, () => ({
    getStrokes: () => strokesRef.current,
    undo: () => {
      strokesRef.current = strokesRef.current.slice(0, -1);
      onStrokeCountChange?.(strokesRef.current.length);
      redraw();
    },
    clear: () => {
      strokesRef.current = [];
      onStrokeCountChange?.(0);
      redraw();
    },
  }));

  return (
    <canvas
      ref={canvasRef}
      className="canvas-frame"
      style={{ width, height, touchAction: 'none' }}
      data-testid="drawing-canvas"
    />
  );
});
