# Block Stack Arena

Block Stack in the browser: play solo, or challenge Fallgorithm's AI on the same
pieces as you.

- **Sprint 40:** first to 40 lines wins. The bots never soft-drop, so a human who
  holds Down can win this race, even against the strongest bot.
- **Blitz 3:00:** highest score after three minutes.
- **Score Duel:** play until you top out and beat the bot's final score. If you
  top out first, the bot fast-forwards until it passes you or tops out.
- **Solo:** endless play from any start level, with personal bests.
- Five bots from Rookie to Fallgorithm (Experiment 012 at full strength), a
  daily challenge, rematches on the same pieces, "watch this bot play", and
  challenge links (`#c=<mode>.<level>.<bot>.<seed>`) to send a friend.

Keyboard: arrows move and soft-drop, X or Up rotates right, Z rotates left, P
pauses. Gamepads and on-screen touch buttons work too. Records live in the
browser's localStorage.

## How it works

Everything runs in the browser. The server only serves static files.

- `engine/` is Block Stack's C++ core (see `engine/VENDORED.md`), built to
  WebAssembly by `wasm/build.sh` into `src/engine/arena.mjs`, which is committed.
  The game runs at NES speed (60.0988 frames a second) with the same rules the AI
  was trained on (`classic_ntsc_double_killscreen`).
- The bots are **recorded games**, not a live AI. In these modes the bot never
  reacts to you, so a bot's game on a seed is fixed and can be played back:
  `public/bots/<level>/<bot>/<seed>.bin` is one game's controller input (one byte
  per frame, gzipped, about 2 KB). The browser feeds it into a second engine
  frame by frame. However strong or slow the AI gets, the web app does the same
  amount of work.
- `public/bots/index.json` lists the bots, seeds and each game's final score and
  state hash. `public/bots/stats.json` holds the typical times and scores shown
  on the menu.

## Development

```sh
npm install
npm run dev        # http://localhost:5173
npm test           # match rules, against real bot recordings
npm run verify     # replays all 1,000 bot games; checks every final state hash
npm run build      # type-check and bundle into dist/
npm run wasm       # rebuild the engine (local emcc, or Docker emscripten/emsdk:4.0.15)
```

## Updating the bots when Fallgorithm improves

Bots are data, so a stronger agent is a data release:

1. Export a clean copy of fallgorithm at the new commit and build its native
   library against the engine commit in `engine/VENDORED.md` (the steps are in
   `tools/make_bots.py`'s docstring).
2. Edit `BOTS`, `FALLGORITHM_COMMIT` and the weights in `tools/make_bots.py`,
   then run it (about 3 minutes on 24 cores for 1,000 games).
3. Run `npm run verify`. It must report that every game replays.
4. Commit and push. Coolify rebuilds the site.

If a future agent needs a GPU or seconds per move, nothing here changes: only
recording the games takes longer.

If the engine itself changes (rules, timing), copy the new core into `engine/`,
run `npm run wasm`, and regenerate all bots. Old recordings will not replay on a
different engine, and `npm run verify` is what catches that.

## Deploying with Coolify

The `Dockerfile` builds the site with Node and serves it with nginx on port 80
(health check at `/healthz`). In Coolify: add the Git repository as a new
resource, choose the **Dockerfile** build pack, set the exposed port to 80, and
add a domain. The image is about 100 MB and uses almost no CPU or memory at
runtime.
