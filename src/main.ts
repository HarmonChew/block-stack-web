import "./style.css";
import { EV_GAME_OVER, EV_LEVEL, EV_LINES, EV_LOCKED, EV_MOVED, EV_ROTATED, FPS, PHASE_LINE_CLEAR,
         type View } from "./engine.ts";
import { type Bot, type BotIndex, loadBotGame, loadBots } from "./bots.ts";
import { blockRain, reducedMotion, wipe } from "./fx.ts";
import { ICONS } from "./icons.ts";
import { bindTouch, held, suppressHeld } from "./input.ts";
import { type Kind, Match, type Side } from "./match.ts";
import { BLITZ_FRAMES, MODES, SPRINT_LINES } from "./modes.ts";
import { guardMenu, pollMenuPad, setCursor, setNavScope } from "./nav.ts";
import { applyPalette, palette } from "./palette.ts";
import { BotPreview } from "./preview.ts";
import { getRecord, recordKey, saveRecord } from "./records.ts";
import { type BoardFx, drawBoard, drawNext } from "./render.ts";
import { isMuted, setMuted, sfx, unlockAudio } from "./sound.ts";
import { Logo } from "./title.ts";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const FIRST_PIECE_DELAY = 96; // frames before the first piece appears (engine timing)
const WATCH_SPEEDS = [1, 2, 4, 8];
const SOLO_LEVELS = Array.from({ length: 20 }, (_, level) => level);
// NES gravity: frames per row at each level, shown on the level select.
const GRAVITY = [48, 43, 38, 33, 28, 23, 18, 13, 8, 6, 5, 5, 5, 4, 4, 4, 3, 3, 3, 2];

interface Setup {
  kind: Kind;
  level: number;
  bot: string; // bot id; ignored in solo
  seed: number;
}

type ScreenId = "title" | "challenged" | "menu" | "solo" | "vs-type" | "vs-bot" | "daily" | "arena";
const SCREENS: ScreenId[] = ["title", "challenged", "menu", "solo", "vs-type", "vs-bot", "daily", "arena"];
const PARENT: Partial<Record<ScreenId, ScreenId>> = {
  challenged: "title", menu: "title", solo: "menu", "vs-type": "menu", "vs-bot": "vs-type", daily: "menu",
};

let bots: BotIndex;
let choice = { kind: "sprint" as Kind, level: 18, soloLevel: 9, bot: "pro" };
let challenge: (Setup & { text: string }) | null = null;
let screen: ScreenId = "title";
let returnTo: ScreenId = "menu"; // the setup screen a match goes back to
const remembered: Partial<Record<ScreenId, string>> = {}; // the cursor's last option per screen

// ------------------------------------------------------------------ formatting

const score = (value: number) => Math.round(value).toLocaleString("en-US");
const pad3 = (value: number) => String(value).padStart(3, "0");
function clock(frames: number): string {
  const seconds = Math.max(0, frames) / FPS;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds - minutes * 60;
  return `${minutes}:${rest.toFixed(1).padStart(4, "0")}`;
}
const botById = (id: string) => bots.bots.find((bot) => bot.id === id)!;
const isVersus = (kind: Kind) => kind === "sprint" || kind === "blitz" || kind === "duel";
const modeName = (kind: Kind) => MODES.find((mode) => mode.id === kind)?.name ?? (kind === "solo" ? "Solo" : "Watch");
const randomSeed = () => bots.seeds[Math.floor(Math.random() * bots.seeds.length)];
const today = () => Math.floor(Date.now() / 86_400_000);

function option(key: string, html: string, onChoose: () => void, extra = ""): HTMLButtonElement {
  const element = document.createElement("button");
  element.type = "button";
  element.className = `option ${extra}`;
  element.dataset.nav = "";
  element.dataset.key = key;
  element.innerHTML = html;
  element.addEventListener("click", () => {
    unlockAudio();
    sfx.menuSelect();
    onChoose();
  });
  return element;
}

// ------------------------------------------------------------------ screens

/** The level whose palette colours a screen. */
function screenLevel(id: ScreenId): number {
  if (id === "solo") return choice.soloLevel;
  if (id === "vs-type" || id === "vs-bot") return choice.level;
  if (id === "daily") return dailySetup().level;
  if (id === "challenged" && challenge) return challenge.level;
  if (id === "arena" && match) return (match.you ?? match.bot)!.game.view().level;
  if (id === "title") return logo.paletteLevel;
  return 0;
}

let wiping = false;

async function go(id: ScreenId, how: "forward" | "back" | "wipe" = "forward", before?: () => void): Promise<void> {
  if (wiping) return;
  if (id !== "arena") starting++; // leaving for a menu cancels a match still loading
  const leaving = $(screen).querySelector<HTMLElement>("[data-nav].cur")?.dataset.key;
  if (leaving) remembered[screen] = leaving;
  const swap = () => {
    before?.();
    for (const other of SCREENS) $(other).hidden = other !== id;
    const element = $(id);
    element.classList.remove("enter", "enter-back");
    if (how !== "wipe") {
      void element.offsetWidth;
      element.classList.add(how === "back" ? "enter-back" : "enter");
    }
    screen = id;
    $("menu-chrome").hidden = id === "title" || id === "arena";
    document.body.classList.toggle("in-game", id === "arena");
    if (id !== "vs-bot") preview.stop();
    renderScreen(id);
    applyPalette(document.documentElement, screenLevel(id));
    if (id !== "arena") {
      const key = remembered[id];
      setCursor(key ? element.querySelector<HTMLElement>(`[data-key="${key}"]`) : null);
    }
  };
  if (how !== "wipe") return swap();
  wiping = true;
  try {
    await wipe(swap, palette(screenLevel(screen)));
  } finally {
    wiping = false;
  }
}

