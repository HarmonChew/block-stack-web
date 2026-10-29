---
version: 1
slug: "index-html"
primary_target: "index.html"
related_targets: ["src/main.ts","src/style.css"]
---

# Surface: the whole app (title, menus, match screen)

Scope: index.html and everything it shows. Visitor mode: Experience (the game leads; menus get out of the way). Desktop keyboard first; phones get the same flow with touch pads.

Audience and job: a player who wants to be in a match within seconds, solo or against one of five recorded Fallgorithm bots on the same pieces; a friend arriving from a challenge link.

Flow (user-approved 2026-10-29): TITLE (logo assembles from falling blocks, PRESS START) -> MAIN MENU (SOLO / VS AI / DAILY) -> SOLO: level grid 0-19 -> play; VS AI: game type (Sprint 40 / Blitz 3:00 / Score Duel) -> opponent (5 bots = difficulty, level 9/18, live bot preview) -> START or WATCH; DAILY: today's match card -> play. Esc/B always backs out one screen. A challenge link opens a "challenged" card instead of the title.

Confirmed: NES-style per-level block palettes; NES-style SFX only, no music, and not too close to the original game; desktop keyboard wins conflicts.

## Direction contract

THESIS: A NES-era console game, not a web page about one: every screen is a framed pixel screen driven by a cursor, and the level palette owns the whole screen. Refuses the category default of a dark dashboard with cards, tabs and a teal accent.

OWN-WORLD: Near-black ground tiled with dim bevelled blocks tinted by the current level palette; ten original two-colour palettes (A, B) plus a white-core block; Press Start 2P for every word; pixel-art frames with notched corners (border-image, flat colour layers, no gradients or glow); a blinking pixel arrow cursor; authored pixel SVG icons; NES controller pads on touch.

STORY: The player sees an alive game from the first frame, picks one thing per screen, sees the bot they chose actually playing before they commit, and always knows who is ahead.

FIRST VIEWPORT: Title: "BLOCK" / "STACK" in block letters filling about 60% of the width, assembling from falling blocks; "ARENA" on a palette band below; a one-line tagline; blinking PRESS START centred under it. Any key, click or tap advances.

FORM: Pinned by the brief (NES-inspired), so not drawn from the roll; seed key 06545bc5 was rolled and declined. Signature interaction: screen changes are a block wipe (a stack rises to cover, the rows line-clear from the centre to reveal). Supporting motion: NES line-clear wipe on the boards, a top-out "dead stack" sweep, a rolling score counter, a level-up palette shift, a Tetris flash and shake, a countdown pop, block rain on a win. All of it has a reduced-motion path.

Raises from declined challengers: (TDR sleeve) the palette commits at screen scale, not as an accent; (Metro tiles) menus are words plus a cursor, with no button chrome beyond the frames; (shader portal) one orchestrated scene transition instead of DOM swaps; (cutting bench) state is a mark: medals and best marks, and the cursor returns to where you left it; (papercut) depth only from flat colour layers.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
