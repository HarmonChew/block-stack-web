// Match rules, checked against real bot recordings in the WebAssembly engine.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { gunzipSync } from "node:zlib";
import { Match } from "../src/match.ts";
import { BLITZ_FRAMES } from "../src/modes.ts";

const dir = new URL("../public/bots/", import.meta.url);
const index = JSON.parse(readFileSync(new URL("index.json", dir), "utf8"));
const seed: number = index.seeds[0];
const inputs = (level: number, bot: string) =>
  new Uint8Array(gunzipSync(readFileSync(new URL(`${level}/${bot}/${seed}.bin`, dir))));
const recorded = (level: number, bot: string) =>
  index.games[`${level}/${bot}`].find((game: { seed: number }) => game.seed === seed);

/** Plays a match with the human pressing `human(frame)`, to the end. */
function play(match: Match, human: (frame: number) => number = () => 0): Match {
  for (let guard = 0; !match.result && guard < 1_000_000; guard++) match.step(human(match.frame));
  return match;
}

test("watching a bot reproduces its recorded game", async () => {
  const match = play(await Match.create("watch", 18, seed, inputs(18, "fallgorithm")));
  const view = match.bot!.game.view();
  const game = recorded(18, "fallgorithm");
  assert.equal(view.score, game.score);
  assert.equal(view.hash, game.hash);
  assert.equal(match.result!.winner, null);
});

test("an idle player loses each mode to a real bot", async () => {
  for (const kind of ["sprint", "blitz", "duel"] as const) {
    const match = play(await Match.create(kind, 18, seed, inputs(18, "pro"), "Pro"));
    assert.equal(match.result!.winner, "bot", kind);
    assert.ok(match.you!.out, kind);
  }
});

test("copying the bot's inputs ties every mode", async () => {
  for (const kind of ["sprint", "blitz", "duel"] as const) {
    const bot = inputs(9, "club");
    const match = play(await Match.create(kind, 9, seed, bot), (frame) => bot[frame] ?? 0);
    assert.equal(match.result!.winner, "tie", `${kind}: ${match.result!.reason}`);
  }
});

test("blitz stops both players at the time limit", async () => {
  const bot = inputs(9, "fallgorithm");
  const match = play(await Match.create("blitz", 9, seed, bot), (frame) => bot[frame] ?? 0);
  assert.equal(match.frame, BLITZ_FRAMES);
  assert.ok(!match.you!.out && !match.bot!.out);
});

test("the human wins a duel by outscoring a bot that is already out", async () => {
  // The Rookie at level 18 tops out early; the Fallgorithm recording on the same
  // seed (same pieces) plays as the human and passes it.
  const rookie = recorded(18, "rookie");
  const strong = inputs(18, "fallgorithm");
  const match = play(await Match.create("duel", 18, seed, inputs(18, "rookie"), "Rookie"),
                     (frame) => strong[frame] ?? 0);
  assert.equal(match.result!.winner, "you", match.result!.reason);
  assert.ok(match.bot!.out);
  assert.ok(match.you!.game.score > rookie.score);
});

test("solo ends when the player tops out", async () => {
  const match = play(await Match.create("solo", 18, 1234, null));
  assert.ok(match.you!.out);
  assert.equal(match.result!.reason, "Game over");
});
