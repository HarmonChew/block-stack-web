// The Block Stack engine (WebAssembly, built by wasm/build.sh) as a small TS API.
import createModule from "./engine/arena.mjs";

// Controller buttons: one bitmask per frame, as the engine and the bot records use.
export const LEFT = 1;
export const RIGHT = 2;
export const DOWN = 4;
export const ROTATE_CW = 8;
export const ROTATE_CCW = 16;

// NTSC frame rate the engine's timing assumes.
export const FPS = 60.0988;

// Phase values (blocks::Phase).
export const PHASE_LINE_CLEAR = 1;
export const PHASE_GAME_OVER = 3;

// arena_tick's event bits.
export const EV_LINES = 7;
export const EV_LOCKED = 8;
export const EV_LEVEL = 16;
export const EV_GAME_OVER = 32;
export const EV_MOVED = 64;
export const EV_ROTATED = 128;

export interface View {
  board: Uint8Array; // 200 cells, row-major, 0 empty, else piece + 1
  phase: number;
  next: number; // 0-6, 7 = none
  nextCells: [number, number][];
  clearingRows: number;
  score: number;
  lines: number;
  level: number;
  frame: number;
  clears: number[]; // singles, doubles, triples, tetrises
  hash: string; // 16 hex digits, as fallgorithm writes state hashes
}

interface ArenaModule {
  HEAPU8: Uint8Array;
  _malloc(size: number): number;
  _free(pointer: number): void;
  _arena_view_size(): number;
  _arena_create(startLevel: number, seed: number): number;
  _arena_destroy(game: number): void;
  _arena_tick(game: number, input: number): number;
  _arena_terminal(game: number): number;
  _arena_score(game: number): number;
  _arena_lines(game: number): number;
  _arena_view(game: number, out: number): void;
}

let loading: Promise<ArenaModule> | null = null;

export function loadEngine(): Promise<ArenaModule> {
  loading ??= createModule() as Promise<ArenaModule>;
  return loading;
}

export class Game {
  private readonly mod: ArenaModule;
  private readonly handle: number;
  private readonly viewPointer: number;

  constructor(mod: ArenaModule, startLevel: number, seed: number) {
    this.mod = mod;
    this.handle = mod._arena_create(startLevel, seed);
    this.viewPointer = mod._malloc(mod._arena_view_size());
  }

  /** Advances one frame with `input` held; returns the frame's event bits. */
  tick(input: number): number {
    return this.mod._arena_tick(this.handle, input);
  }

  get over(): boolean {
    return this.mod._arena_terminal(this.handle) === 1;
  }

  get score(): number {
    return this.mod._arena_score(this.handle);
  }

  get lines(): number {
    return this.mod._arena_lines(this.handle);
  }

  /** Just the 200 board cells (active piece drawn in), for line-clear animations. */
  board(): Uint8Array {
    this.mod._arena_view(this.handle, this.viewPointer);
    return this.mod.HEAPU8.slice(this.viewPointer, this.viewPointer + 200);
  }

  view(): View {
    this.mod._arena_view(this.handle, this.viewPointer);
    const bytes = this.mod.HEAPU8;
    const base = this.viewPointer;
    const data = new DataView(bytes.buffer, base, this.mod._arena_view_size());
    const nextCells: [number, number][] = [];
    for (let i = 0; i < 4; i++) {
      nextCells.push([data.getInt8(202 + 2 * i), data.getInt8(203 + 2 * i)]);
    }
    const low = data.getUint32(252, true).toString(16).padStart(8, "0");
    const high = data.getUint32(256, true).toString(16).padStart(8, "0");
    return {
      board: bytes.slice(base, base + 200),
      phase: data.getUint8(200),
      next: data.getUint8(201),
      nextCells,
      clearingRows: data.getUint32(212, true),
      score: data.getFloat64(216, true),
      lines: data.getInt32(224, true),
      level: data.getInt32(228, true),
      frame: data.getUint32(232, true),
      clears: [0, 1, 2, 3].map((i) => data.getUint32(236 + 4 * i, true)),
      hash: high + low,
    };
  }

  destroy(): void {
    this.mod._free(this.viewPointer);
    this.mod._arena_destroy(this.handle);
  }
}
