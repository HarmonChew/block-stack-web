#!/usr/bin/env sh
# Builds the engine to src/engine/arena.mjs (one ES module with the wasm inlined).
# Uses a local emcc when there is one, otherwise the pinned Emscripten image.
set -eu
cd "$(dirname "$0")/.."
EMSDK_IMAGE=emscripten/emsdk:4.0.15
mkdir -p src/engine
set -- em++ -std=c++20 -O3 -fno-fast-math -ffp-contract=off -Wall -Wextra \
    -Iengine/include engine/src/game.cpp engine/src/pieces.cpp engine/src/rng.cpp \
    engine/src/rules.cpp wasm/arena.cpp \
    -sMODULARIZE -sEXPORT_ES6 -sSINGLE_FILE -sENVIRONMENT=web,node \
    -sFILESYSTEM=0 -sALLOW_MEMORY_GROWTH -sEXPORTED_FUNCTIONS=_malloc,_free \
    -sEXPORTED_RUNTIME_METHODS=HEAPU8 -o src/engine/arena.mjs
if command -v em++ >/dev/null 2>&1; then
    "$@"
else
    docker run --rm -u "$(id -u):$(id -g)" -v "$PWD:/src" -w /src "$EMSDK_IMAGE" "$@"
fi
echo "built src/engine/arena.mjs"