function goBack(): void {
  if (screen === "arena") {
    if (paused) setPaused(false);
    else if (match?.result) toMenu();
    return;
  }
  const parent = PARENT[screen];
  if (!parent) return;
  sfx.menuBack();
  void go(parent, "back");
}

function renderScreen(id: ScreenId): void {
  if (id === "menu") renderMenu();
  else if (id === "solo") renderSolo();
  else if (id === "vs-type") renderModes();
  else if (id === "vs-bot") renderBots();
  else if (id === "daily") renderDaily();
  else if (id === "challenged") renderChallenge();
}

// Title: the logo builds itself, then the palette cycles until START.
const logo = new Logo($("logo"));
let logoReady = false;
let nextRecolour = 0;

function updateTitle(now: number): void {
  logo.draw(now);
  if (!logoReady && logo.done) {
    logoReady = true;
    $("title").classList.add("ready");
    nextRecolour = now + 3500;
  }
  if (logoReady && !reducedMotion() && now > nextRecolour) {
    logo.nextPalette();
    applyPalette(document.documentElement, logo.paletteLevel);
    nextRecolour = now + 3500;
  }
}

function pressStart(): void {
  if (screen !== "title") return;
  unlockAudio();
  if (!logoReady) {
    logo.start(true); // a press during the build completes it; the next press starts
    return;
  }
  sfx.menuSelect();
  void go(challenge ? "challenged" : "menu", "wipe");
}

// Main menu.
function renderMenu(): void {
  const daily = dailySetup();
  const beaten = getRecord(`daily/${today()}`)?.wins;
  $("menu-daily").querySelector("small")!.innerHTML =
    `${modeName(daily.kind)} vs ${botById(daily.bot).name}, level ${daily.level}` +
    (beaten ? ` <span class="medal">${ICONS.star}beaten</span>` : "");
  for (const element of $("menu").querySelectorAll<HTMLElement>("[data-go]")) {
    element.dataset.key = element.dataset.go;
  }
}

// Solo: the level grid. The cursor is the choice; each level shows its palette.
function renderSolo(): void {
  const grid = $("level-grid");
  grid.replaceChildren(...SOLO_LEVELS.map((level) => {
    const colours = palette(level);
    const best = getRecord(recordKey("solo", level, null));
    const cell = option(`lv${level}`, `<span>${level}</span><span class="chips"><i></i><i></i><i></i></span>` +
      (best?.best ? `<small aria-hidden="true">${ICONS.star}</small>` : ""),
      () => void start({ kind: "solo", level, bot: choice.bot, seed: 1 + Math.floor(Math.random() * 65535) }), "lv");
    cell.classList.remove("option");
    cell.dataset.confirm = "";
    cell.style.setProperty("--ca", colours.a);
    cell.style.setProperty("--cb", colours.b);
    cell.setAttribute("aria-label", `Level ${level}${best?.best ? `, best ${score(best.best)}` : ""}`);
    cell.addEventListener("focus", () => {
      choice.soloLevel = level;
      applyPalette(document.documentElement, level);
      renderLevelNote();
    });
    return cell;
  }));
  remembered.solo ??= `lv${choice.soloLevel}`;
  renderLevelNote();

  const bests = SOLO_LEVELS
    .map((level) => ({ level, best: getRecord(recordKey("solo", level, null))?.best ?? 0 }))
    .filter((entry) => entry.best > 0)
    .sort((a, b) => b.best - a.best)
    .slice(0, 5);
  $("best-list").innerHTML = bests.length
    ? bests.map(({ level, best }) => `<li><span>LEVEL ${level}</span><b>${score(best)}</b></li>`).join("")
    : `<li class="muted">No games yet. Your best scores land here.</li>`;
}

function renderLevelNote(): void {
  const level = choice.soloLevel;
  const best = getRecord(recordKey("solo", level, null));
  const speed = GRAVITY[level];
  const touch = document.body.classList.contains("touch-device");
  $("level-note").innerHTML = `Level ${level}: pieces fall a row every ${speed} frame${speed > 1 ? "s" : ""}.` +
    (best?.best ? ` <span class="hot">Best ${score(best.best)}.</span>` : "") +
    ` <span class="muted">${touch ? "Tap again" : "Enter"} to play.</span>`;
}

// VS AI, step 1: the game type.
function modeRecord(kind: Kind): string {
  let plays = 0;
  let wins = 0;
  for (const level of bots.levels) {
    for (const bot of bots.bots) {
      const record = getRecord(recordKey(kind, level, bot.id));
      plays += record?.plays ?? 0;
      wins += record?.wins ?? 0;
    }
  }
  if (!plays) return "";
  return `<small class="mode-record">${ICONS.star}${wins} win${wins === 1 ? "" : "s"} in ${plays}</small>`;
}

function renderModes(): void {
  $("mode-list").replaceChildren(...MODES.map((mode) => option(mode.id,
    `<b>${mode.name.toUpperCase()}</b><small>${mode.goal}</small>${modeRecord(mode.id)}`,
    () => {
      choice.kind = mode.id;
      void go("vs-bot");
    }, "big")));
  remembered["vs-type"] ??= choice.kind;
}

