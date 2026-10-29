# Vendored engine

`include/` and `src/` are Block Stack's `core/` at commit `4d46782`
(github.com/HarmonChew/block-stack), without the C API, which the web build
replaces with `wasm/arena.cpp`. `LICENSE` is that repository's MIT license.

The bot games in `public/bots/` were recorded on this exact engine. If you
update these files, regenerate the bots (`tools/make_bots.py`) and run
`pnpm verify`, which replays every bot game and checks its final state hash.
