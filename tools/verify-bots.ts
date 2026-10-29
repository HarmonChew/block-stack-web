// Replays every bot game in the WebAssembly engine, checks it ends in the state
// fallgorithm recorded, and writes per-mode bot stats to public/bots/stats.json.
//
//   node tools/verify-bots.ts
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { EV_LINES, Game, loadEngine } from "../src/engine.ts";
import { BLITZ_FRAMES, SPRINT_LINES } from "../src/modes.ts";

interface Recorded {
  seed: number;
  score: number;
  lines: number;
  frames: number;
  hash: string;
}

const dir = new URL("../public/bots/", import.meta.url);
const index = JSON.parse(readFileSync(new URL("index.json", dir), "utf8"));
const mod = await loadEngine();

const median = (values: number[]): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = sorted.length >> 1;
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

const stats: Record<string, unknown> = {};
let failures = 0;
for (const [key, games] of Object.entries(index.games as Record<string, Recorded[]>)) {
  const [level, bot] = key.split("/");
  const sprintFrames: number[] = [];
  const blitzScores: number[] = [];
  for (const recorded of games) {
    const inputs = gunzipSync(readFileSync(new URL(`${key}/${recorded.seed}.bin`, dir)));
    const game = new Game(mod, Number(level), recorded.seed);
    let lines = 0;
    let sprint = 0;
    for (let frame = 0; frame < inputs.length; frame++) {
      lines += game.tick(inputs[frame]) & EV_LINES;
      if (!sprint && lines >= SPRINT_LINES) sprint = frame + 1;
      if (frame + 1 === BLITZ_FRAMES) blitzScores.push(game.view().score);
    }
    if (inputs.length < BLITZ_FRAMES) blitzScores.push(game.view().score);
    if (sprint) sprintFrames.push(sprint);
    const end = game.view();
    game.destroy();
    const expected = [recorded.score, recorded.lines, recorded.frames, recorded.hash];
    const actual = [end.score, end.lines, end.frame, end.hash];
    if (expected.some((value, i) => value !== actual[i])) {
      failures++;
      console.error(`${key} seed ${recorded.seed}: expected ${expected}, replayed ${actual}`);
    }
  }
  stats[key] = {
    sprintFrames: median(sprintFrames),
    sprintFinishPct: Math.round((100 * sprintFrames.length) / games.length),
    blitzScore: Math.round(median(blitzScores)),
  };
  console.log(`${key.padEnd(16)} ${games.length} games  sprint ${(median(sprintFrames) / 60.0988).toFixed(1)} s` +
    ` (${(stats[key] as { sprintFinishPct: number }).sprintFinishPct}% finish)  blitz ${median(blitzScores)}`);
}
if (failures) {
  console.error(`${failures} games did not replay`);
  process.exit(1);
}
writeFileSync(new URL("stats.json", dir), JSON.stringify(stats) + "\n");
console.log("all games replay; wrote public/bots/stats.json");