// VS AI, step 2: the opponent. The selected bot plays live in the preview.
const preview = new BotPreview($("preview"));
let previewSeed = 0;

function typicalLine(bot: Bot, kind: Kind, level: number): string {
  const stats = bots.stats[`${level}/${bot.id}`];
  if (kind === "sprint") {
    return stats.sprintFinishPct < 50
      ? `Usually tops out before ${SPRINT_LINES} lines.`
      : `Typical ${modeName(kind)}: ${clock(stats.sprintFrames)}`;
  }
  if (kind === "blitz") return `Typical ${modeName(kind)} score: ${score(stats.blitzScore)}`;
  return `Typical final score: ${score(bot.typical[level].score)}`;
}

function medal(kind: Kind, level: number, bot: string): string {
  const record = getRecord(recordKey(kind, level, bot));
  if (!record) return "";
  return record.wins > 0
    ? ` <span class="medal" title="Beaten ${record.wins} of ${record.plays}">${ICONS.star}${record.wins}/${record.plays}</span>`
    : ` <span class="muted" title="Not beaten yet">0/${record.plays}</span>`;
}

function renderBots(): void {
  const kind = choice.kind;
  $("bot-list").replaceChildren(...bots.bots.map((bot, rank) => {
    const pips = Array.from({ length: 5 }, (_, i) => `<i class="${i <= rank ? "on" : ""}"></i>`).join("");
    const element = option(bot.id,
      `<b>${bot.name.toUpperCase()}</b><span class="meter" aria-hidden="true">${pips}</span>` +
      `<small>${bot.tap_hz} taps/s · reacts in ${bot.reaction_ms} ms${medal(kind, choice.level, bot.id)}</small>`,
      () => void startVersus(), "bot-option");
    element.setAttribute("aria-label", `${bot.name}, difficulty ${rank + 1} of 5`);
    element.dataset.confirm = "";
    element.addEventListener("focus", () => pickBot(bot.id));
    return element;
  }));
  $("bot-levels").replaceChildren(...bots.levels.map((level) => {
    const element = option(`level${level}`, String(level), () => {
      choice.level = level;
      applyPalette(document.documentElement, level);
      renderBots();
      setCursor($("vs-bot").querySelector(`[data-key="level${level}"]`));
    }, "segment");
    element.classList.remove("option");
    element.classList.toggle("on", level === choice.level);
    element.setAttribute("aria-pressed", String(level === choice.level));
    return element;
  }));
  remembered["vs-bot"] ??= choice.bot;
  pickBot(choice.bot, true);
}

function pickBot(id: string, force = false): void {
  if (id === choice.bot && !force) return;
  choice.bot = id;
  const bot = botById(id);
  for (const element of $("bot-list").children) {
    element.classList.toggle("picked", (element as HTMLElement).dataset.key === id);
  }
  $("bot-name").textContent = bot.name.toUpperCase();
  $("bot-blurb").textContent = bot.blurb;
  $("bot-typical").textContent = typicalLine(bot, choice.kind, choice.level);
  $("vs-start").textContent = `CHALLENGE ${bot.name.toUpperCase()}`;
  $("live-lines").textContent = "";
  $("live-score").textContent = "";
  previewSeed = bots.seeds[(bots.bots.indexOf(bot) * 17 + choice.level) % bots.seeds.length];
  void preview.play(choice.level, id, previewSeed).catch(() => undefined);
}

preview.onView = (view) => {
  $("live-lines").textContent = `LIVE · ${pad3(view.lines)} lines`;
  $("live-score").textContent = `Score ${score(view.score)}`;
};

function startVersus(): void {
  void start({ kind: choice.kind, level: choice.level, bot: choice.bot, seed: randomSeed() });
}

// Daily challenge: the same match for everyone today.
function dailySetup(): Setup {
  const day = today();
  const mode = MODES[day % MODES.length].id;
  const level = bots.levels[Math.floor(day / MODES.length) % bots.levels.length];
  const bot = bots.bots[1 + (day % (bots.bots.length - 1))].id; // never the Rookie
  return { kind: mode, level, bot, seed: bots.seeds[(day * 37) % bots.seeds.length] };
}

function renderDaily(): void {
  const daily = dailySetup();
  const record = getRecord(`daily/${today()}`);
  const date = new Date().toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  $("daily-head").textContent = `DAILY · ${date.toUpperCase()}`;
  $("daily-match").textContent = `${modeName(daily.kind).toUpperCase()} VS ${botById(daily.bot).name.toUpperCase()}`;
  $("daily-detail").textContent = `Level ${daily.level}, seed #${daily.seed}. Everyone gets the same pieces today.`;
  $("daily-status").innerHTML = record?.wins
    ? `${ICONS.star}Beaten today, ${record.wins} of ${record.plays}.` +
      (record.best ? ` Best: ${daily.kind === "sprint" ? clock(record.best) : score(record.best)}` : "")
    : record ? `Not beaten yet, ${record.plays} tr${record.plays === 1 ? "y" : "ies"} so far.` : "A new match every day.";
  $("daily-status").classList.toggle("medal", Boolean(record?.wins));
}

