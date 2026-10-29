// The title logo: BLOCK / STACK in block letters, built by pieces falling into place.
import { drawBlock, fitCanvas } from "./render.ts";
import { palette } from "./palette.ts";

const LETTERS: Record<string, string[]> = {
  B: ["####.", "#...#", "####.", "#...#", "####."],
  L: ["#....", "#....", "#....", "#....", "#####"],
  O: [".###.", "#...#", "#...#", "#...#", ".###."],
  C: [".####", "#....", "#....", "#....", ".####"],
  K: ["#...#", "#..#.", "###..", "#..#.", "#...#"],
  S: [".####", "#....", ".###.", "....#", "####."],
  T: ["#####", "..#..", "..#..", "..#..", "..#.."],
  A: [".###.", "#...#", "#####", "#...#", "#...#"],
};
const WORDS = ["BLOCK", "STACK"];
const COLUMNS = 29; // five letters of five columns, one column between letters
const ROWS = 11; // two words of five rows, one row between them
const DROP_MS = 340;
const STAGGER_MS = 55;

interface Cell { x: number; y: number; style: number }
interface Piece { cells: Cell[]; start: number }

/** Splits the logo into falling pieces of up to four touching cells, bottom rows first. */
function buildPieces(): Piece[] {
  const groups: Cell[][] = [];
  WORDS.forEach((word, w) => {
    [...word].forEach((letter, l) => {
      const cells: Cell[] = [];
      LETTERS[letter].forEach((row, y) => [...row].forEach((mark, x) => {
        if (mark === "#") cells.push({ x: l * 6 + x, y: w * 6 + y, style: (w * 5 + l) % 3 });
      }));
      cells.sort((p, q) => q.y - p.y || p.x - q.x);
      const taken = new Set<Cell>();
      for (const seed of cells) {
        if (taken.has(seed)) continue;
        const group = [seed];
        taken.add(seed);
        for (let i = 0; i < group.length && group.length < 4; i++) {
          for (const next of cells) {
            if (group.length >= 4) break;
            if (!taken.has(next) && Math.abs(next.x - group[i].x) + Math.abs(next.y - group[i].y) === 1) {
              group.push(next);
              taken.add(next);
            }
          }
        }
        groups.push(group);
      }
    });
  });
  // Lowest pieces land first, letters interleaved left to right, so the words grow upwards.
  groups.sort((p, q) => Math.max(...q.map((c) => c.y)) - Math.max(...p.map((c) => c.y)) ||
    Math.min(...p.map((c) => c.x)) - Math.min(...q.map((c) => c.x)));
  return groups.map((cells, i) => ({ cells, start: i * STAGGER_MS }));
}

export class Logo {
  private readonly canvas: HTMLCanvasElement;
  private readonly pieces = buildPieces();
  private begun = 0;
  private level = 0;
  private recolour = { from: 0, at: -1 }; // a diagonal sweep into the next palette
  private landed = new Set<Piece>();
  onLand: () => void = () => undefined;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  get paletteLevel(): number {
    return this.level;
  }

  get done(): boolean {
    return performance.now() - this.begun > this.pieces.at(-1)!.start + DROP_MS;
  }

  /** Starts the build; with `instant` the logo appears complete. */
  start(instant: boolean): void {
    this.begun = instant ? -1e9 : performance.now();
    this.landed = new Set(instant ? this.pieces : []);
  }

  /** Recolours the logo into the next level's palette with a sweep across it. */
  nextPalette(): void {
    this.recolour = { from: this.level, at: performance.now() };
    this.level = (this.level + 1) % 10;
  }

  draw(now: number): void {
    const cell = fitCanvas(this.canvas, COLUMNS, ROWS + 4);
    const ctx = this.canvas.getContext("2d")!;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const top = 4 * cell; // room above the logo for pieces to fall through
    const sweep = (now - this.recolour.at) / 600;
    for (const piece of this.pieces) {
      const t = (now - this.begun - piece.start) / DROP_MS;
      if (t < 0) continue;
      const fall = t >= 1 ? 0 : (1 - t * t) * (top + 3 * cell);
      if (t >= 1 && !this.landed.has(piece)) {
        this.landed.add(piece);
        this.onLand();
      }
      for (const { x, y, style } of piece.cells) {
        const swept = sweep >= 1 || (x + y) / (COLUMNS + ROWS) < sweep;
        const colours = palette(swept ? this.level : this.recolour.from);
        drawBlock(ctx, x * cell, top + y * cell - fall, cell, style, colours);
      }
    }
  }
}
