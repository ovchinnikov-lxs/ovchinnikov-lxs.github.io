'use client';

import { type ReactNode, useEffect, useRef, useState } from 'react';

/** Mask resolution relative to CSS pixels: low = soft, watery edges and a cheap canvas. */
const SCALE = 0.5;
/** Brush radius in CSS pixels. */
const BRUSH = 46;
/** How long a scratch stays before it heals, ms. */
const LIFETIME = 2600;
const MAX_STAMPS = 900;
const WIPE_MS = 900;

type Stamp = { x: number; y: number; r: number; rot: number; t: number };
type Mode = 'raw' | 'ink';

/** A blotchy, ink-like brush: one soft core plus random specks and splatters. */
function makeBrush(size: number) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const mid = size / 2;
  const core = g.createRadialGradient(mid, mid, 0, mid, mid, mid * 0.62);
  core.addColorStop(0, 'rgba(0,0,0,1)');
  core.addColorStop(0.7, 'rgba(0,0,0,0.85)');
  core.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = core;
  g.fillRect(0, 0, size, size);
  g.fillStyle = '#000';
  for (let i = 0; i < 70; i++) {
    const a = Math.random() * Math.PI * 2;
    const d = Math.pow(Math.random(), 0.6) * mid * 0.95;
    const r = Math.random() * size * 0.05 + 0.4;
    g.globalAlpha = 0.35 + Math.random() * 0.65;
    g.beginPath();
    g.arc(mid + Math.cos(a) * d, mid + Math.sin(a) * d, r, 0, Math.PI * 2);
    g.fill();
  }
  return c;
}

/**
 * Two stacked copies of the same layout: `raw` in the document flow and `ink`
 * absolutely on top of it, masked by a low-res canvas the pointer paints into.
 * Only the mask changes, so nothing reflows and text never moves (no CLS).
 */
