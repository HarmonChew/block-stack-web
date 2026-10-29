// Canvas drawing: pixel blocks in the level palette, the NES-style line-clear wipe
// and the top-out sweep.
import type { View } from "./engine.ts";
import { DEAD, WHITE, blockStyle, palette, type Palette } from "./palette.ts";

const WELL = "#05060a";

export interface BoardFx {
  hidden?: boolean; // paused: show an empty well
  clear?: { board: Uint8Array; rows: number; step: number; flash: boolean }; // step 0-5
  dead?: number; // top-out sweep, 0-1
}

/** Sizes the canvas to whole device pixels per cell inside its parent; returns the cell size. */
export function fitCanvas(canvas: HTMLCanvasElement, columns: number, rows: number): number {
  const ratio = devicePixelRatio || 1;
  const parent = canvas.parentElement!;
  const cell = Math.max(3, Math.floor((parent.clientWidth * ratio) / columns));
  if (canvas.width !== cell * columns || canvas.height !== cell * rows) {
    canvas.width = cell * columns;
    canvas.height = cell * rows;
    canvas.style.width = `${canvas.width / ratio}px`;
    canvas.style.height = `${canvas.height / ratio}px`;
  }
  return cell;
}

function rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  const left = Math.round(x);
  const top = Math.round(y);
  ctx.fillRect(left, top, Math.round(x + w) - left, Math.round(y + h) - top);
}

/** One block on an 8x8 pixel grid: 7x7 body, a shine in the top left, a 1px gap. */
export function drawBlock(ctx: CanvasRenderingContext2D, x: number, y: number, size: number,
                          style: number, colours: Palette, dead = false): void {
  const u = size / 8;
  if (dead) {
    ctx.fillStyle = DEAD;
    rect(ctx, x, y, 7 * u, 7 * u);
    ctx.fillStyle = "#2b2f3a";
    rect(ctx, x + 2 * u, y + 2 * u, 3 * u, 3 * u);
    return;
  }
  ctx.fillStyle = style === 2 ? colours.b : colours.a;
  rect(ctx, x, y, 7 * u, 7 * u);
  ctx.fillStyle = WHITE;
  if (style === 0) {
    rect(ctx, x + u, y + u, 5 * u, 5 * u);
    rect(ctx, x, y, u, u);
  } else {
    rect(ctx, x, y, u, u);
    rect(ctx, x + u, y + u, 2 * u, u);
    rect(ctx, x + u, y + 2 * u, u, u);
  }
}

export function drawBoard(canvas: HTMLCanvasElement, view: View, fx: BoardFx = {}): void {
  const cell = fitCanvas(canvas, 10, 20);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = WELL;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (fx.hidden) return;
  const colours = palette(view.level);
  const clear = fx.clear;
  const board = clear ? clear.board : view.board;
  const deadRows = fx.dead === undefined ? -1 : Math.floor(fx.dead * 21) - 1;
  for (let y = 0; y < 20; y++) {
    const clearing = clear !== undefined && (clear.rows & (1 << y)) !== 0;
    for (let x = 0; x < 10; x++) {
      const piece = board[y * 10 + x];
      if (!piece) continue;
      // The wipe opens from the centre: step k has removed columns 5-k .. 4+k.
      if (clearing && x >= 5 - clear.step && x < 5 + clear.step) continue;
      drawBlock(ctx, x * cell, y * cell, cell, blockStyle(piece - 1), colours, y <= deadRows);
    }
    if (clearing && clear.flash) {
      ctx.fillStyle = "rgba(247, 244, 234, 0.55)";
      ctx.fillRect(0, y * cell, canvas.width, cell);
    }
  }
}

export function drawNext(canvas: HTMLCanvasElement, view: View): void {
  const cell = fitCanvas(canvas, 4, 2);
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (view.next > 6) return;
  const xs = view.nextCells.map(([x]) => x);
  const ys = view.nextCells.map(([, y]) => y);
  const width = Math.max(...xs) - Math.min(...xs) + 1;
  const height = Math.max(...ys) - Math.min(...ys) + 1;
  const left = (4 - width) / 2 - Math.min(...xs);
  const top = (2 - height) / 2 - Math.min(...ys);
  const colours = palette(view.level);
  for (const [x, y] of view.nextCells) {
    drawBlock(ctx, (x + left) * cell, (y + top) * cell, cell, blockStyle(view.next), colours);
  }
}
