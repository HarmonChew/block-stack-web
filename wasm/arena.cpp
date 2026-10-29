// The engine calls the web app needs, as plain C functions for WebAssembly.
//
// Every game uses the AI benchmark rules the bots were recorded on
// (classic_ntsc_double_killscreen, endless mode). arena_view writes one game's
// visible state into a fixed byte layout that src/engine.ts reads.

#include "blocks/game.hpp"

#include <emscripten/emscripten.h>

#include <cstdint>
#include <cstring>

using namespace blocks;

namespace {

// Byte offsets of arena_view's output. Keep in step with src/engine.ts.
constexpr int kBoard = 0;          // 200 cells, active piece drawn in; 0 empty, else piece + 1
constexpr int kPhase = 200;        // u8 Phase
constexpr int kNext = 201;         // u8 next piece, 7 = none
constexpr int kNextCells = 202;    // 4 x (i8 x, i8 y) of the next piece's spawn orientation
constexpr int kClearing = 212;     // u32 bitmask of rows being cleared
constexpr int kScore = 216;        // f64 score
constexpr int kLines = 224;        // i32
constexpr int kLevel = 228;        // i32
constexpr int kFrame = 232;        // u32
constexpr int kClears = 236;       // 4 x u32 singles, doubles, triples, tetrises
constexpr int kHash = 252;         // 2 x u32 state hash, low word first
constexpr int kViewSize = 260;

template <class T>
void put(std::uint8_t* out, int offset, T value) {
    std::memcpy(out + offset, &value, sizeof value);
}

}  // namespace

extern "C" {

EMSCRIPTEN_KEEPALIVE int arena_view_size() { return kViewSize; }

EMSCRIPTEN_KEEPALIVE Game* arena_create(int start_level, int seed) {
    Config config;
    config.ruleset = RulesetId::ClassicNtscDoubleKillscreen;
    config.mode = Mode::Endless;
    config.start_level = start_level;
    config.seed = static_cast<std::uint16_t>(seed);
    return new Game(config);
}

EMSCRIPTEN_KEEPALIVE void arena_destroy(Game* game) { delete game; }

// One frame. Returns the frame's events: bits 0-2 lines cleared, then locked (8),
// level changed (16), game over (32), moved (64), rotated (128).
EMSCRIPTEN_KEEPALIVE int arena_tick(Game* game, int input) {
    const Events events = game->tick(static_cast<InputFrame>(input));
    return events.lines_cleared | (events.locked ? 8 : 0) | (events.level_changed ? 16 : 0) |
           (events.game_over ? 32 : 0) | (events.moved ? 64 : 0) | (events.rotated ? 128 : 0);
}

EMSCRIPTEN_KEEPALIVE int arena_terminal(const Game* game) { return game->terminal() ? 1 : 0; }

EMSCRIPTEN_KEEPALIVE double arena_score(const Game* game) {
    return static_cast<double>(game->state().score);
}

EMSCRIPTEN_KEEPALIVE int arena_lines(const Game* game) { return game->state().lines; }

EMSCRIPTEN_KEEPALIVE void arena_view(const Game* game, std::uint8_t* out) {
    const State& state = game->state();
    std::memcpy(out + kBoard, state.board.data(), state.board.size());
    if (state.phase == Phase::Active && state.current != Piece::None) {
        for (const Cell cell : cells(state.current, state.orientation)) {
            const int x = state.x + cell.x;
            const int y = state.y + cell.y;
            if (x >= 0 && x < board_width && y >= 0 && y < board_height) {
                out[kBoard + y * board_width + x] = static_cast<std::uint8_t>(state.current) + 1;
            }
        }
    }
    out[kPhase] = static_cast<std::uint8_t>(state.phase);
    out[kNext] = static_cast<std::uint8_t>(state.next);
    if (state.next != Piece::None) {
        int index = 0;
        for (const Cell cell : cells(state.next, 0)) {
            out[kNextCells + index++] = static_cast<std::uint8_t>(static_cast<std::int8_t>(cell.x));
            out[kNextCells + index++] = static_cast<std::uint8_t>(static_cast<std::int8_t>(cell.y));
        }
    }
    put(out, kClearing, state.clearing_rows);
    put(out, kScore, static_cast<double>(state.score));
    put(out, kLines, static_cast<std::int32_t>(state.lines));
    put(out, kLevel, static_cast<std::int32_t>(state.level));
    put(out, kFrame, static_cast<std::uint32_t>(state.frame));
    for (int index = 0; index < 4; ++index) {
        put(out, kClears + 4 * index, state.stats.clear_counts[static_cast<std::size_t>(index)]);
    }
    const std::uint64_t hash = game->state_hash();
    put(out, kHash, static_cast<std::uint32_t>(hash));
    put(out, kHash + 4, static_cast<std::uint32_t>(hash >> 32));
}

}  // extern "C"
