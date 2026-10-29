---
name: Block Stack Arena
description: A framed pixel console screen where the current level's two-colour palette recolours the whole app.
colors:
  ink: "#f7f4ea"
  ink-dim: "#b7bbcc"
  well: "#05060a"
  win: "#7be08f"
  lose: "#ff6b7a"
  dead-stack: "#545a6b"
  dead-core: "#2b2f3a"
  royal-blue: "#3b6cf6"
  amber: "#f5a524"
  jade: "#14a76c"
  lime: "#c3e956"
  raspberry: "#d8366f"
  sun: "#ffcf5c"
  violet: "#7646e8"
  aqua: "#3fd8c8"
  vermilion: "#e8572a"
  lemon: "#f7e26b"
  teal: "#0e93a8"
  rose: "#ff8fb1"
  crimson: "#b8324b"
  sky: "#8fc7ff"
  moss: "#3f8f3a"
  apricot: "#ffb072"
  indigo: "#4f55e0"
  pink: "#ff7ac1"
  brass: "#a9762a"
  mint: "#67e0a3"
  royal-blue-deep: "#2a4aa6"
typography:
  display:
    fontFamily: "Press Start 2P, ui-monospace, monospace"
    fontSize: "clamp(24px, 5vw, 40px)"
    fontWeight: 400
    lineHeight: 1.7
    letterSpacing: "0.5em"
  headline:
    fontFamily: "Press Start 2P, ui-monospace, monospace"
    fontSize: "24px"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "normal"
  title:
    fontFamily: "Press Start 2P, ui-monospace, monospace"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.7
    letterSpacing: "0.04em"
  body:
    fontFamily: "Press Start 2P, ui-monospace, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.7
    letterSpacing: "normal"
  label:
    fontFamily: "Press Start 2P, ui-monospace, monospace"
    fontSize: "10px"
    fontWeight: 400
    lineHeight: 1.8
    letterSpacing: "0.04em"
rounded:
  none: "0px"
spacing:
  px: "3px"
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  frame:
    backgroundColor: "{colors.well}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "20px 24px"
  plate:
    backgroundColor: "{colors.well}"
    textColor: "{colors.ink}"
    typography: "{typography.title}"
    rounded: "{rounded.none}"
    padding: "8px 20px"
  option:
    textColor: "{colors.ink}"
    typography: "{typography.title}"
    padding: "12px 12px 12px 30px"
  option-current:
    textColor: "{colors.amber}"
  option-primary:
    backgroundColor: "{colors.royal-blue-deep}"
    textColor: "{colors.ink}"
    typography: "{typography.title}"
    rounded: "{rounded.none}"
    padding: "10px 18px 10px 30px"
  icon-button:
    backgroundColor: "{colors.well}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    height: "44px"
    width: "44px"
    padding: "0 10px"
  icon-button-hover:
    textColor: "{colors.amber}"
  level-cell:
    backgroundColor: "{colors.well}"
    textColor: "{colors.ink}"
    typography: "{typography.title}"
    padding: "12px 4px 10px"
  segment:
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    padding: "8px 12px"
  segment-on:
    backgroundColor: "{colors.royal-blue}"
  stat-box:
    backgroundColor: "{colors.well}"
    textColor: "{colors.ink}"
    typography: "{typography.title}"
    padding: "6px 10px 8px"
  pad-disc:
    size: "62px"
    textColor: "{colors.well}"
    typography: "{typography.title}"
  dialog:
    backgroundColor: "{colors.well}"
    textColor: "{colors.ink}"
    padding: "24px 28px"
  toast:
    backgroundColor: "{colors.well}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    padding: "12px 16px"
---

# Design System: Block Stack Arena

## Overview

**Creative North Star: "The Console Screen"**

Every screen is a framed pixel screen on a near-black ground, steered by a cursor. The level's two-colour palette owns the whole screen: frames, plates, the logo band, the touch pads, the blocks and the ground tint all recolour together when the level changes. The page is a game that happens to run in a browser, not a site about one: menus are words and an arrow, and the only chrome is the frame.

