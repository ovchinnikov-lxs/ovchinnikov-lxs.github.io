// Shared bits for the image templates rendered by generate.mjs (runs in the browser).
const PALETTE = ['#a78bfa', '#60a5fa', '#67e8f9', '#c6f432', '#f472b6'];

// Deterministic PRNG so regenerated images stay identical.
function rng(seed) {
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
}

/** Covers the left part of `el` with white "raw" pixels dissolving into it, with an iridescent fringe. */
function dissolve(el, { cell, depth, seed }) {
  const rand = rng(seed);
  const { width, height } = el.getBoundingClientRect();
  const cols = Math.ceil(width / cell);
  const rows = Math.ceil(height / cell);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < Math.min(cols, depth + 2); x++) {
      const v = 1 - x / depth + (rand() - 0.5) * 0.9;
      let color = null;
      if (v > 0.55) color = '#fff';
      else if (v > 0.35) color = PALETTE[(x + y + Math.floor(rand() * 2)) % PALETTE.length];
      if (!color) continue;
      const d = document.createElement('i');
      d.style.cssText = `position:absolute;left:${x * cell}px;top:${y * cell}px;width:${cell}px;height:${cell}px;background:${color};opacity:${color === '#fff' ? 1 : 0.9}`;
      el.appendChild(d);
    }
  }
}

window.dissolve = dissolve;
