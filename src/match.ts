// One match: a human game and/or a recorded bot game on the same seed, stepped
// one frame at a time, with each mode's win rule.
import { EV_LINES, Game, loadEngine } from "./engine.ts";
import { BLITZ_FRAMES, SPRINT_LINES, type ModeId } from "./modes.ts";

export type Kind = ModeId | "solo" | "watch";
export type Winner = "you" | "bot" | "tie";

export interface Result {
  winner: Winner | null; // null in solo and watch
  reason: string;
}

export interface Side {
  game: Game;
  out: boolean; // topped out, or (bot) its recording ended
  outFrame: number;
  sprintFrame: number; // frame it reached SPRINT_LINES, 0 if not yet
  tetrises: number;
  lastEvents: number;
}

function side(game: Game): Side {
  return { game, out: false, outFrame: 0, sprintFrame: 0, tetrises: 0, lastEvents: 0 };
}

export class Match {
  frame = 0;
  result: Result | null = null;
  readonly you: Side | null;
  readonly bot: Side | null;
  readonly kind: Kind;
  private readonly botInputs: Uint8Array | null;
  private readonly botName: string;

  private constructor(kind: Kind, you: Game | null, bot: Game | null,
                      botInputs: Uint8Array | null, botName: string) {
    this.kind = kind;
    this.you = you ? side(you) : null;
    this.bot = bot ? side(bot) : null;
    this.botInputs = botInputs;
    this.botName = botName;
  }

  static async create(kind: Kind, level: number, seed: number,
                      botInputs: Uint8Array | null, botName = "The bot"): Promise<Match> {
    const mod = await loadEngine();
    const you = kind === "watch" ? null : new Game(mod, level, seed);
    const bot = botInputs ? new Game(mod, level, seed) : null;
    return new Match(kind, you, bot, botInputs, botName);
  }

  /** True once the human is out but the bot still has to finish the match. */
  get botOnly(): boolean {
    return !this.result && (this.you === null || this.you.out);
  }

  /** Advances one frame; `input` is the human's held buttons. */
  step(input: number): void {
    if (this.result) return;
    const timeUp = this.kind === "blitz" && this.frame >= BLITZ_FRAMES;
    if (!timeUp) {
      const frame = this.frame;
      if (this.you && !this.you.out) this.advance(this.you, input);
      if (this.bot && !this.bot.out) {
        if (frame < this.botInputs!.length) this.advance(this.bot, this.botInputs![frame]);
        if (frame + 1 >= this.botInputs!.length && !this.bot.out) {
          this.bot.out = true;
          this.bot.outFrame = frame + 1;
        }
      }
      this.frame++;
    }
    this.result = this.decide();
  }

  /** Runs the match to its end without waiting (the human must already be out). */
  finish(): void {
    while (!this.result) this.step(0);
  }

  destroy(): void {
    this.you?.game.destroy();
    this.bot?.game.destroy();
  }

  private advance(player: Side, input: number): void {
    const events = player.game.tick(input);
    player.lastEvents |= events;
    if ((events & EV_LINES) === 4) player.tetrises++;
    if (!player.sprintFrame && player.game.lines >= SPRINT_LINES) player.sprintFrame = this.frame + 1;
    if (player.game.over) {
      player.out = true;
      player.outFrame = this.frame + 1;
    }
  }

  private decide(): Result | null {
    const you = this.you;
    const bot = this.bot;
    const name = this.botName;
    if (this.kind === "solo") return you!.out ? { winner: null, reason: "Game over" } : null;
    if (this.kind === "watch") return bot!.out ? { winner: null, reason: `${name} is done` } : null;
    if (!you || !bot) return null;

    if (this.kind === "sprint") {
      if (you.sprintFrame && bot.sprintFrame) {
        if (you.sprintFrame === bot.sprintFrame) return { winner: "tie", reason: "Dead heat!" };
        return you.sprintFrame < bot.sprintFrame
          ? { winner: "you", reason: `You reached ${SPRINT_LINES} lines first` }
          : { winner: "bot", reason: `${name} reached ${SPRINT_LINES} lines first` };
      }
      if (you.sprintFrame) return { winner: "you", reason: `You reached ${SPRINT_LINES} lines first` };
      if (bot.sprintFrame) return { winner: "bot", reason: `${name} reached ${SPRINT_LINES} lines first` };
      if (you.out && bot.out) {
        return you.outFrame === bot.outFrame
          ? { winner: "tie", reason: "You both topped out" }
          : you.outFrame > bot.outFrame
            ? { winner: "you", reason: `${name} topped out first` }
            : { winner: "bot", reason: "You topped out first" };
      }
      if (you.out) return { winner: "bot", reason: "You topped out first" };
      if (bot.out) return { winner: "you", reason: `${name} topped out first` };
      return null;
    }

    // Blitz and Score Duel: higher score wins. Scores only grow, so a player who
    // is out loses as soon as the other passes them.
    const yours = you.game.score;
    const theirs = bot.game.score;
    if (you.out && theirs > yours) return { winner: "bot", reason: `${name} passed your score` };
    if (bot.out && yours > theirs) return { winner: "you", reason: `You beat ${name}'s final score` };
    const ended = (you.out && bot.out) || (this.kind === "blitz" && this.frame >= BLITZ_FRAMES);
    if (!ended) return null;
    const why = this.kind === "blitz" && this.frame >= BLITZ_FRAMES ? "Time!" : "Both players are out";
    if (yours === theirs) return { winner: "tie", reason: `${why} Same score.` };
    return { winner: yours > theirs ? "you" : "bot", reason: why };
  }
}