Density is low and centred in menus (one column, one question per screen) and tight and instrumented in the match (two wells, stat boxes, a lead meter). One typeface, one bitmap grid, flat colour layers; nothing is blurred, rounded or glowing. Motion is split in two grammars: eased slides for layout, stepped on/off for anything made of pixels.

**Key Characteristics:**
- The level palette (A, B, ground, frame, pad disc) is the only chroma; neutrals and win/lose carry the rest.
- Press Start 2P for every word, at weight 400, with no smoothing.
- Frames are 9x9 pixel border-images, not CSS borders or radii.
- Menu options are bare words with a pixel arrow cursor; hover and focus both move the cursor.
- Everything is sized in multiples of one pixel unit (`--px`: 3px, 2px on phones).

## Colors

A near-black playfield and a warm off-white, with ten original two-colour palettes (A, B) that cycle every ten levels.

### Primary (the live level palette)
- **Palette A** (`--pa`; level 0: royal blue): frame edge lines, opponent meter pips, d-pad tint, solid blocks (J, L) and the white-core blocks' rim (I, O, T).
- **Deep A** (`--pd`; each channel of A x 0.66 + 6): every filled surface that carries ink text, which means the primary plate, the ARENA band and the selected segment. Ink on Deep A is at least 5.2:1 on all ten palettes, while ink on plain A drops to 2.8:1 (jade), so text never sits on plain A.
- **Palette B** (`--pb`; level 0: amber): the cursor, the current option and cell, PRESS START, bot names and record marks, the touch disc faces, solid blocks (S, Z).
- **Ground** (`--ground`): a deep shade of A (each channel x 0.13 + 6) tinted under the bevelled tile pattern. Never used as text or fill on components.

Pairs by level (index = level mod 10): 0 royal-blue / amber, 1 jade / lime, 2 raspberry / sun, 3 violet / aqua, 4 vermilion / lemon, 5 teal / rose, 6 crimson / sky, 7 moss / apricot, 8 indigo / pink, 9 brass / mint. The match screen follows the player's level; menus follow the selected level or the daily's level; the title cycles through all ten every 3.5 s.

### Neutral
- **Warm Ink** (ink): text, block cores, the white line inside every frame, key caps.
- **Dim Ink** (ink-dim): details, labels, the tagline, muted secondary text.
- **Playfield Black** (well): wells, frame fill (92% opaque), scrims (55-60% opaque), text on touch discs and key caps.
- **Dead Stack** (dead-stack, dead-core): the grey a topped-out board turns, swept from the top.
- **Win Green / Lose Coral** (win, lose): the lead meter, the lead word in the status line, and the result heading. Nothing else.

### Named Rules
**The Palette Owns the Screen Rule.** Components read `--pa`, `--pb`, `--frame` and `--btn`; they never hard-code a hue. A new colour in a component is a bug unless it is a neutral or win/lose.

**The Lead Colour Rule.** Green and coral mean ahead and behind, and appear only where the lead is shown. They are not accents.

**The Block Style Rule.** I, O, T are a white core in A; J, L are solid A; S, Z are solid B. Highlights are a 1-pixel shine at the top left of a 7x7 body on an 8x8 grid.

## Typography

**Display, headline, body and label font:** Press Start 2P (bundled woff2, `font-display: block`, falls back to ui-monospace). No second family.

**Character:** An 8-bit bitmap face at weight 400, uppercase for navigation and actions, sentence case with lowercase glyphs for explanations and data. Emphasis comes from colour (B), size or the cursor, never from weight.

### Hierarchy
- **Display** (400, clamp(24px, 5vw, 40px), 1.7, 0.5em tracking): the ARENA band under the logo only.
- **Headline** (400, 24px, 1.4): dialog titles (result, pause).
- **Title** (400, 16px, 14px on phones, 1.7, 0.04-0.08em): screen plates, large options, player tags, status line, stat values, level-cell numbers.
- **Body** (400, 12px, 1.7): default text; details run at line-height 1.9 in Dim Ink.
- **Label** (400, 10px, 0.04em): names of values (SCORE, NEXT, LEVEL), option sub-lines, status title, toasts. A label names a value; it does not introduce a heading.
- **Block lettering**: the BLOCK / STACK logo is drawn from falling blocks on a 29 x 11 grid, not set in type.