// A challenge link: #c=<mode>.<level>.<bot>.<seed>[.<message>]
function readChallengeLink(): void {
  const found = /^#c=(sprint|blitz|duel)\.(\d+)\.([a-z]+)\.(\d+)(?:\.(.*))?$/.exec(location.hash);
  if (!found) return;
  const [, kind, level, bot, seed, text] = found;
  if (!bots.levels.includes(Number(level)) || !bots.bots.some((b) => b.id === bot) ||
      !bots.seeds.includes(Number(seed))) return;
  challenge = { kind: kind as Kind, level: Number(level), bot, seed: Number(seed),
                text: text ? safeDecode(text) : "" };
  choice = { ...choice, kind: challenge.kind, level: challenge.level, bot };
}

function safeDecode(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return "";
  }
}

function renderChallenge(): void {
  if (!challenge) return;
  $("challenge-text").textContent = challenge.text || "A friend challenged you.";
  $("challenge-match").textContent = `${modeName(challenge.kind)} vs ${botById(challenge.bot).name}, ` +
    `level ${challenge.level}, seed #${challenge.seed}. Same pieces they had.`;
}

// ------------------------------------------------------------------ the match screen

interface Panel {
  root: HTMLElement;
  well: HTMLElement;
  board: HTMLCanvasElement;
  next: HTMLCanvasElement;
  overlay: HTMLElement;
  pop: HTMLElement;
  stats: Record<"score" | "lines" | "level" | "trt", HTMLElement>;
  levelBox: HTMLElement;
  // animation state
  clear: { board: Uint8Array; rows: number; start: number; tetris: boolean } | null;
  deadAt: number;
  shownScore: number;
  level: number;
  overlayText: string;
}

function panel(name: string, extra: string, level: number): Panel {
  const root = document.createElement("div");
  root.className = `player ${extra}`;
  root.innerHTML = `
    <div class="tag">${name.toUpperCase()}</div>
    <div class="frame lines-box"><span>LINES</span><b data-k="lines"></b></div>
    <div class="well"><canvas class="board"></canvas><div class="board-overlay"></div><div class="pop"></div></div>
    <div class="side">
      <div class="frame box"><span class="label">SCORE</span><b data-k="score"></b></div>
      <div class="frame box next-box"><span class="label">NEXT</span><div class="next-well"><canvas class="next"></canvas></div></div>
      <div class="frame box level-box"><span class="label">LEVEL</span><b data-k="level"></b></div>
      <div class="frame box trt-box"><span class="label">TETRIS RATE</span><b data-k="trt"></b></div>
    </div>`;
  applyPalette(root, level);
  const stat = (key: string) => root.querySelector<HTMLElement>(`[data-k="${key}"]`)!;
  return {
    root,
    well: root.querySelector(".well")!,
    board: root.querySelector(".board")!,
    next: root.querySelector(".next")!,
    overlay: root.querySelector(".board-overlay")!,
    pop: root.querySelector(".pop")!,
    stats: { score: stat("score"), lines: stat("lines"), level: stat("level"), trt: stat("trt") },
    levelBox: root.querySelector(".level-box")!,
    clear: null,
    deadAt: 0,
    shownScore: 0,
    level,
    overlayText: "",
  };
}

let match: Match | null = null;
let setup: Setup | null = null;
let panels: { you: Panel | null; bot: Panel | null } = { you: null, bot: null };
let paused = false;
let accumulator = 0;
let lastTime = 0;
let watchSpeed = 0;
let shown = false;
let starting = 0; // start() calls in flight, so a slow bot download cannot start twice
let leadShown = "";

async function start(next: Setup): Promise<void> {
  if (wiping) return;
  const token = ++starting;
  unlockAudio();
  const bot = next.kind === "solo" ? null : botById(next.bot);
  let created: Match;
  try {
    const inputs = bot ? await loadBotGame(next.level, bot.id, next.seed) : null;
    created = await Match.create(next.kind, next.level, next.seed, inputs, bot?.name);
  } catch {
    if (token === starting) {
      toast(bot ? `Couldn't load ${bot.name}'s game. Check your connection and try again.`
                : "Couldn't start the game. Reload the page and try again.");
    }
    return;
  }
  if (token !== starting || wiping) {
    created.destroy();
    return;
  }
  if (screen !== "arena") returnTo = screen === "challenged" ? "menu" : screen;
  await go("arena", "wipe", () => {
    match?.destroy();
    match = created;
    setup = next;
    paused = false;
    shown = false;
    accumulator = 0;
    watchSpeed = 0;
    leadShown = "";
    panels = {
      you: next.kind === "watch" ? null : panel("You", "you", next.level),
      bot: bot ? panel(bot.name, next.kind === "watch" ? "you" : "them", next.level) : null,
    };
    const boards = $("boards");
    boards.replaceChildren(...[panels.you, panels.bot].filter((p) => p).map((p) => p!.root));
    boards.classList.toggle("single", !panels.you || !panels.bot);
    $("status-title").textContent = next.kind === "watch"
      ? `Watching ${bot!.name} · level ${next.level} · seed #${next.seed}`
      : `${modeName(next.kind)}${bot ? ` vs ${bot.name}` : ""} · level ${next.level}${bot ? ` · seed #${next.seed}` : ""}`;
    $("status-main").textContent = "";
    $("lead").innerHTML = "<i></i>".repeat(20);
    $("lead").hidden = !(panels.you && panels.bot);
    $("speed").hidden = next.kind !== "watch";
    $("speed").textContent = "1×";
    $("pause").hidden = next.kind === "watch";
    $("touch").hidden = next.kind === "watch";
    $("overlay").hidden = true;
    showPauseIcon();
    suppressHeld(); // the key that picked START is not the first move
    history.replaceState(null, "", location.pathname);
  });
}

