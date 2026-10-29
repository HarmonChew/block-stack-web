// The versus modes. Both players get the same seed, so the same pieces.
import { FPS } from "./engine.ts";

export type ModeId = "sprint" | "blitz" | "duel";

export interface ModeInfo {
  id: ModeId;
  name: string;
  goal: string;
}

export const SPRINT_LINES = 40;
export const BLITZ_SECONDS = 180;
export const BLITZ_FRAMES = Math.round(BLITZ_SECONDS * FPS);

export const MODES: ModeInfo[] = [
  {
    id: "sprint",
    name: "Sprint 40",
    goal: `First to ${SPRINT_LINES} lines wins. The bot never soft-drops, so hold Down and outrun it.`,
  },
  {
    id: "blitz",
    name: "Blitz 3:00",
    goal: "Highest score after three minutes wins. Topping out freezes your score.",
  },
  {
    id: "duel",
    name: "Score Duel",
    goal: "Play until you top out. Beat the bot's final score to win.",
  },
];
