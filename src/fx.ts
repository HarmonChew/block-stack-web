// Full-screen effects: the block wipe between screens (a stack rises to cover the
// screen, then its rows clear from the centre out) and block rain when you win.
import { drawBlock } from "./render.ts";
import type { Palette } from "./palette.ts";

export const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

const COVER_MS = 300;
const REVEAL_MS = 320;

function layer(id: string): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; ratio: number } {
  const canvas = document.getElementById(id) as HTMLCanvasElement;
  const ratio = devicePixelRatio || 1;
  canvas.width = Math.round(innerWidth * ratio);
  canvas.height = Math.round(innerHeight * ratio);
  return { canvas, ctx: canvas.getContext("2d")!, ratio };
}

const frameAt = () => new Promise<number>((resolve) => requestAnimationFrame(resolve));

/** Covers the screen with blocks, calls `swap` under cover, then clears the rows away. */
export async function wipe(swap: () => void, colours: Palette): Promise<void> {
  if (reducedMotion()) {
    swap();
    return;
  }
  const { canvas, ctx, ratio } = layer("wipe");
  canvas.hidden = false;
  const cell = Math.round((innerWidth < 640 ? 32 : 44) * ratio);
  const columns = Math.ceil(canvas.width / cell);
  const rows = Math.ceil(canvas.height / cell);
  const styles = Array.from({ length: columns * rows }, () => Math.floor(Math.random() * 3));
  const draw = (visibleRows: number, gap: number, flash: boolean) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let r = 0; r < visibleRows; r++) {
      const y = canvas.height - (r + 1) * cell;
      ctx.fillStyle = "#05060a";
      ctx.fillRect(0, y, canvas.width, cell);
      for (let c = 0; c < columns; c++) {
        if (Math.abs(c + 0.5 - columns / 2) < gap) continue;
        drawBlock(ctx, c * cell, y, cell, styles[r * columns + c], colours);
      }
    }
    if (flash) {
      ctx.fillStyle = "rgba(247, 244, 234, 0.6)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  };
  try {
    let start = await frameAt();
    for (let now = start; now - start < COVER_MS; now = await frameAt()) {
      draw(Math.ceil(((now - start) / COVER_MS) * rows), 0, false);
    }
    draw(rows, 0, true);
    swap();
    start = await frameAt();
    for (let now = start; now - start < REVEAL_MS; now = await frameAt()) {
      // Five clearing steps, like a line clear, the gap growing from the centre.
      const step = Math.floor(((now - start) / REVEAL_MS) * 6);
      draw(rows, (step / 5) * (columns / 2), step === 0);
    }
  } finally {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    canvas.hidden = true;
  }
}

/** A shower of blocks in the palette, for a win. */
export function blockRain(colours: Palette): void {
  if (reducedMotion()) return;
  const { canvas, ctx, ratio } = layer("fx");
  canvas.hidden = false;
  const blocks = Array.from({ length: 90 }, () => ({
    x: Math.random() * canvas.width,
    y: -Math.random() * canvas.height * 0.6 - 40 * ratio,
    vx: (Math.random() - 0.5) * 3 * ratio,
    vy: Math.random() * 2 * ratio,
    size: Math.round((14 + Math.random() * 14) * ratio),
    style: Math.floor(Math.random() * 3),
  }));
  const begun = performance.now();
  let last = begun;
  const tick = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000) * 60;
    last = now;
    const age = (now - begun) / 1000;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = Math.max(0, Math.min(1, (3 - age) / 0.6));
    for (const block of blocks) {
      block.vy += 0.25 * ratio * dt;
      block.x += block.vx * dt;
      block.y += block.vy * dt;
      drawBlock(ctx, block.x, block.y, block.size, block.style, colours);
    }
    ctx.globalAlpha = 1;
    if (age < 3) requestAnimationFrame(tick);
    else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      canvas.hidden = true;
    }
  };
  requestAnimationFrame(tick);
}