let toastTimer = 0;
function toast(text: string): void {
  const element = $("toast");
  element.textContent = text;
  element.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { element.hidden = true; }, 4500);
}

function toMenu(): void {
  starting++;
  void go(returnTo, "wipe", () => {
    match?.destroy();
    match = null;
    $("overlay").hidden = true;
  });
}

function showPauseIcon(): void {
  $("pause").innerHTML = paused ? ICONS.play : ICONS.pause;
}

function setPaused(value: boolean): void {
  if (!match || match.result || match.kind === "watch" || paused === value) return;
  paused = value;
  showPauseIcon();
  const overlay = $("overlay");
  overlay.hidden = !value;
  if (!value) suppressHeld(); // resuming with X or Z must not rotate the piece
  if (value) {
    overlay.innerHTML = `<div class="frame dialog"><h2>PAUSE</h2><div class="options"></div></div>`;
    overlay.querySelector(".options")!.append(
      option("resume", "<b>CONTINUE</b>", () => setPaused(false)),
      option("restart", "<b>RESTART</b>", () => void start({ ...setup! })),
      option("quit", "<b>QUIT TO MENU</b>", toMenu));
    setCursor(null);
    guardMenu();
  }
}

function pop(target: Panel | null, text: string, kind = ""): void {
  if (!target) return;
  const element = document.createElement("div");
  element.className = `pop-text ${kind}`;
  element.textContent = text;
  target.pop.append(element);
  setTimeout(() => element.remove(), 1400);
}

function replay(element: HTMLElement, name: string): void {
  element.classList.remove(name);
  void element.offsetWidth;
  element.classList.add(name);
}

function react(player: Side | null, target: Panel | null, isYou: boolean): void {
  if (!player || !target) return;
  const events = player.lastEvents;
  player.lastEvents = 0;
  const lines = events & EV_LINES;
  if (lines === 4) {
    pop(target, "TETRIS!", "tetris");
    replay(target.well, "flash");
    if (isYou && !reducedMotion()) replay(target.well, "shake");
  }
  if (events & EV_LEVEL) {
    const level = player.game.view().level;
    target.level = level;
    applyPalette(target.root, level);
    replay(target.levelBox, "bump");
    if (target === (panels.you ?? panels.bot)) applyPalette(document.documentElement, level);
    if (level === 19 || level === 29) pop(target, `LEVEL ${level}`);
    if (level === 39) pop(target, "DOUBLE SPEED");
  }
  if (!isYou) return;
  if (events & EV_GAME_OVER) sfx.over();
  else if (lines === 4) sfx.tetris();
  else if (lines) sfx.clear(lines);
  else if (events & EV_LEVEL) sfx.level();
  else if (events & EV_LOCKED) sfx.lock();
  else if (events & EV_ROTATED) sfx.rotate();
  else if (events & EV_MOVED) sfx.move();
}

/** Rebuilds the board as it was at the lock: the engine has already removed the
 * cleared rows, so they go back in at their places, filled from the previous frame. */
function unclear(after: Uint8Array, before: Uint8Array, rows: number): Uint8Array {
  const board = new Uint8Array(200);
  let source = 19;
  for (let y = 19; y >= 0; y--) {
    if (rows & (1 << y)) {
      const row = before.subarray(y * 10, y * 10 + 10);
      const fill = row.find((cell) => cell !== 0) || 1;
      for (let x = 0; x < 10; x++) board[y * 10 + x] = row[x] || fill;
    } else {
      board.set(after.subarray(source * 10, source * 10 + 10), y * 10);
      source--;
    }
  }
  return board;
}

/** Steps the match one frame, keeping what a line clear removed for its animation. */
function step(m: Match, input: number): void {
  const sides: [Side | null, Panel | null][] = [[m.you, panels.you], [m.bot, panels.bot]];
  const before = sides.map(([side]) => side && !side.out ? { lines: side.game.lines, board: side.game.board() } : null);
  m.step(input);
  sides.forEach(([side, target], i) => {
    const was = before[i];
    if (!side || !target || !was || side.game.lines === was.lines) return;
    const rows = side.game.view().clearingRows;
    target.clear = { board: unclear(side.game.board(), was.board, rows), rows, start: -1,
                     tetris: side.game.lines - was.lines === 4 };
  });
}

function drawPanel(target: Panel | null, player: Side | null, seconds: number): View | null {
  if (!target || !player) return null;
  const view = player.game.view();
  const fx: BoardFx = { hidden: paused };
  const clear = target.clear;
  // A recording or the match can end mid-clear; the board then shows as the engine left it.
  if (clear && (view.clearingRows === 0 || player.out || match!.result)) target.clear = null;
  else if (clear) {
    if (view.phase === PHASE_LINE_CLEAR && clear.start < 0) clear.start = view.frame;
    const stepIndex = clear.start < 0 ? 0 : Math.min(5, Math.floor((view.frame - clear.start) / 4) + 1);
    const flash = stepIndex === 0 ? ((view.frame >> 2) & 1) === 0 : clear.tetris && stepIndex % 2 === 1;
    fx.clear = { board: clear.board, rows: clear.rows, step: stepIndex, flash };
  }
  if (player.out && player.game.over) {
    target.deadAt ||= performance.now();
    fx.dead = reducedMotion() ? 1 : Math.min(1, (performance.now() - target.deadAt) / 800);
  }
  drawBoard(target.board, view, fx);
  drawNext(target.next, view);

  // The score rolls up to its value instead of jumping.
  const gap = view.score - target.shownScore;
  target.shownScore = Math.abs(gap) < 1 ? view.score : target.shownScore + gap * Math.min(1, seconds * 9);
  const text = (element: HTMLElement, value: string) => {
    if (element.textContent !== value) element.textContent = value;
  };
  text(target.stats.score, score(target.shownScore));
  target.stats.score.classList.toggle("long", target.shownScore >= 1_000_000);
  text(target.stats.lines, match!.kind === "sprint" ? `${pad3(view.lines)}/${SPRINT_LINES}` : pad3(view.lines));
  text(target.stats.level, String(view.level).padStart(2, "0"));
  text(target.stats.trt, view.lines ? `${Math.round((400 * view.clears[3]) / view.lines)}%` : "--");
  return view;
}

