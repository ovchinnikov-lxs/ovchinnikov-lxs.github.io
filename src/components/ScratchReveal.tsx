'use client';

import { type ReactNode, useEffect, useRef, useState } from 'react';

/** Size of one "diffusion" pixel, CSS px. */
const CELL = 8;
/** Brush radius, CSS px: a share of the viewport width, clamped. */
const brushFor = (viewport: number) => Math.min(240, Math.max(110, viewport * 0.17));
/** Edges flicker harder right after input, then settle to a calmer flicker that never stops. */
const SETTLE_MS = 1600;
/** Edge cells jump in and out of the revealed area in discrete steps of this length. */
const FLICKER_MS = 120;
/** Idle frames (only the flicker is running) are throttled to this interval, and only on-screen rows are redrawn. */
const IDLE_FRAME_MS = 1000 / 15;
const FIELD_MAX = 1.5;
/** Brush inertia: spring towards the pointer, then damping. */
const SPRING = 0.16;
const DAMP = 0.8;
/**
 * Ink drops (click / tap) spread, noise-dissolve style: every cell of a drop gets a travel budget (px)
 * and creeps outwards, paying more per cell downwards and much more upwards — so it reaches the
 * screen edges sideways, goes down noticeably less, and up barely. Costs are modulated by a
 * coherent noise field (fingers instead of a diamond), and the front fades out as the budget
 * drains, so where it stops is decided by the noise threshold — no straight edges.
 */
const REACH = 1600;
const COST_X = CELL;
const COST_DOWN = CELL * 3.2;
const COST_UP = CELL * 9;
/** Last stretch of the budget over which the front fades out, px. */
const FADE = 1000;
/** Chance a cell spreads on a given frame: the front creeps at ~150 px/s. */
const SPREAD_CHANCE = 0.32;
/** Pointer travel (px) that turns a press into a drag; less is a click = ink drop. */
const DRAG_SLOP = 6;
const TAP_SLOP = 10;
const TAP_MS = 450;
/** Holding still this long turns a press into pouring: the blob keeps growing until release. */
const HOLD_MS = { mouse: 220, touch: 320 };
const WIPE_MS = 600;
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

/** Seeded value noise + fBm on the cell grid: smooth, organic thresholds instead of white noise. */
function valueNoise(seed: number) {
  const hash = (x: number, y: number) => {
    let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };
  const smooth = (t: number) => t * t * (3 - 2 * t);
  const at = (x: number, y: number) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const u = smooth(x - xi);
    const v = smooth(y - yi);
    const a = hash(xi, yi) + (hash(xi + 1, yi) - hash(xi, yi)) * u;
    const b = hash(xi, yi + 1) + (hash(xi + 1, yi + 1) - hash(xi, yi + 1)) * u;
    return a + (b - a) * v;
  };
  return (x: number, y: number) => (at(x, y) * 0.57 + at(x * 2.1, y * 2.1) * 0.29 + at(x * 4.3, y * 4.3) * 0.14);
}

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
 * Press-and-drag erases (with a little brush inertia); a click or tap drops ink that
 * spreads on its own (noise dissolve): sideways to the screen edges, down less, up barely.
 * Hovering and scrolling never paint — the visitor sees "before" and chooses when to act.
 * Only the clip changes, so nothing reflows and text never moves (no CLS).
 */
