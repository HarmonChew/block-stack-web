// The opponent screen's live preview: the chosen bot plays one of its recorded games.
import { FPS, Game, loadEngine, type View } from "./engine.ts";
import { loadBotGame } from "./bots.ts";
import { drawBoard } from "./render.ts";

const HEAD_START = 900; // frames skipped instantly, so the board is never empty

export class BotPreview {
  private readonly canvas: HTMLCanvasElement;
  private game: Game | null = null;
  private inputs: Uint8Array | null = null;
  private frame = 0;
  private token = 0;
  private accumulator = 0;
  onView: (view: View) => void = () => undefined;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  async play(level: number, bot: string, seed: number): Promise<void> {
    const token = ++this.token;
    const [mod, inputs] = await Promise.all([loadEngine(), loadBotGame(level, bot, seed)]);
    if (token !== this.token) return;
    this.game?.destroy();
    this.game = new Game(mod, level, seed);
    this.inputs = inputs;
    this.frame = 0;
    const skip = Math.min(HEAD_START, inputs.length - 1);
    while (this.frame < skip) this.game.tick(inputs[this.frame++]);
  }

  stop(): void {
    this.token++;
    this.game?.destroy();
    this.game = null;
  }

  /** Advances by `seconds` of play and draws; returns false once, when the recording ends. */
  update(seconds: number): boolean {
    if (!this.game || !this.inputs) return true;
    this.accumulator += seconds * FPS;
    while (this.accumulator >= 1) {
      this.accumulator--;
      if (this.frame >= this.inputs.length || this.game.over) {
        // Keep the last frame on screen while the caller loads the next game.
        this.game.destroy();
        this.game = null;
        this.inputs = null;
        return false;
      }
      this.game.tick(this.inputs[this.frame++]);
    }
    const view = this.game.view();
    drawBoard(this.canvas, view);
    this.onView(view);
    return true;
  }
}