### Named Rules
**The One Face Rule.** Any new word is Press Start 2P. No system display face, no italics, no bold.

## Layout

One centred column per screen: `.screen` max 720px (opponent screen 1000px, title 920px), 16px side gutters, 88px top padding to clear the corner buttons (76px on phones), vertically centred, 24px gap between blocks (20px on phones). Every menu screen asks one question; Back (top left) and Sound (top right) are fixed 16px from the corners, and Esc/B always steps back one screen.

The opponent screen splits into a list (0.9fr) and a detail card (1.3fr) with a live preview well; it stacks on phones. The solo level grid is 5 columns of 8px-gapped cells.

The match screen is full width: a three-part HUD (menu, status with lead meter, pause and sound), then the boards centred with `clamp(16px, 3vw, 48px)` between them. Your well is full size; the bot's is 0.78 scale. Cell size is derived from the viewport: `min((100dvh - 250px) / 20, 3.2vw)` (4.2vw for a single board), and canvases snap to whole device pixels per cell. Stat columns share one width (`clamp(150px, 11vw, 176px)`) so SCORE sits level with SCORE. At 720px and below, `--px` drops to 2px, your well and stats sit side by side with the bot's small well beneath the stats, secondary bot boxes hide, and a pad bar appears on touch devices.

Spacing scale: 4 / 8 / 12 / 16 / 24px, plus the pixel unit.

## Elevation & Depth

Flat colour layers only. Depth is the frame (palette line, white line, palette line around a dark fill), the bevelled ground tile (white 8% highlight top and left, black 50% edge bottom and right), the block shine, and a 1-pixel press (`translateY(var(--px))`). Overlays are a flat translucent scrim, not a blur. There are no gradients, blurs, glows or elevation shadows.

### Named Rules
**The Flat Layer Rule.** Separate things with another flat colour or a pixel line. If a new element needs a shadow to read, change its colour layer instead.

## Shapes

Square everywhere. No border-radius exists in the system. Corners are notched by a 9x9 SVG border-image (slice 3, three art pixels per side, stretched), drawn from flat pixel lines. Frames with a fill use `fill`; wells omit it and paint `--well` behind.

Icons are authored bitmaps (`#` rows, usually 7 px tall) rendered as crisp SVG rects in `currentColor` at integer multiples of `--px`: back, left, right, down, pause, play, sound on/off, star (record mark), cursor. The cursor is a 5x7 stepped arrow. The A/B touch buttons are a 14x14 stepped disc (rim A, face B, 3-pixel white shine). Selection on grids and segments is a 1-pixel inset outline, not a box.

## Components

### Frame, plate and card
- **Frame** (`.frame`): the one container. Level-coloured 9x9 border-image, 92% black fill, 3-art-pixel border. Cards add 20px 24px padding (16px on phones) and a 12px internal gap.
- **Plate**: a frame holding one title (screen name), centred above its card at 16px with 0.08em tracking.

### Options and the cursor
- **Option**: label in Warm Ink with an optional Dim Ink sub-line; 12px padding with a 30px left gutter reserved for the arrow. No box, no hover colour of its own.
- **Current** (`.cur`): text turns B; the B arrow slides in 8px over 0.16s and nudges one pixel unit on a stepped 0.8s loop. Mouse hover, focus and arrow keys all place `.cur`. Touch needs a second tap on `data-confirm` options. The cursor returns to where you left a screen.
- **Primary plate** (`.option.primary`): the one action a screen exists for; a notched frame filled with A, Warm Ink text, an ink arrow. One per screen.
- **Chosen but not current** (bot list): the arrow stays at 45% opacity.

