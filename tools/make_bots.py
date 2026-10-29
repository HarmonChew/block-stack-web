"""Record the bot games the web app plays against.

Each bot is fallgorithm's C++ reach_plan agent (Experiment 012) with a handicap:
a tap speed, a reaction time and, for the weaker bots, evaluation weights that
care less about holes and Tetrises. A game is recorded as its controller input,
one byte per frame, gzipped, so the browser replays it on the same engine.

Run it with fallgorithm's Python, from a clean copy of fallgorithm at the commit
below with its native library built against the engine in ../engine:

    git -C ~/projects/code/fallgorithm archive 48ed121 | tar -x -C /tmp/fg
    (cd /tmp/fg && BLOCK_STACK_ROOT=<block-stack at 4d46782> \\
        ~/projects/code/fallgorithm/.venv/bin/python scripts/build_native.py)
    PYTHONPATH=/tmp/fg/src ~/projects/code/fallgorithm/.venv/bin/python \\
        tools/make_bots.py --fallgorithm /tmp/fg

Then run `pnpm verify` to replay every game in the WebAssembly engine.
"""

from __future__ import annotations

import argparse
import gzip
import json
from multiprocessing import Pool
from pathlib import Path
import random
import statistics

from block_stack_ai import native
from block_stack_ai.limits import Limits

FALLGORITHM_COMMIT = "48ed121"
ENGINE_COMMIT = "4d46782"
GAME = {"ruleset": "classic_ntsc_double_killscreen", "mode": "endless", "height": 0}
LINE_CAP = 430
FRAME_CAP = 150_000
LEVELS = (9, 18)
SEED_COUNT = 100

BOTS = [
    {"id": "rookie", "name": "Rookie", "style": "sloppy", "tap_hz": 6, "reaction_ms": 700,
     "blurb": "Slow hands, leaves holes, never plans for Tetrises."},
    {"id": "club", "name": "Club Player", "style": "sloppy", "tap_hz": 10, "reaction_ms": 400,
     "blurb": "Quicker, but still leaves holes and takes whatever lines it can."},
    {"id": "pro", "name": "Pro", "style": "full", "tap_hz": 15, "reaction_ms": 300,
     "blurb": "Fallgorithm's full evaluation at a human 15 taps a second."},
    {"id": "master", "name": "Master", "style": "full", "tap_hz": 20, "reaction_ms": 300,
     "blurb": "Fallgorithm at 20 taps a second. Builds for Tetrises."},
    {"id": "fallgorithm", "name": "Fallgorithm", "style": "full", "tap_hz": 30, "reaction_ms": 300,
     "blurb": "Experiment 012 at full strength: the BetaTetris benchmark format."},
]

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "bots"


def weights(full: dict[str, float], style: str) -> dict[str, float]:
    """Experiment 012's weights, or the 'sloppy' ones: holes count a tenth, no Tetris plan."""
    if style == "full":
        return full
    sloppy = {name: value * 0.1 if "holes" in name else value for name, value in full.items()}
    sloppy["build_tetrises"] = 0.0
    return sloppy


def play(job: tuple[dict, int, int, dict[str, float]]) -> dict:
    bot, level, seed, params = job
    game = native.play_game(GAME | {"start_level": level}, seed, line_cap=LINE_CAP,
                            frame_cap=FRAME_CAP, limits=Limits(bot["tap_hz"], bot["reaction_ms"]),
                            params=native.params(params))
    path = OUT / str(level) / bot["id"] / f"{seed}.bin"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(gzip.compress(game["inputs"], compresslevel=9, mtime=0))
    return {"seed": seed, "score": game["score"], "lines": game["lines"],
            "frames": game["frames"], "end": game["stopping_reason"],
            "hash": game["final_state_hash"]}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--fallgorithm", type=Path, required=True,
                        help=f"clean fallgorithm copy at {FALLGORITHM_COMMIT}")
    parser.add_argument("--jobs", type=int, default=24)
    args = parser.parse_args()
    full = json.loads((args.fallgorithm / "experiments" / "012-native-cem" /
                       "final_params.json").read_text())["resolved"]
    seeds = sorted(random.Random(2026).sample(range(1, 65536), SEED_COUNT))
    index = {"engine": f"block-stack {ENGINE_COMMIT}", "fallgorithm": FALLGORITHM_COMMIT,
             "ruleset": GAME["ruleset"], "levels": list(LEVELS), "seeds": seeds,
             "bots": [], "games": {}}
    with Pool(args.jobs) as pool:
        for bot in BOTS:
            params = weights(full, bot["style"])
            entry = dict(bot, typical={})
            for level in LEVELS:
                games = pool.map(play, [(bot, level, seed, params) for seed in seeds])
                index["games"][f"{level}/{bot['id']}"] = games
                scores = [game["score"] for game in games]
                lines = [game["lines"] for game in games]
                entry["typical"][str(level)] = {"score": round(statistics.median(scores)),
                                                "lines": round(statistics.median(lines))}
                print(f"{bot['id']:12} level {level}: median score {statistics.median(scores):>9,.0f}"
                      f"  lines {statistics.median(lines):>5.1f}", flush=True)
            index["bots"].append(entry)
    (OUT / "index.json").write_text(json.dumps(index, separators=(",", ":")) + "\n")


if __name__ == "__main__":
    main()
