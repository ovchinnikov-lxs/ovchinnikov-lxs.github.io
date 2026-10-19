'use client';

import { type ReactNode, useEffect, useRef, useState } from 'react';

/** Size of one "diffusion" pixel, CSS px. */
const CELL = 8;
/** Brush radius, CSS px: a share of the viewport width, clamped. */
const brushFor = (viewport: number) => Math.min(240, Math.max(110, viewport * 0.17));
/** Scratches are permanent; the fringe keeps shimmering this long after the last input, then freezes. */
const SETTLE_MS = 1600;
const FIELD_MAX = 1.5;
/** Brush inertia: spring towards the pointer, then damping. */
const SPRING = 0.16;
const DAMP = 0.8;
/**
 * Spreading after a stroke: every painted cell gets a travel budget (px) and creeps outwards,
 * paying more per cell downwards and much more upwards — so it reaches the screen edges
 * sideways, goes down noticeably less, and up barely.
 */
const REACH = 1600;
const COST_X = CELL;
const COST_DOWN = CELL * 3.2;
const COST_UP = CELL * 9;
/** Chance a cell skips spreading on a given frame: keeps the front ragged and organic. */
const SPREAD_SKIP = 0.45;
const WIPE_MS = 1100;
/** Edge band (in field units) that gets the iridescent fringe. */
const FRINGE = 0.11;

type Mode = 'raw' | 'ink';

/** AI-ish iridescent palette: violet → blue → cyan → lime → pink, as [r, g, b]. */
const PALETTE: [number, number, number][] = [
  [167, 139, 250],
  [96, 165, 250],
  [103, 232, 249],
  [198, 244, 50],
  [244, 114, 182],
];

