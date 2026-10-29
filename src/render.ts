// Canvas drawing for a board and its next-piece box, in the desktop client's colors.
import { PHASE_LINE_CLEAR, type View } from "./engine.ts";

const COLORS = ["#5bdce5", "#649bf4", "#ffb15b", "#e9da6f", "#71d98e", "#be8dec", "#ee7491"];
const BOARD_BG = "#060d16";
const GRID = "rgba(48, 69, 79, 0.37)";

function fitCanvas(canvas: HTMLCanvasElement, columns: number, rows: number): number {
  const ratio = devicePixelRatio || 1;
  const cell = Math.max(4, Math.floor((canvas.clientWidth * ratio) / columns));
  if (canvas.width !== cell * columns || canvas.height !== cell * rows) {
    canvas.width = cell * columns;
    canvas.height = cell * rows;
  }
  return cell;
}

function block(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, piece: number): void {
  const inset = Math.max(1, Math.round(size / 24));
  ctx.fillStyle = COLORS[piece - 1] ?? "#8fa3b1";
  ctx.fillRect(x + inset, y + inset, size - 2 * inset, size - 2 * inset);
  ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
  ctx.fillRect(x + size * 0.16, y + size * 0.16, size * 0.68, Math.max(1, size * 0.12));
  ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
  ctx.fillRect(x + size * 0.8, y + size * 0.16, Math.max(1, size * 0.08), size * 0.68);
}

export function drawBoard(canvas: HTMLCanvasElement, view: View, hidden = false): void {
  const cell = fitCanvas(canvas, 10, 20);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = BOARD_BG;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = GRID;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 1; x < 10; x++) {
    ctx.moveTo(x * cell + 0.5, 0);
    ctx.lineTo(x * cell + 0.5, canvas.height);
  }
  for (let y = 1; y < 20; y++) {
    ctx.moveTo(0, y * cell + 0.5);
    ctx.lineTo(canvas.width, y * cell + 0.5);
  }
  ctx.stroke();
  if (hidden) return;
  const flashing = view.phase === PHASE_LINE_CLEAR;
  for (let y = 0; y < 20; y++) {
    for (let x = 0; x < 10; x++) {
      const piece = view.board[y * 10 + x];
      if (piece) block(ctx, x * cell, y * cell, cell, piece);
    }
    if (flashing && view.clearingRows & (1 << y)) {
      ctx.fillStyle = "rgba(235, 245, 251, 0.55)";
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
  for (const [x, y] of view.nextCells) block(ctx, (x + left) * cell, (y + top) * cell, cell, view.next + 1);
}