### Level cell and segments
- **Level cell**: dark tile with a dim 1-pixel outline, the number, and three chips previewing the white-core, A and B block styles. Current: B outline and text, flashing to ink on a stepped 0.5s loop. A star marks a level with a best.
- **Segment** (level 9 / 18): 1-pixel inset outline; on = A fill and ink outline; current = B outline.
- **Opponent meter**: five 3-pixel pips, A when lit, B when current.

### Stat box, well and lead meter
- **Stat box / lines box**: frame with a 10px label above a 16px tabular value. A change bumps the value (scale 1.5 down to 1, flashing to B).
- **Well**: black field in an unfilled frame, 10 x 20 cells, with a count-in overlay, a pause cover, and rising pop text (B; ink at 4 lines).
- **Lead meter**: twenty 3-pixel pips split 10 / 10, lit outward from the centre: green to the right when you lead, coral to the left when you trail.

### Touch pads
- **D-pad**: 46px keys, A at 28% over black, solid A while held. **A / B**: 62px pixel discs in the level's pair, staggered 26px, pressing sinks one pixel unit. **START**: a small frame plate.

### Dialog and toast
- **Dialog**: a filled frame on a 55% black scrim, 24px 28px padding, Headline title coloured win or lose for results, a tally table that animates in row by row, and an options list. **Slim** dialogs sit low on the screen with no scrim. **Toast**: a bottom-centred frame in Label type.

### Motion and reduced motion
- **Screen change (signature)**: a block wipe on a full-screen canvas. A stack of 44px blocks (32px under 640px) rises over 300ms, the screen swaps underneath on a white flash, then the rows clear from the centre outward in five steps over 320ms. Menu-to-menu steps instead slide 40px over 0.24s (direction follows forward or back).
- **Title**: the logo's pieces fall in stagger (340ms each, 55ms apart, lowest first); the ARENA band opens from the centre in 0.5s; the tagline fades; PRESS START blinks on a stepped 1.06s loop; palettes then cycle every 3.5s with a diagonal recolour sweep.
- **Match**: line clear removes columns from the centre in steps (4 frames each); a Tetris flashes and shakes the well (0.36s and 0.28s, stepped); level-up crossfades the palette over 0.6s through registered `@property` colours; top-out sweeps the dead-stack grey down in 0.8s; the countdown pops in 0.32s; a win rains 90 palette blocks for 3s; the live score eases toward its value and the result score rolls up over 0.7s. The ground tile drifts downward over 40s outside matches.
- **Easing**: eased layout motion uses `cubic-bezier(0.16, 1, 0.3, 1)`; anything pixel-built (cursor, blink, flash, shake) uses `steps(1)`.
- **Reduced motion** (`prefers-reduced-motion: reduce`): the ground stops drifting; screen slides become a 0.16s fade; the wipe is skipped (an instant swap); the cursor nudge, PRESS START blink, level-cell flash and well shake stop; the Tetris flash is shortened to 0.2s, not removed; pop text fades in place; count-in, dialog, tally and stat bumps become fades; the title band stops animating, the logo appears built and the palette no longer cycles; the result score shows its final value and NEW PERSONAL BEST stops blinking; top-out is a hard cut; block rain does not run.

## Do's and Don'ts

### Do:
- **Do** colour new accents from `--pa` / `--pb` and let `applyPalette` drive them, so they follow the level.
- **Do** build new frames, plates and cards from `.frame` and size every dimension as a multiple of `--px`.
- **Do** keep menus to words plus a cursor; promote a single action to the primary plate.
- **Do** author new icons as bitmaps in `currentColor`, 7 px tall where possible.
- **Do** give any new animation a reduced-motion path, and use `steps(1)` for pixel-built motion.
- **Do** show state with a mark (star, pip, meter) before adding text.

### Don't:
- **Don't** use border-radius, gradients, blur, glow or an elevation shadow.
- **Don't** add a second typeface, a bold, or type below the 10px label size.
- **Don't** hard-code a hue in a component, or use win green and lose coral as decoration.
- **Don't** add button chrome, tabs or a card grid to menus; options stay bare words.
- **Don't** use the Tetris name, logo or artwork, or copy NES palettes or screens: the ten pairs are original.