function setOverlay(target: Panel, value: string, className: string): void {
  if (target.overlayText === value) return;
  target.overlayText = value;
  target.overlay.className = `board-overlay ${className}`;
  target.overlay.innerHTML = value ? `<span>${value}</span>` : "";
}

// The dot travels with the lead word, so a wrap never strands it.
const leadWord = (lead: number, word: string) =>
  `<span class="${lead > 0 ? "ahead" : lead < 0 ? "behind" : "even"}"><span class="sep">·&nbsp;</span>${word}</span>`;

function drawStatus(you: View | null, bot: View | null): void {
  const m = match!;
  const main = $("status-main");
  let lead = 0;
  let scale = 1;
  let html = `<span>${clock(m.frame)}</span>`;
  if (m.kind === "sprint" && you && bot) {
    lead = you.lines - bot.lines;
    scale = 10;
    const word = lead === 0 ? "EVEN" : `${Math.abs(lead)} LINE${Math.abs(lead) === 1 ? "" : "S"} ${lead > 0 ? "AHEAD" : "BEHIND"}`;
    html += leadWord(lead, word);
  } else if ((m.kind === "blitz" || m.kind === "duel") && you && bot) {
    lead = you.score - bot.score;
    scale = 60_000;
    if (m.kind === "blitz") html = `<span>${clock(BLITZ_FRAMES - m.frame)} LEFT</span>`;
    const word = lead === 0 ? "EVEN" : `${score(Math.abs(lead))} ${lead > 0 ? "AHEAD" : "BEHIND"}`;
    html += leadWord(lead, word);
  }
  if (main.innerHTML !== html) main.innerHTML = html;

  // The lead meter: up to ten segments either side of the centre.
  const lit = Math.round(Math.tanh(lead / scale) * 10);
  const key = String(lit);
  if (key !== leadShown && you && bot) {
    leadShown = key;
    [...$("lead").children].forEach((segment, i) => {
      const ahead = lit > 0 && i >= 10 && i < 10 + lit;
      const behind = lit < 0 && i < 10 && i >= 10 + lit;
      segment.className = ahead ? "ahead" : behind ? "behind" : "";
    });
  }

  if (panels.you && m.you) {
    const frame = m.frame;
    let text = "";
    let className = "";
    if (m.kind !== "watch" && frame < FIRST_PIECE_DELAY) {
      text = String(Math.ceil((FIRST_PIECE_DELAY - frame) / 32));
      className = "show count tick";
    } else if (m.kind !== "watch" && frame < FIRST_PIECE_DELAY + 30) {
      text = "GO!";
      className = "show count tick";
    }
    if (m.you.out) {
      text = "TOPPED<br>OUT";
      className = "show out";
    }
    if (text !== panels.you.overlayText && className.includes("count")) {
      if (text === "GO!") sfx.go();
      else sfx.count();
    }
    setOverlay(panels.you, text, className);
  }
  if (panels.bot && m.bot) {
    setOverlay(panels.bot, m.bot.out ? (m.bot.game.over ? "TOPPED<br>OUT" : "LINE<br>CAP") : "", m.bot.out ? "show out" : "");
  }
  // Once you are out, the bot plays on fast until the result is decided.
  const finishing = m.botOnly && m.kind !== "watch" && m.kind !== "solo";
  const overlay = $("overlay");
  if (finishing && overlay.hidden) {
    overlay.hidden = false;
    overlay.innerHTML = `<div class="frame dialog slim"><p>${botById(setup!.bot).name.toUpperCase()} IS STILL PLAYING...</p><div class="options"></div></div>`;
    overlay.querySelector(".options")!.append(option("skip", "<b>SKIP</b>", () => m.finish()));
    setCursor(null);
    guardMenu();
  }
}

