# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary:** a player at a desktop or laptop with a keyboard (or a USB gamepad) who knows classic NES-style block stacking and wants a quick, honest game: solo, or against an AI they can measure themselves against. Desktop keyboard play wins when layouts conflict.
- **Secondary:** a friend who opens a challenge link someone sent them, often on a phone, and plays one match with touch controls.

## Product Purpose

Block Stack Arena lets someone play classic block stacking in the browser with NES timing and rules, alone or head to head against Fallgorithm's bots on the same pieces. Success is a player starting a match within seconds, understanding who is winning while they play, and wanting a rematch.

## Positioning

The opponents are real recordings of an AI (Fallgorithm) playing the exact same seed, replayed frame by frame by the same engine the AI was trained on. Difficulty is five genuinely different bots, from Rookie to Fallgorithm at full benchmark strength, not a speed slider.

## Operating Context

- Matches: Sprint 40, Blitz 3:00, Score Duel (versus); Solo (endless, start level 0-19); Watch (spectate a bot); a daily challenge; challenge links `#c=<mode>.<level>.<bot>.<seed>[.<message>]`.
- Controls: arrows move and soft-drop, X/Up rotate right, Z rotate left, P/Esc pause; standard gamepads; on-screen touch pads on phones.
- Records (plays, wins, bests) live in the browser's localStorage. No accounts, no server state.

## Capabilities and Constraints

- Static site: Vite + TypeScript, no UI framework; engine is C++ compiled to WebAssembly (`src/engine/arena.mjs`, committed). Deployed later via Coolify (Dockerfile, nginx).
- Bots are data (`public/bots/`); bot levels are 9 and 18 only, 100 seeds each.
- The engine runs at 60.0988 fps; game rules and timing must not change, or the recordings stop replaying (`npm run verify`).
- English only.

## Brand Commitments

- Name: Block Stack Arena. The project never uses the Tetris name, logo, artwork or music for its own branding (the four-line clear is still called a "Tetris", as players do).
- Look and sound: inspired by NES-era block stacking (user, 2026-10-29): pixel type, framed boxes, per-level block palettes, NES-style sound effects. It must not be too close to the original NES game: original palettes, original sounds, no copied screens.
- Should feel animated and alive, not robotic; simple to navigate.

## Evidence on Hand

- Real bot recordings and stats: `public/bots/index.json`, `public/bots/stats.json` (typical times and scores per bot and level).
- No player research, testimonials or usage data exist. Do not invent any.

## Product Principles

1. Play is one or two choices away: every menu step asks one question.
2. Show, don't claim: let the bots' real play demonstrate difficulty.
3. Fair and legible: both players get the same pieces, and the lead is always readable at a glance.
4. Respect the player: no streak pressure, nagging, or fake urgency; the daily challenge is an invitation, not an obligation.

## Accessibility & Inclusion

Full keyboard and gamepad navigation in menus; touch on phones; honour `prefers-reduced-motion`; sound is off until a gesture and has a persistent mute.