export function ScratchReveal({ raw, ink }: { raw: ReactNode; ink: ReactNode }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const inkRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<Mode>('raw');
  const api = useRef<{ wipe: (to: Mode, x: number, y: number) => void } | null>(null);

  useEffect(() => {
    const stage = stageRef.current!;
    const layer = inkRef.current!;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const brush = makeBrush(64);
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

    let stamps: Stamp[] = [];
    let current: Mode = 'raw';
    let wipe: { from: Mode; to: Mode; x: number; y: number; t: number } | null = null;
    let last: { x: number; y: number } | null = null;
    let touch: { cx: number; cy: number } | null = null;
    let frame = 0;
    let disposed = false;

    const resize = () => {
      canvas.width = Math.max(1, Math.ceil(stage.offsetWidth * SCALE));
      canvas.height = Math.max(1, Math.ceil(stage.offsetHeight * SCALE));
      schedule();
    };

    const toStage = (clientX: number, clientY: number) => {
      const r = stage.getBoundingClientRect();
      return { x: clientX - r.left, y: clientY - r.top };
    };

    const stampLine = (x: number, y: number) => {
      const now = performance.now();
      const from = last ?? { x, y };
      const dist = Math.hypot(x - from.x, y - from.y);
      const steps = Math.max(1, Math.ceil(dist / (BRUSH * 0.35)));
      for (let i = 1; i <= steps; i++) {
        stamps.push({
          x: from.x + ((x - from.x) * i) / steps,
          y: from.y + ((y - from.y) * i) / steps,
          r: BRUSH * (0.75 + Math.random() * 0.5),
          rot: Math.random() * Math.PI * 2,
          t: now,
        });
      }
      if (stamps.length > MAX_STAMPS) stamps = stamps.slice(-MAX_STAMPS);
      last = { x, y };
      schedule();
    };

    const draw = (now: number) => {
      frame = 0;
      const w = canvas.width;
      const h = canvas.height;
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, w, h);

      // Base coverage: 0 in raw mode, 1 in ink mode, or a growing circle while wiping.
      const base = wipe ? wipe.from : current;
      if (base === 'ink') {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, w, h);
      }
      let wiping = false;
      if (wipe) {
        // rAF timestamps can predate the click that started the wipe.
        const p = Math.min(1, Math.max(0, (now - wipe.t) / WIPE_MS));
        const eased = 1 - Math.pow(1 - p, 3);
        const radius = Math.hypot(Math.max(wipe.x, w - wipe.x), Math.max(wipe.y, h - wipe.y)) * eased * 1.05;
        ctx.globalCompositeOperation = wipe.to === 'ink' ? 'source-over' : 'destination-out';
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(wipe.x, wipe.y, radius, 0, Math.PI * 2);
        ctx.fill();
        if (p >= 1) {
          current = wipe.to;
          wipe = null;
        } else wiping = true;
      }

      // Scratches add ink over raw, or erase ink back to raw.
      stamps = stamps.filter((s) => now - s.t < LIFETIME);
      ctx.globalCompositeOperation = (wipe?.to ?? current) === 'ink' ? 'destination-out' : 'source-over';
      for (const s of stamps) {
        const age = (now - s.t) / LIFETIME;
        ctx.globalAlpha = age < 0.6 ? 1 : 1 - (age - 0.6) / 0.4;
        const r = s.r * SCALE;
        ctx.save();
        ctx.translate(s.x * SCALE, s.y * SCALE);
        ctx.rotate(s.rot);
        ctx.drawImage(brush, -r, -r, r * 2, r * 2);
        ctx.restore();
      }

      const active = stamps.length > 0 || wiping;
      if (!active && current === 'raw') {
        gen++;
        layer.style.maskImage = layer.style.webkitMaskImage = '';
      } else if (!active && current === 'ink') {
        gen++;
        layer.style.maskImage = layer.style.webkitMaskImage = 'none';
      } else {
        pushMask();
      }
      if (active) schedule();
    };

    // PNG encoding runs off the main thread; frames that land mid-encode are simply skipped.
    let encoding = false;
    let maskUrl = '';
    // Bumped whenever the mask is set statically, so a late blob can't overwrite it.
    let gen = 0;
    function pushMask() {
      if (encoding) return;
      encoding = true;
      const g = gen;
      canvas.toBlob((blob) => {
        encoding = false;
        if (!blob || disposed || g !== gen) return;
        const prev = maskUrl;
        maskUrl = URL.createObjectURL(blob);
        layer.style.maskImage = layer.style.webkitMaskImage = `url(${maskUrl})`;
        if (prev) setTimeout(() => URL.revokeObjectURL(prev), 100);
      });
    }

    function schedule() {
      if (!frame) frame = requestAnimationFrame(draw);
    }

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') {
        touch = { cx: e.clientX, cy: e.clientY };
      }
      const p = toStage(e.clientX, e.clientY);
      stampLine(p.x, p.y);
    };
    const onPointerLeave = () => {
      last = null;
    };
    // While a finger scrolls the page, it stays put on screen but travels through the document.
    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0];
      touch = { cx: t.clientX, cy: t.clientY };
      last = null;
      const p = toStage(t.clientX, t.clientY);
      stampLine(p.x, p.y);
    };
    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      touch = { cx: t.clientX, cy: t.clientY };
    };
    const onTouchEnd = () => {
      touch = null;
      last = null;
    };
    const onScroll = () => {
      if (!touch) return;
      const p = toStage(touch.cx, touch.cy);
      stampLine(p.x, p.y);
    };

    api.current = {
      wipe: (to, clientX, clientY) => {
        const p = toStage(clientX, clientY);
        stamps = [];
        if (reduceMotion) {
          current = to;
          wipe = null;
        } else {
          wipe = { from: current, to, x: p.x * SCALE, y: p.y * SCALE, t: performance.now() };
        }
        schedule();
      },
    };

    // A single brush stroke across the hero on load hints that the page can be scratched.
    let intro = 0;
    if (!reduceMotion) {
      const start = performance.now() + 700;
      const run = (now: number) => {
        const p = (now - start) / 1100;
        if (p < 0) {
          intro = requestAnimationFrame(run);
          return;
        }
        const w = stage.offsetWidth;
        const x = w * (0.06 + 0.88 * Math.min(1, p));
        const y = 150 + Math.sin(Math.min(1, p) * Math.PI * 2.2) * 60;
        stampLine(x, y);
        if (p < 1) intro = requestAnimationFrame(run);
        else last = null;
      };
      intro = requestAnimationFrame(run);
    }

    const ro = new ResizeObserver(resize);
    ro.observe(stage);
    resize();
    stage.addEventListener('pointermove', onPointerMove);
    stage.addEventListener('pointerleave', onPointerLeave);
    stage.addEventListener('touchstart', onTouchStart, { passive: true });
    stage.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', onTouchEnd, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      disposed = true;
      ro.disconnect();
      cancelAnimationFrame(frame);
      cancelAnimationFrame(intro);
      stage.removeEventListener('pointermove', onPointerMove);
      stage.removeEventListener('pointerleave', onPointerLeave);
      stage.removeEventListener('touchstart', onTouchStart);
      stage.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
      window.removeEventListener('scroll', onScroll);
      api.current = null;
    };
  }, []);

  const toggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    const next: Mode = mode === 'raw' ? 'ink' : 'raw';
    const r = e.currentTarget.getBoundingClientRect();
    // Keyboard "clicks" have no coordinates: start the wipe from the button itself.
    const x = e.clientX || r.left + r.width / 2;
    const y = e.clientY || r.top + r.height / 2;
    api.current?.wipe(next, x, y);
    setMode(next);
  };

  return (
    <div ref={stageRef} className="stage" data-mode={mode}>
      <main>{raw}</main>
      <div ref={inkRef} className="ink-layer" aria-hidden="true" inert>
        {ink}
      </div>
      <button type="button" className="toggle" onClick={toggle} aria-pressed={mode === 'ink'}>
        {mode === 'raw' ? '✦ Reveal design' : '↺ Raw mode'}
      </button>
    </div>
  );
}