function paletteAt(t: number): [number, number, number] {
  const n = PALETTE.length;
  const x = (((t % 1) + 1) % 1) * n;
  const i = Math.floor(x);
  const f = x - i;
  const a = PALETTE[i % n];
  const b = PALETTE[(i + 1) % n];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

/**
 * Two stacked copies of the same layout: `raw` in the document flow and `ink`
 * absolutely on top of it. A per-cell scalar field (painted by the pointer)
 * is dithered against per-cell noise into a pixel clip-path, and the cells on its
 * edge are drawn as a shimmering fringe — like an image being diffused in.
 * Scratches stay and slowly spread: sideways to the screen edges, down less, up barely.
 * The brush itself has inertia: it trails the pointer and overshoots a little.
 * Only the clip changes, so nothing reflows and text never moves (no CLS).
 */
export function ScratchReveal({ raw, ink }: { raw: ReactNode; ink: ReactNode }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const inkRef = useRef<HTMLDivElement>(null);
  const fringeRef = useRef<HTMLCanvasElement>(null);
  const glowRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<Mode>('raw');
  const api = useRef<{ wipe: (to: Mode, x: number, y: number) => void } | null>(null);

  useEffect(() => {
    const stage = stageRef.current!;
    const layer = inkRef.current!;
    const fringe = fringeRef.current!;
    const glow = glowRef.current!;
    const fctx = fringe.getContext('2d')!;
    const gctx = glow.getContext('2d')!;
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

    let cols = 1;
    let rows = 1;
    let field = new Float32Array(1);
    let noise = new Float32Array(1);
    let phase = new Float32Array(1);
    let reach = new Float32Array(1);
    // Rows that may hold paint: only this band is simulated, encoded and drawn.
    let band0 = Infinity;
    let band1 = -1;

    let current: Mode = 'raw';
    let wipe: { from: Mode; to: Mode; cx: number; cy: number; t: number } | null = null;
    let last: { x: number; y: number } | null = null;
    // Where the pointer is (aim) and where the inertial brush is (pos).
    let aim: { x: number; y: number } | null = null;
    let pos: { x: number; y: number } | null = null;
    const vel = { x: 0, y: 0 };
    let touch: { cx: number; cy: number } | null = null;
    let frame = 0;
    let brush = brushFor(window.innerWidth);
    let lastInput = 0;
    let intro = 0;

    const resize = () => {
      const nc = Math.max(1, Math.ceil(stage.offsetWidth / CELL));
      const nr = Math.max(1, Math.ceil(stage.offsetHeight / CELL));
      brush = brushFor(window.innerWidth);
      if (nc === cols && nr === rows) return;
      const old = field;
      const oc = cols;
      const or = rows;
      cols = nc;
      rows = nr;
      const oldReach = reach;
      field = new Float32Array(cols * rows);
      reach = new Float32Array(cols * rows);
      for (let y = 0; y < Math.min(rows, or); y++)
        for (let x = 0; x < Math.min(cols, oc); x++) {
          field[y * cols + x] = old[y * oc + x];
          reach[y * cols + x] = oldReach[y * oc + x];
        }
      noise = new Float32Array(cols * rows);
      phase = new Float32Array(cols * rows);
      for (let i = 0; i < noise.length; i++) {
        noise[i] = 0.18 + Math.random() * 0.64;
        phase[i] = Math.random() * Math.PI * 2;
      }
      for (const c of [fringe, glow]) c.style.width = `${cols * CELL}px`;
      schedule();
    };

    const toStage = (clientX: number, clientY: number) => {
      const r = stage.getBoundingClientRect();
      return { x: clientX - r.left, y: clientY - r.top };
    };

    /** Adds a gaussian blob of "denoise" energy around (x, y), in CSS px. */
    const splat = (x: number, y: number) => {
      const cx = x / CELL;
      const cy = y / CELL;
      const rad = brush / CELL;
      const s2 = 2 * (rad / 2) ** 2;
      const x0 = Math.max(0, Math.floor(cx - rad));
      const x1 = Math.min(cols - 1, Math.ceil(cx + rad));
      const y0 = Math.max(0, Math.floor(cy - rad));
      const y1 = Math.min(rows - 1, Math.ceil(cy + rad));
      band0 = Math.min(band0, y0);
      band1 = Math.max(band1, y1);
      for (let yy = y0; yy <= y1; yy++) {
        for (let xx = x0; xx <= x1; xx++) {
          const d2 = (xx + 0.5 - cx) ** 2 + (yy + 0.5 - cy) ** 2;
          const i = yy * cols + xx;
          field[i] = Math.min(FIELD_MAX, field[i] + 0.55 * Math.exp(-d2 / s2));
          reach[i] = REACH;
        }
      }
    };

    const stroke = (x: number, y: number) => {
      const from = last ?? { x, y };
      const steps = Math.max(1, Math.ceil(Math.hypot(x - from.x, y - from.y) / (brush * 0.3)));
      for (let i = 1; i <= steps; i++) splat(from.x + ((x - from.x) * i) / steps, from.y + ((y - from.y) * i) / steps);
      last = { x, y };
      lastInput = performance.now();
      schedule();
    };

    // The reveal is a clip-path made of pixel runs: applied synchronously on the
    // same frame, unlike a mask image that the browser has to decode first.
    const setClip = (value: string) => {
      layer.style.clipPath = value;
    };

    const setStatic = (m: Mode) => {
      band0 = Infinity;
      band1 = -1;
      // '' falls back to the stylesheet, which clips the ink layer away entirely.
      setClip(m === 'ink' ? 'none' : '');
      fctx.clearRect(0, 0, fringe.width, fringe.height);
      gctx.clearRect(0, 0, glow.width, glow.height);
    };

    /** The brush trails the pointer with a little overshoot; returns whether it still moves. */
    const stepBrush = () => {
      if (!aim) return false;
      if (!pos) {
        pos = { ...aim };
        vel.x = vel.y = 0;
        last = null;
      }
      vel.x = (vel.x + (aim.x - pos.x) * SPRING) * DAMP;
      vel.y = (vel.y + (aim.y - pos.y) * SPRING) * DAMP;
      pos.x += vel.x;
      pos.y += vel.y;
      const moving = Math.hypot(vel.x, vel.y) > 0.2 || Math.hypot(aim.x - pos.x, aim.y - pos.y) > 0.5;
      if (moving) stroke(pos.x, pos.y);
      return moving;
    };

    /** Lets uncovered areas creep outwards: values are copied (not diluted) while the budget lasts. */
    const spread = (r0: number, r1: number) => {
      const base = r0 * cols;
      const pf = field.slice(base, (r1 + 1) * cols);
      const pr = reach.slice(base, (r1 + 1) * cols);
      let grew = false;
      const offer = (i: number, x: number, y: number, cost: number) => {
        if (x < 0 || x >= cols || y < r0 || y > r1) return;
        const j = (y - r0) * cols + x;
        const budget = pr[j] - cost;
        if (budget <= 0 || pf[j] <= field[i] + 0.01) return;
        field[i] = pf[j];
        reach[i] = Math.max(reach[i], budget);
        grew = true;
      };
      for (let y = r0; y <= r1; y++) {
        for (let x = 0; x < cols; x++) {
          if (Math.random() < SPREAD_SKIP) continue;
          const i = y * cols + x;
          offer(i, x - 1, y, COST_X);
          offer(i, x + 1, y, COST_X);
          offer(i, x, y - 1, COST_DOWN);
          offer(i, x, y + 1, COST_UP);
        }
      }
      return grew;
    };

    const draw = (now: number) => {
      frame = 0;
      const moving = stepBrush();
      let wipeR = 0;
      let wipeBand = 1;
      let wiping = false;
      if (wipe) {
        // rAF timestamps can predate the click that started the wipe.
        const p = Math.min(1, Math.max(0, (now - wipe.t) / WIPE_MS));
        const eased = 1 - Math.pow(1 - p, 3);
        const far = Math.hypot(Math.max(wipe.cx, cols - wipe.cx), Math.max(wipe.cy, rows - wipe.cy));
        wipeBand = 10;
        wipeR = (far + wipeBand) * eased;
        if (p >= 1) {
          current = wipe.to;
          wipe = null;
        } else wiping = true;
      }

      const target = wipe ? wipe.to : current;
      // Outside the painted band the picture is uniform, so skip it (except mid-wipe).
      const r0 = wiping ? 0 : Math.max(0, band0 - 1);
      const r1 = wiping ? rows - 1 : Math.min(rows - 1, band1 + 1);
      if (r1 < r0) {
        setStatic(current);
        return;
      }
      const grew = !wiping && !reduceMotion && spread(r0, r1);
      const h = r1 - r0 + 1;
      const fringeImg = new ImageData(cols, h);
      const fx = fringeImg.data;
      const path: string[] = [];
      const onMap = new Uint8Array(cols * h);
      const t = now * 0.00012;
      const calm = Math.max(0, 1 - (now - lastInput) / SETTLE_MS);
      const shimmer = reduceMotion ? 0 : 0.07 * calm;
      let alive = false;
      let next0 = Infinity;
      let next1 = -1;

      for (let y = r0; y <= r1; y++) {
        let run = -1;
        for (let x = 0, i = y * cols; x < cols; x++, i++) {
          const f = field[i];
          if (f > 0) {
            alive = true;
            if (y < next0) next0 = y;
            next1 = y;
          }
          // Coverage of the ink layer before scratches: 0, 1, or the wipe front.
          let base: number;
          if (wipe) {
            const d = Math.hypot(x - wipe.cx, y - wipe.cy);
            const c = Math.min(1, Math.max(0, (wipeR - d) / wipeBand));
            base = wipe.to === 'ink' ? c : 1 - c;
          } else base = current === 'ink' ? 1 : 0;
          const v = target === 'ink' ? base - f : base + f;
          const thr = noise[i] + Math.sin(now * 0.006 + phase[i]) * shimmer;
          const on = v > thr;
          if (on) onMap[(y - r0) * cols + x] = 1;
          if (on && run < 0) run = x;
          if (!on && run >= 0) {
            path.push(`M${run * CELL} ${y * CELL}h${(x - run) * CELL}v${CELL}h${(run - x) * CELL}z`);
            run = -1;
          }
          const o = ((y - r0) * cols + x) * 4;
          const edge = Math.abs(v - thr);
          if (edge < FRINGE && v > 0.04 && v < 0.98) {
            const [r, g, b] = paletteAt(t * 6 + (x + y * 0.6) * 0.012);
            fx[o] = r;
            fx[o + 1] = g;
            fx[o + 2] = b;
            fx[o + 3] = 255 * (1 - edge / FRINGE);
          } else fx[o + 3] = 0;
        }
        if (run >= 0) path.push(`M${run * CELL} ${y * CELL}h${(cols - run) * CELL}v${CELL}h${(run - cols) * CELL}z`);
      }

      // Thin iridescent outline on every boundary, so a sharp spreading front glows too.
      // It sits on the side that is not being uncovered (raw in raw mode, ink in ink mode).
      const side = target === 'ink' && !wiping ? 1 : 0;
      for (let y = 0; y < h; y++) {
        for (let x = 0, j = y * cols; x < cols; x++, j++) {
          if (onMap[j] !== side) continue;
          const edge =
            (x > 0 && onMap[j - 1] !== side) ||
            (x < cols - 1 && onMap[j + 1] !== side) ||
            (y > 0 && onMap[j - cols] !== side) ||
            (y < h - 1 && onMap[j + cols] !== side);
          const o = j * 4;
          if (!edge || fx[o + 3] > 0) continue;
          const [r, g, b] = paletteAt(t * 6 + (x + (y + r0) * 0.6) * 0.012);
          fx[o] = r;
          fx[o + 1] = g;
          fx[o + 2] = b;
          fx[o + 3] = 200;
        }
      }

      if (!alive && !wiping) {
        field.fill(0);
        setStatic(current);
        return;
      }
      band0 = next0;
      band1 = next1;

      if (target === 'ink' && !wiping) {
        // Ink is fully shown above and below the band.
        const W = cols * CELL;
        path.push(`M0 0h${W}v${r0 * CELL}h${-W}z`);
        path.push(`M0 ${(r1 + 1) * CELL}h${W}V${rows * CELL}h${-W}z`);
      }
      // An empty path() is invalid; a zero-area one hides everything.
      setClip(`path('${path.length ? path.join('') : 'M0 0z'}')`);

      for (const c of [fringe, glow]) {
        if (c.height !== h) c.height = h;
        if (c.width !== cols) c.width = cols;
        c.style.top = `${r0 * CELL}px`;
        c.style.height = `${h * CELL}px`;
      }
      fctx.putImageData(fringeImg, 0, 0);
      gctx.clearRect(0, 0, cols, h);
      gctx.drawImage(fringe, 0, 0);
      if (wiping || calm > 0 || grew || moving) schedule();
    };

    function schedule() {
      if (!frame) frame = requestAnimationFrame(draw);
    }

    const release = () => {
      aim = pos = last = null;
    };
    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') touch = { cx: e.clientX, cy: e.clientY };
      aim = toStage(e.clientX, e.clientY);
      schedule();
    };
    const onPointerLeave = release;
    // While a finger scrolls the page, it stays put on screen but travels through the document.
    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0];
      touch = { cx: t.clientX, cy: t.clientY };
      pos = last = null;
      aim = toStage(t.clientX, t.clientY);
      schedule();
    };
    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      touch = { cx: t.clientX, cy: t.clientY };
    };
    const onTouchEnd = () => {
      touch = null;
      release();
    };
    const onScroll = () => {
      if (!touch) return;
      aim = toStage(touch.cx, touch.cy);
      schedule();
    };

    api.current = {
      wipe: (to, clientX, clientY) => {
        const p = toStage(clientX, clientY);
        field.fill(0);
        reach.fill(0);
        lastInput = performance.now();
        if (reduceMotion) {
          current = to;
          wipe = null;
        } else {
          wipe = { from: current, to, cx: p.x / CELL, cy: p.y / CELL, t: performance.now() };
        }
        schedule();
      },
    };

    // On touch screens a single stroke across the hero hints that the page can be scratched.
    // Desktop gets no intro: the cursor itself starts scratching right away.
    if (!reduceMotion && matchMedia('(hover: none)').matches) {
      const start = performance.now() + 700;
      const run = (now: number) => {
        const p = (now - start) / 1100;
        if (p < 0) {
          intro = requestAnimationFrame(run);
          return;
        }
        const k = Math.min(1, p);
        const w = stage.offsetWidth;
        aim = { x: w * (0.06 + 0.88 * k), y: 150 + Math.sin(k * Math.PI * 2.2) * 60 };
        schedule();
        if (p < 1) intro = requestAnimationFrame(run);
        else if (!touch) release();
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
      <canvas ref={glowRef} className="fringe fringe-glow" aria-hidden="true" />
      <canvas ref={fringeRef} className="fringe" aria-hidden="true" />
      <button type="button" className="toggle" onClick={toggle} aria-pressed={mode === 'ink'}>
        {mode === 'raw' ? '✦ Reveal design' : '↺ Raw mode'}
      </button>
    </div>
  );
}