function countUp(element: HTMLElement, value: number, format: (value: number) => string, delay: number): void {
  if (reducedMotion() || value <= 0) {
    element.textContent = format(value);
    return;
  }
  element.textContent = format(0);
  const begun = performance.now() + delay;
  const tick = (now: number) => {
    const t = Math.min(1, Math.max(0, (now - begun) / 700));
    element.textContent = format(value * (1 - (1 - t) ** 3));
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function showResult(): void {
  const m = match!;
  const s = setup!;
  shown = true;
  const result = m.result!;
  const you = m.you?.game.view();
  const bot = m.bot?.game.view();
  const opponent = s.kind === "solo" ? null : botById(s.bot);
  const sprint = m.kind === "sprint";
  const best = !you ? null : sprint ? m.you!.sprintFrame || null : you.score;
  let improved = false;
  if (m.kind !== "watch") {
    improved = saveRecord(recordKey(m.kind, s.level, s.kind === "solo" ? null : s.bot), result.winner, best, sprint);
    const daily = dailySetup();
    if (daily.kind === s.kind && daily.level === s.level && daily.bot === s.bot && daily.seed === s.seed) {
      saveRecord(`daily/${today()}`, result.winner, best, sprint);
    }
  }
  const title = result.winner === "you" ? "YOU WIN!" : result.winner === "bot" ? `${opponent!.name.toUpperCase()} WINS`
    : result.winner === "tie" ? "TIE!" : m.kind === "watch" ? `${opponent!.name.toUpperCase()}'S GAME` : "GAME OVER";
  if (result.winner === "you") {
    sfx.win();
    blockRain(palette((you ?? bot)!.level));
  } else if (result.winner === "bot") sfx.lose();

  type Row = [string, (view: View, side: Side) => number, (value: number) => string];
  const rows: Row[] = [
    ["SCORE", (view) => view.score, score],
    ["LINES", (view) => view.lines, (value) => String(Math.round(value))],
    ["LEVEL", (view) => view.level, (value) => String(Math.round(value))],
    ["TETRISES", (_, side) => side.tetrises, (value) => String(Math.round(value))],
  ];
  if (sprint) rows.unshift([`TIME TO ${SPRINT_LINES}`, (_, side) => side.sprintFrame, (value) => (value ? clock(value) : "--")]);
  const columns: [string, View, Side][] = [];
  if (you) columns.push(["YOU", you, m.you!]);
  if (bot) columns.push([opponent!.name.toUpperCase(), bot, m.bot!]);

  const overlay = $("overlay");
  overlay.hidden = false;
  overlay.innerHTML = `<div class="frame dialog result ${result.winner ?? ""}">
    <h2>${title}</h2><p class="detail">${result.reason}</p>
    <table class="tally"><tr style="--i:0"><th></th>${columns.map(([name]) => `<th>${name}</th>`).join("")}</tr>${rows
      .map(([label], r) => `<tr style="--i:${r + 1}"><td>${label}</td>${columns.map((_, c) => `<td data-cell="${r}.${c}"></td>`).join("")}</tr>`)
      .join("")}</table>
    ${improved ? `<p class="best">NEW PERSONAL BEST!</p>` : ""}<div class="options"></div></div>`;
  rows.forEach(([, value, format], r) => columns.forEach(([, view, side], c) => {
    const cell = overlay.querySelector<HTMLElement>(`[data-cell="${r}.${c}"]`)!;
    const exact = value(view, side);
    // Times do not count up; everything else tallies like an arcade bonus screen.
    if (sprint && r === 0) cell.textContent = format(exact);
    else countUp(cell, exact, format, 200 + r * 110);
  }));

  const list = overlay.querySelector(".options")!;
  if (m.kind === "watch") {
    list.append(option("another", "<b>WATCH ANOTHER</b>", () => void start({ ...s, seed: randomSeed() })));
  } else {
    list.append(option("rematch", "<b>REMATCH</b><small>Same pieces</small>", () => void start({ ...s })));
    list.append(option("new", "<b>NEW GAME</b><small>New pieces</small>",
      () => void start({ ...s, seed: s.kind === "solo" ? 1 + Math.floor(Math.random() * 65535) : randomSeed() })));
    const rank = bots.bots.findIndex((b) => b.id === s.bot);
    if (s.kind !== "solo" && result.winner === "you" && rank >= 0 && rank + 1 < bots.bots.length) {
      const nextBot = bots.bots[rank + 1];
      list.append(option("next", `<b>NEXT: ${nextBot.name.toUpperCase()}</b><small>One step harder</small>`, () => {
        choice.bot = nextBot.id;
        remembered["vs-bot"] = nextBot.id;
        void start({ ...s, bot: nextBot.id, seed: randomSeed() });
      }));
    }
    if (isVersus(s.kind) && you) {
      const brag = sprint && m.you!.sprintFrame ? `${clock(m.you!.sprintFrame)} to ${SPRINT_LINES}` : `${score(you.score)} points`;
      const text = `${result.winner === "you" ? "I beat" : "I lost to"} ${opponent!.name} with ${brag}`;
      const copy = option("link", "<b>COPY CHALLENGE LINK</b><small>Same pieces for a friend</small>", async () => {
        const url = `${location.origin}${location.pathname}#c=${s.kind}.${s.level}.${s.bot}.${s.seed}.${encodeURIComponent(text)}`;
        const copied = await navigator.clipboard?.writeText(url).then(() => true, () => false);
        copy.querySelector("small")!.textContent = copied ? "Copied!" : url;
      });
      list.append(copy);
    }
  }
  list.append(option("menu", "<b>MENU</b>", toMenu));
  setCursor(null);
  guardMenu(700);
}

function frame(now: number): void {
  requestAnimationFrame(frame);
  const elapsed = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;
  pollMenuPad();
  if (screen === "title") updateTitle(now);
  if (screen === "vs-bot" && !preview.update(elapsed)) {
    previewSeed = bots.seeds[(bots.seeds.indexOf(previewSeed) + 1) % bots.seeds.length];
    void preview.play(choice.level, choice.bot, previewSeed).catch(() => undefined);
  }
  if (!match || screen !== "arena") return;
  if (!paused && !match.result) {
    const speed = match.kind === "watch" ? WATCH_SPEEDS[watchSpeed] : match.botOnly ? 6 : 1;
    accumulator += elapsed * FPS * speed;
    const steps = Math.floor(accumulator);
    accumulator -= steps;
    const input = held();
    for (let i = 0; i < steps && !match.result; i++) step(match, input);
    react(match.you, panels.you, true);
    react(match.bot, panels.bot, false);
  }
  const you = drawPanel(panels.you, match.you, elapsed);
  const bot = drawPanel(panels.bot, match.bot, elapsed);
  drawStatus(you, bot);
  if (match.result && !shown) showResult();
}

// ------------------------------------------------------------------ wiring

function wire(): void {
  setNavScope(() => {
    if (screen === "arena") {
      const overlay = $("overlay");
      return overlay.hidden || !overlay.querySelector("[data-nav]") ? null : overlay;
    }
    return $(screen);
  }, goBack, () => {
    if (screen === "arena" && match && !match.result) setPaused(!paused);
  });

  $("press-start").addEventListener("click", pressStart);
  $("title").addEventListener("pointerdown", (event) => {
    if (event.target !== $("press-start")) pressStart();
  });
  for (const element of $("menu").querySelectorAll<HTMLElement>("[data-go]")) {
    element.addEventListener("click", () => {
      unlockAudio();
      sfx.menuSelect();
      void go(element.dataset.go as ScreenId);
    });
  }
  $("controls").innerHTML = `<span><kbd>${ICONS.left}</kbd><kbd>${ICONS.right}</kbd>move</span>
    <span><kbd>${ICONS.down}</kbd>drop</span><span><kbd>X</kbd>rotate right</span>
    <span><kbd>Z</kbd>rotate left</span><span><kbd>P</kbd>pause</span>
    <span>Enter picks · Esc goes back</span>`;
  $("accept").addEventListener("click", () => {
    sfx.menuSelect();
    void start({ ...challenge! });
  });
  $("decline").addEventListener("click", () => {
    sfx.menuBack();
    void go("menu");
  });
  $("vs-start").addEventListener("click", () => {
    sfx.menuSelect();
    startVersus();
  });
  $("vs-watch").addEventListener("click", () => {
    sfx.menuSelect();
    void start({ kind: "watch", level: choice.level, bot: choice.bot, seed: randomSeed() });
  });
  $("daily-start").addEventListener("click", () => {
    sfx.menuSelect();
    void start(dailySetup());
  });
  for (const id of ["vs-start", "vs-watch", "daily-start", "accept", "decline", "press-start"]) $(id).dataset.key = id;

  $("back").innerHTML = ICONS.back;
  $("back").addEventListener("click", goBack);
  $("quit").innerHTML = ICONS.back;
  // Mid-match, the back button opens the pause menu rather than throwing the game away.
  $("quit").addEventListener("click", () => {
    if (match && !match.result && match.kind !== "watch") setPaused(true);
    else toMenu();
  });
  $("pause").addEventListener("click", () => setPaused(!paused));
  $("touch-start").addEventListener("click", () => setPaused(!paused));
  $("speed").addEventListener("click", () => {
    watchSpeed = (watchSpeed + 1) % WATCH_SPEEDS.length;
    $("speed").textContent = `${WATCH_SPEEDS[watchSpeed]}×`;
  });
  const showMute = () => {
    for (const id of ["mute", "menu-mute"]) {
      $(id).innerHTML = isMuted() ? ICONS.soundOff : ICONS.soundOn;
      $(id).setAttribute("aria-pressed", String(!isMuted()));
    }
  };
  for (const id of ["mute", "menu-mute"]) {
    $(id).addEventListener("click", () => {
      setMuted(!isMuted());
      showMute();
    });
  }
  showMute();

  addEventListener("keydown", (event) => {
    unlockAudio();
    if (screen === "title") {
      const shortcut = event.ctrlKey || event.metaKey || event.altKey || /^F\d+$/.test(event.key) ||
        ["Tab", "Shift", "Alt", "Control", "Meta"].includes(event.key);
      if (event.repeat || shortcut || event.defaultPrevented) return;
      pressStart();
      event.preventDefault(); // Enter on the focused button would press it a second time
      return;
    }
    if (!match || screen !== "arena" || match.result || event.defaultPrevented) return;
    if (match.kind === "watch" && event.code === "Escape") {
      toMenu();
    } else if (event.code === "KeyP" || ((event.code === "Escape" || event.code === "Enter") && !paused)) {
      setPaused(!paused);
      event.preventDefault();
    }
  });
  addEventListener("pointerdown", unlockAudio);
  document.addEventListener("visibilitychange", () => { if (document.hidden) setPaused(true); });

  const touch = $("touch");
  for (const [name, icon] of [["left", ICONS.left], ["right", ICONS.right], ["down", ICONS.down]] as const) {
    touch.querySelector(`[data-button="${name}"]`)!.innerHTML = icon;
  }
  bindTouch(touch);
  if (matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0) {
    document.body.classList.add("touch-device");
    $("press-start").textContent = "TAP TO START";
  }
}

async function main(): Promise<void> {
  applyPalette(document.documentElement, 0);
  bots = await loadBots();
  wire();
  readChallengeLink();
  logo.start(reducedMotion());
  logo.onLand = () => sfx.land();
  if (challenge) {
    logoReady = true;
    await go("challenged", "forward");
  } else {
    await go("title", "forward");
  }
  requestAnimationFrame((now) => { lastTime = now; frame(now); });
}

void main();