export function ScratchReveal({ raw, ink }: { raw: ReactNode; ink: ReactNode }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const inkRef = useRef<HTMLDivElement>(null);
  const fringeRef = useRef<HTMLCanvasElement>(null);
  const glowRef = useRef<HTMLCanvasElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<Mode>('raw');
  // The hint stays until the visitor first presses on the page (or uses the toggle).
  const [used, setUsed] = useState(false);
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
    let drag = new Float32Array(1);
    const thresholdNoise = valueNoise(7);
    const dragNoise = valueNoise(13);
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
    let frame = 0;
    let brush = brushFor(window.innerWidth);
    let lastInput = 0;

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
      drag = new Float32Array(cols * rows);
      for (let y = 0, i = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++, i++) {
          // Mostly smooth fBm (organic contours) with a little per-pixel grain on top.
          noise[i] = 0.12 + 0.76 * (thresholdNoise(x / 10, y / 10) * 0.85 + Math.random() * 0.15);
          phase[i] = Math.random() * Math.PI * 2;
          drag[i] = 0.35 + 1.7 * dragNoise(x / 16, y / 16);
        }
      }
      for (const c of [fringe, glow]) c.style.width = `${cols * CELL}px`;
      schedule();
    };

    const toStage = (clientX: number, clientY: number) => {
      const r = stage.getBoundingClientRect();
      return { x: clientX - r.left, y: clientY - r.top };
    };

    /** Adds a gaussian blob of "denoise" energy around (x, y), in CSS px. */
    const splat = (x: number, y: number, radius = brush, amount = 0.55, budget = 0) => {
      const cx = x / CELL;
      const cy = y / CELL;
      const rad = radius / CELL;
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
          const k = Math.exp(-d2 / s2);
          field[i] = Math.min(FIELD_MAX, field[i] + amount * k);
          if (budget) reach[i] = Math.max(reach[i], budget * Math.min(1, k * 2));
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

    /** Lets uncovered areas creep outwards: values are copied while the budget lasts, then fade. */
    const spread = (r0: number, r1: number) => {
      const base = r0 * cols;
      const pf = field.slice(base, (r1 + 1) * cols);
      const pr = reach.slice(base, (r1 + 1) * cols);
      let grew = false;
      for (let y = r0; y <= r1; y++) {
        for (let x = 0; x < cols; x++) {
          if (Math.random() > SPREAD_CHANCE) continue;
          const i = y * cols + x;
          const k = drag[i];
          for (let dy = -1; dy <= 1; dy++) {
            const sy = y + dy;
            if (sy < r0 || sy > r1) continue;
            // dy = -1: the source is above, so this cell is reached by spreading down.
            const vertical = dy < 0 ? COST_DOWN : dy > 0 ? COST_UP : 0;
            for (let dx = -1; dx <= 1; dx++) {
              const sx = x + dx;
              if ((dx === 0 && dy === 0) || sx < 0 || sx >= cols) continue;
              const j = (sy - r0) * cols + sx;
              const budget = pr[j] - Math.hypot(dx * COST_X, vertical) * k;
              if (budget <= 0) continue;
              const value = pf[j] * Math.min(1, budget / FADE);
              if (value <= field[i] + 0.01) continue;
              field[i] = value;
              reach[i] = Math.max(reach[i], budget);
              grew = true;
            }
          }
        }
      }
      return grew;
    };

    // Persistent per-row results, so idle frames can redraw only the rows on screen.
    let rowPath: string[] = [];
    let onAll = new Uint8Array(1);
    let img: ImageData | null = null;
    let imgR0 = 0;
    let lastIdle = 0;

    const visibleRows = (): [number, number] => {
      const top = stage.getBoundingClientRect().top;
      return [Math.max(0, Math.floor(-top / CELL) - 2), Math.min(rows - 1, Math.ceil((innerHeight - top) / CELL) + 2)];
    };

    const draw = (now: number) => {
      frame = 0;
      const moving = stepBrush() || pourStep(now);
      let wipeR = 0;
      const wipeBand = 16;
      let wiping = false;
      if (wipe) {
        // rAF timestamps can predate the click that started the wipe.
        const p = Math.min(1, Math.max(0, (now - wipe.t) / WIPE_MS));
        const eased = 1 - Math.pow(1 - p, 3);
        const far = Math.hypot(Math.max(wipe.cx, cols - wipe.cx), Math.max(wipe.cy, rows - wipe.cy));
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
      const calm = Math.max(0, 1 - (now - lastInput) / SETTLE_MS);
      const active = wiping || grew || moving || calm > 0;

      // Full frame: the whole band. Idle frame: just the flicker, on-screen rows only, throttled.
      const full = active || !img || imgR0 !== r0 || img.height !== h || img.width !== cols;
      let p0 = r0;
      let p1 = r1;
      if (!full) {
        if (now - lastIdle < IDLE_FRAME_MS) return schedule();
        lastIdle = now;
        const [v0, v1] = visibleRows();
        p0 = Math.max(r0, v0);
        p1 = Math.min(r1, v1);
        if (p1 < p0) return schedule();
      } else {
        img = new ImageData(cols, h);
        imgR0 = r0;
        if (onAll.length !== cols * rows) onAll = new Uint8Array(cols * rows);
        if (rowPath.length !== rows) rowPath = new Array<string>(rows).fill('');
      }

      const fx = img!.data;
      const t = now * 0.00012;
      const amp = reduceMotion ? 0 : 0.05 + 0.07 * calm;
      let alive = !full;
      let next0 = Infinity;
      let next1 = -1;

      for (let y = p0; y <= p1; y++) {
        let run = -1;
        let row = '';
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
          // Abrupt flicker: each cell jumps to a new random offset every FLICKER_MS, out of phase with its neighbours.
          const step = Math.floor((now + phase[i] * 100) / FLICKER_MS);
          let hsh = Math.imul(i ^ (step * 0x9e3779b1), 0x85ebca6b);
          hsh ^= hsh >>> 13;
          const jitter = ((hsh >>> 0) / 4294967295) * 2 - 1;
          const thr = noise[i] + jitter * amp;
          const on = v > thr;
          onAll[i] = on ? 1 : 0;
          if (on && run < 0) run = x;
          if (!on && run >= 0) {
            row += `M${run * CELL} ${y * CELL}h${(x - run) * CELL}v${CELL}h${(run - x) * CELL}z`;
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
        if (run >= 0) row += `M${run * CELL} ${y * CELL}h${(cols - run) * CELL}v${CELL}h${(run - cols) * CELL}z`;
        rowPath[y] = row;
      }

      // Thin iridescent outline on every boundary, so a sharp spreading front glows too.
      // It sits on the side that is not being uncovered (raw in raw mode, ink in ink mode).
      const side = target === 'ink' && !wiping ? 1 : 0;
      for (let y = p0; y <= p1; y++) {
        for (let x = 0, i = y * cols; x < cols; x++, i++) {
          if (onAll[i] !== side) continue;
          const edge =
            (x > 0 && onAll[i - 1] !== side) ||
            (x < cols - 1 && onAll[i + 1] !== side) ||
            (y > r0 && onAll[i - cols] !== side) ||
            (y < r1 && onAll[i + cols] !== side);
          const o = ((y - r0) * cols + x) * 4;
          if (!edge || fx[o + 3] > 0) continue;
          const [r, g, b] = paletteAt(t * 6 + (x + y * 0.6) * 0.012);
          fx[o] = r;
          fx[o + 1] = g;
          fx[o + 2] = b;
          fx[o + 3] = 150;
        }
      }

      if (!alive && !wiping) {
        field.fill(0);
        setStatic(current);
        return;
      }
      if (full) {
        band0 = next0;
        band1 = next1;
      }

      const path = rowPath.slice(r0, r1 + 1);
      if (target === 'ink' && !wiping) {
        // Ink is fully shown above and below the band.
        const W = cols * CELL;
        path.push(`M0 0h${W}v${r0 * CELL}h${-W}z`);
        path.push(`M0 ${(r1 + 1) * CELL}h${W}V${rows * CELL}h${-W}z`);
      }
      const d = path.join('');
      // An empty path() is invalid; a zero-area one hides everything.
      setClip(`path('${d || 'M0 0z'}')`);

      if (full) {
        for (const c of [fringe, glow]) {
          if (c.height !== h) c.height = h;
          if (c.width !== cols) c.width = cols;
          c.style.top = `${r0 * CELL}px`;
          c.style.height = `${h * CELL}px`;
        }
        fctx.putImageData(img!, 0, 0);
        gctx.clearRect(0, 0, cols, h);
        gctx.drawImage(fringe, 0, 0);
      } else {
        const y = p0 - r0;
        const hh = p1 - p0 + 1;
        fctx.putImageData(img!, 0, 0, 0, y, cols, hh);
        gctx.clearRect(0, y, cols, hh);
        gctx.drawImage(fringe, 0, y, cols, hh, 0, y, cols, hh);
      }
      // Keep running: edges flicker forever (idle frames are cheap); stop only for reduced motion.
      if (active || !reduceMotion) schedule();
    };

    function schedule() {
      if (!frame) frame = requestAnimationFrame(draw);
    }

    /** One organic blob shape: a few overlapping lobes along a random axis, as offsets for a blob of `size`. */
    const blobShape = (size: number) => {
      const angle = Math.random() * Math.PI * 2;
      const stretch = 1 + Math.random() * 0.8;
      const count = 3 + Math.floor(Math.random() * 3);
      return Array.from({ length: count }, (_, k) => {
        const along = (k / (count - 1) - 0.5) * size * (stretch - 0.6);
        const across = (Math.random() - 0.5) * size * 0.35;
        return {
          dx: Math.cos(angle) * along - Math.sin(angle) * across,
          dy: Math.sin(angle) * along + Math.cos(angle) * across,
          r: 0.65 + Math.random() * 0.3,
        };
      });
    };

    /** A click / tap drops one big ink blob that then spreads on its own. */
    const drop = (x: number, y: number) => {
      const size = brush * (0.85 + Math.random() * 0.55);
      const budget = reduceMotion ? 0 : REACH * (0.4 + Math.random() * 0.6);
      for (const l of blobShape(size)) splat(x + l.dx, y + l.dy, size * l.r, 1.1, budget);
      lastInput = performance.now();
      schedule();
    };

    // Press and hold still: ink keeps pouring from that spot and the blob grows until release.
    let pour: { x: number; y: number; t: number; hold: number; base: number; budget: number; lobes: ReturnType<typeof blobShape> } | null = null;
    function pourStep(now: number) {
      if (!pour) return false;
      const held = now - pour.t - pour.hold;
      if (held < 0) return true;
      const max = Math.max(innerWidth, 600) * 0.7;
      const size = Math.min(max, brush * 0.5 + (held / 1000) * brush * 1.2);
      const k = size / pour.base;
      for (const l of pour.lobes) splat(pour.x + l.dx * k, pour.y + l.dy * k, size * l.r, 0.08, pour.budget);
      lastInput = now;
      return true;
    }

    // Desktop: hovering never paints. Press and drag erases; a click drops ink; press and hold pours it.
    // Touch: scrolling never paints; a tap drops ink; press and hold pours it. Intent first, effect second.
    let press: { x: number; y: number; t: number; type: string; dragging: boolean } | null = null;
    let client: { x: number; y: number } | null = null;
    const onFirstUse = () => setUsed(true);
    /** Desktop hint follows the cursor, so the "how" sits right where the action will happen. */
    const onHover = (e: PointerEvent) => {
      const h = hintRef.current;
      if (!h || e.pointerType !== 'mouse') return;
      h.style.transform = `translate(${e.clientX + 18}px, ${e.clientY + 22}px)`;
      h.dataset.show = isControl(e.target) ? '' : '1';
    };
    const onMouseOut = (e: MouseEvent) => {
      if (!e.relatedTarget && hintRef.current) hintRef.current.dataset.show = '';
    };
    const isControl = (t: EventTarget | null) => t instanceof Element && !!t.closest('a, button');

    const lift = () => {
      aim = pos = last = null;
      stage.classList.remove('is-drawing');
    };
    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 || isControl(e.target)) return;
      // No text selection while erasing with the mouse.
      if (e.pointerType !== 'touch') e.preventDefault();
      press = { x: e.clientX, y: e.clientY, t: performance.now(), type: e.pointerType, dragging: false };
      const q = toStage(e.clientX, e.clientY);
      const hold = e.pointerType === 'touch' ? HOLD_MS.touch : HOLD_MS.mouse;
      const budget = reduceMotion ? 0 : REACH * 0.8;
      pour = { x: q.x, y: q.y, t: press.t, hold, base: brush, budget, lobes: blobShape(brush) };
      schedule();
      onFirstUse();
    };
    const onPointerMove = (e: PointerEvent) => {
      client = { x: e.clientX, y: e.clientY };
      onHover(e);
      if (!press || press.type === 'touch') return;
      if (!press.dragging) {
        if (Math.hypot(e.clientX - press.x, e.clientY - press.y) < DRAG_SLOP) return;
        press.dragging = true;
        pour = null;
        stage.classList.add('is-drawing');
        pos = toStage(press.x, press.y);
        last = null;
      }
      aim = toStage(e.clientX, e.clientY);
      schedule();
    };
    const onPointerUp = (e: PointerEvent) => {
      if (!press) return;
      const p = press;
      press = null;
      const poured = !!pour && performance.now() - pour.t > pour.hold;
      pour = null;
      if (p.dragging) return lift();
      if (poured) return;
      const slop = p.type === 'touch' ? TAP_SLOP : DRAG_SLOP;
      const tap = Math.hypot(e.clientX - p.x, e.clientY - p.y) < slop && performance.now() - p.t < TAP_MS;
      if (tap && !isControl(e.target)) {
        const q = toStage(e.clientX, e.clientY);
        drop(q.x, q.y);
      }
    };
    const onPointerCancel = () => {
      // The browser took over (e.g. a touch became a scroll): never paint.
      press = null;
      pour = null;
      lift();
    };
    // Scrolling mid-drag moves the document under a still pointer: re-anchor instead of drawing a streak.
    const onScroll = () => {
      if (!press?.dragging || !client) return;
      pos = last = null;
      aim = toStage(client.x, client.y);
    };

    api.current = {
      wipe: (to, clientX, clientY) => {
        const p = toStage(clientX, clientY);
        // Toggling again mid-wipe: settle the running wipe first, then start from its end state.
        if (wipe) current = wipe.to;
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

    const ro = new ResizeObserver(resize);
    ro.observe(stage);
    resize();
    stage.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('mouseout', onMouseOut);

    return () => {
      document.removeEventListener('mouseout', onMouseOut);
      ro.disconnect();
      cancelAnimationFrame(frame);
      stage.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerCancel);
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
    setUsed(true);
  };

  return (
    <div ref={stageRef} className="stage" data-mode={mode}>
      <main>{raw}</main>
      <div ref={inkRef} className="ink-layer" aria-hidden="true" inert>
        {ink}
      </div>
      <canvas ref={glowRef} className="fringe fringe-glow" aria-hidden="true" />
      <canvas ref={fringeRef} className="fringe" aria-hidden="true" />
      {!used && (
        <div ref={hintRef} className="hint" aria-hidden="true">
          <span className="hint-pointer">✦ Drag to erase · click to drop ink · hold to pour</span>
          <span className="hint-touch">✦ Tap to drop ink · hold to pour</span>
        </div>
      )}
      <button type="button" className="toggle" onClick={toggle} aria-pressed={mode === 'ink'}>
        {mode === 'raw' ? '✦ Reveal design' : '↺ Raw mode'}
      </button>
    </div>
  );
}
