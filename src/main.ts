import "./style.css";
import { EV_GAME_OVER, EV_LEVEL, EV_LINES, EV_LOCKED, EV_MOVED, EV_ROTATED, FPS, type View } from "./engine.ts";
import { type Bot, type BotIndex, loadBotGame, loadBots } from "./bots.ts";
import { bindTouch, held } from "./input.ts";
import { type Kind, Match, type Side } from "./match.ts";
import { BLITZ_FRAMES, MODES, SPRINT_LINES } from "./modes.ts";
import { getRecord, recordKey, saveRecord } from "./records.ts";
import { drawBoard, drawNext } from "./render.ts";
import { isMuted, setMuted, sfx, unlockAudio } from "./sound.ts";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const FIRST_PIECE_DELAY = 96; // frames before the first piece appears (engine timing)
const WATCH_SPEEDS = [1, 2, 4, 8];
const SOLO_LEVELS = [0, 5, 9, 12, 15, 18, 19];

interface Setup {
  kind: Kind;
  level: number;
  bot: string; // bot id; ignored in solo
  seed: number;
}

let bots: BotIndex;
let choice = { kind: "sprint" as Kind, level: 18, soloLevel: 9, bot: "pro" };
let challenge: (Setup & { text: string }) | null = null;

// ------------------------------------------------------------------ formatting

const score = (value: number) => Math.round(value).toLocaleString("en-US");
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

// ------------------------------------------------------------------ menu

function button(label: string, active: boolean, onClick: () => void, extra = ""): HTMLButtonElement {
  const element = document.createElement("button");
  element.type = "button";
  element.className = (active ? "active " : "") + extra;
  element.innerHTML = label;
  element.addEventListener("click", onClick);
  return element;
}

function typicalLine(bot: Bot, kind: Kind, level: number): string {
  const stats = bots.stats[`${level}/${bot.id}`];
  if (kind === "sprint") {
    return stats.sprintFinishPct < 50
      ? `Usually tops out before ${SPRINT_LINES} lines`
      : `Typical ${SPRINT_LINES} lines: ${clock(stats.sprintFrames)}`;
  }
  if (kind === "blitz") return `Typical 3:00 score: ${score(stats.blitzScore)}`;
  return `Typical final score: ${score(bot.typical[level].score)}`;
}

function medal(kind: Kind, level: number, bot: string): string {
  const record = getRecord(recordKey(kind, level, bot));
  if (!record) return "";
  return record.wins > 0
    ? `<span class="medal won" title="Beaten ${record.wins} of ${record.plays}">★ ${record.wins}/${record.plays}</span>`
    : `<span class="medal" title="Not beaten yet">${record.wins}/${record.plays}</span>`;
}

function renderMenu(): void {
  const modes = $("modes");
  modes.replaceChildren(
    ...MODES.map((mode) => button(mode.name, choice.kind === mode.id, () => { choice.kind = mode.id; renderMenu(); })),
    button("Solo", choice.kind === "solo", () => { choice.kind = "solo"; renderMenu(); }),
  );
  const versus = isVersus(choice.kind);
  $("goal").textContent = versus
    ? MODES.find((mode) => mode.id === choice.kind)!.goal
    : "Just you and the stack. Play until you top out.";

  const levels = versus ? bots.levels : SOLO_LEVELS;
  const current = versus ? choice.level : choice.soloLevel;
  $("levels").replaceChildren(...levels.map((level) => button(String(level), level === current, () => {
    if (versus) choice.level = level; else choice.soloLevel = level;
    renderMenu();
  })));

  const list = $("bots");
  list.hidden = !versus;
  $("watch").hidden = !versus;
  if (versus) {
    list.replaceChildren(...bots.bots.map((bot, rank) => {
      const card = button(
        `<span class="rank">${rank + 1}</span>
         <span class="bot-name">${bot.name}${medal(choice.kind, choice.level, bot.id)}</span>
         <span class="bot-blurb">${bot.blurb}</span>
         <span class="bot-stats">${bot.tap_hz} taps/s · reacts in ${bot.reaction_ms} ms · ${typicalLine(bot, choice.kind, choice.level)}</span>`,
        choice.bot === bot.id, () => { choice.bot = bot.id; renderMenu(); }, "bot-card");
      return card;
    }));
  }
  const solo = getRecord(recordKey("solo", choice.soloLevel, null));
  $("start").textContent = versus
    ? `Challenge ${botById(choice.bot).name}`
    : solo ? `Play (best ${score(solo.best)})` : "Play";
  renderDaily();
}

function dailySetup(): Setup {
  const day = Math.floor(Date.now() / 86_400_000);
  const mode = MODES[day % MODES.length].id;
  const level = bots.levels[Math.floor(day / MODES.length) % bots.levels.length];
  const bot = bots.bots[1 + (day % (bots.bots.length - 1))].id; // never the Rookie
  return { kind: mode, level, bot, seed: bots.seeds[(day * 37) % bots.seeds.length] };
}

function renderDaily(): void {
  const daily = dailySetup();
  const record = getRecord(`daily/${Math.floor(Date.now() / 86_400_000)}`);
  $("daily").innerHTML = `<span class="label">Daily challenge</span>
    <b>${modeName(daily.kind)} vs ${botById(daily.bot).name}</b>
    <span>Level ${daily.level} · seed #${daily.seed}${record?.wins ? " · ★ beaten today" : ""}</span>`;
}

function readChallengeLink(): void {
  const match = /^#c=(sprint|blitz|duel)\.(\d+)\.([a-z]+)\.(\d+)(?:\.(.*))?$/.exec(location.hash);
  if (!match) return;
  const [, kind, level, bot, seed, text] = match;
  if (!bots.levels.includes(Number(level)) || !bots.bots.some((b) => b.id === bot) ||
      !bots.seeds.includes(Number(seed))) return;
  challenge = { kind: kind as Kind, level: Number(level), bot, seed: Number(seed),
                text: text ? decodeURIComponent(text) : "" };
  choice = { ...choice, kind: challenge.kind, level: challenge.level, bot };
  const banner = $("challenge");
  banner.hidden = false;
  banner.innerHTML = `<b>You've been challenged!</b>
    <span>${challenge.text ? challenge.text + " · " : ""}${modeName(challenge.kind)} vs ${botById(bot).name}, level ${challenge.level}, seed #${challenge.seed}</span>`;
  banner.append(button("Accept", true, () => void start({ ...challenge! })));
}

// ------------------------------------------------------------------ the match screen

interface Panel {
  root: HTMLElement;
  board: HTMLCanvasElement;
  next: HTMLCanvasElement;
  overlay: HTMLElement;
  pop: HTMLElement;
  stats: Record<"score" | "lines" | "level" | "trt", HTMLElement>;
}

function panel(name: string, extra: string): Panel {
  const root = document.createElement("div");
  root.className = `player ${extra}`;
  root.innerHTML = `
    <div class="name">${name}</div>
    <div class="field"><canvas class="board"></canvas><div class="board-overlay"></div><div class="pop"></div></div>
    <div class="side">
      <div class="box"><span class="label">Next</span><canvas class="next"></canvas></div>
      <div class="box"><span class="label">Score</span><b data-k="score"></b></div>
      <div class="box"><span class="label">Lines</span><b data-k="lines"></b></div>
      <div class="box"><span class="label">Level</span><b data-k="level"></b></div>
      <div class="box"><span class="label">Tetris rate</span><b data-k="trt"></b></div>
    </div>`;
  const stat = (key: string) => root.querySelector<HTMLElement>(`[data-k="${key}"]`)!;
  return {
    root,
    board: root.querySelector(".board")!,
    next: root.querySelector(".next")!,
    overlay: root.querySelector(".board-overlay")!,
    pop: root.querySelector(".pop")!,
    stats: { score: stat("score"), lines: stat("lines"), level: stat("level"), trt: stat("trt") },
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

async function start(next: Setup): Promise<void> {
  const token = ++starting;
  unlockAudio();
  const bot = next.kind === "solo" ? null : botById(next.bot);
  const inputs = bot ? await loadBotGame(next.level, bot.id, next.seed) : null;
  if (token !== starting) return;
  match?.destroy();
  match = await Match.create(next.kind, next.level, next.seed, inputs, bot?.name);
  setup = next;
  paused = false;
  shown = false;
  accumulator = 0;
  watchSpeed = 0;

  const boards = $("boards");
  panels = {
    you: next.kind === "watch" ? null : panel("You", "you"),
    bot: bot ? panel(bot.name, next.kind === "watch" ? "you" : "them") : null,
  };
  boards.replaceChildren(...[panels.you, panels.bot].filter((p) => p).map((p) => p!.root));
  boards.classList.toggle("single", !panels.you || !panels.bot);
  $("status-title").textContent = next.kind === "watch"
    ? `Watching ${bot!.name} · level ${next.level} · seed #${next.seed}`
    : `${modeName(next.kind)}${bot ? ` vs ${bot.name}` : ""} · level ${next.level}${bot ? ` · seed #${next.seed}` : ""}`;
  $("speed").hidden = next.kind !== "watch";
  $("speed").textContent = "1×";
  $("pause").hidden = next.kind === "watch";
  $("touch").hidden = next.kind === "watch";
  $("overlay").hidden = true;
  $("menu").hidden = true;
  $("arena").hidden = false;
  history.replaceState(null, "", location.pathname);
}

function toMenu(): void {
  starting++;
  match?.destroy();
  match = null;
  $("arena").hidden = true;
  $("menu").hidden = false;
  renderMenu();
}

function setPaused(value: boolean): void {
  if (!match || match.result || match.kind === "watch") return;
  paused = value;
  const overlay = $("overlay");
  overlay.hidden = !value;
  if (value) {
    overlay.innerHTML = `<div class="card"><h2>Paused</h2></div>`;
    overlay.firstElementChild!.append(
      button("Resume", true, () => setPaused(false)),
      button("Restart", false, () => void start({ ...setup! })),
      button("Menu", false, toMenu));
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

function react(player: Side | null, target: Panel | null, isYou: boolean): void {
  if (!player) return;
  const events = player.lastEvents;
  player.lastEvents = 0;
  const lines = events & EV_LINES;
  if (lines === 4) pop(target, "TETRIS!", "tetris");
  if (events & EV_LEVEL) {
    const level = player.game.view().level;
    if (level === 19 || level === 29) pop(target, `LEVEL ${level}`, "level");
    if (level === 39) pop(target, "DOUBLE SPEED", "level");
  }
  if (!isYou) return;
  if (events & EV_GAME_OVER) sfx.over();
  else if (lines === 4) sfx.tetris();
  else if (lines) sfx.clear();
  else if (events & EV_LEVEL) sfx.level();
  else if (events & EV_LOCKED) sfx.lock();
  else if (events & EV_ROTATED) sfx.rotate();
  else if (events & EV_MOVED) sfx.move();
}

function drawPanel(target: Panel | null, player: Side | null): View | null {
  if (!target || !player) return null;
  const view = player.game.view();
  drawBoard(target.board, view, paused);
  drawNext(target.next, view);
  target.stats.score.textContent = score(view.score);
  target.stats.lines.textContent = isVersus(match!.kind) && match!.kind === "sprint"
    ? `${view.lines}/${SPRINT_LINES}` : String(view.lines);
  target.stats.level.textContent = String(view.level);
  target.stats.trt.textContent = view.lines ? `${Math.round((400 * view.clears[3]) / view.lines)}%` : "–";
  return view;
}

function drawStatus(you: View | null, bot: View | null): void {
  const m = match!;
  const main = $("status-main");
  const bar = $("lead-bar");
  let lead = 0;
  let scale = 1;
  if (m.kind === "sprint" && you && bot) {
    main.textContent = clock(m.frame);
    lead = you.lines - bot.lines;
    scale = 10;
    main.textContent += `  ·  ${lead === 0 ? "even" : lead > 0 ? `${lead} lines ahead` : `${-lead} lines behind`}`;
  } else if ((m.kind === "blitz" || m.kind === "duel") && you && bot) {
    lead = you.score - bot.score;
    scale = 60_000;
    const time = m.kind === "blitz" ? `${clock(BLITZ_FRAMES - m.frame)} left  ·  ` : "";
    main.textContent = `${time}${lead === 0 ? "even" : lead > 0 ? `${score(lead)} ahead` : `${score(-lead)} behind`}`;
  } else {
    main.textContent = clock(m.frame);
  }
  const share = Math.tanh(lead / scale);
  bar.style.width = `${Math.abs(share) * 50}%`;
  bar.style.left = share >= 0 ? "50%" : `${50 - Math.abs(share) * 50}%`;
  bar.className = share >= 0 ? "ahead" : "behind";
  bar.parentElement!.hidden = !(you && bot);

  if (panels.you && m.you) {
    const frame = m.frame;
    let text = "";
    if (frame < FIRST_PIECE_DELAY && m.kind !== "watch") text = String(Math.ceil((FIRST_PIECE_DELAY - frame) / 32));
    else if (frame < FIRST_PIECE_DELAY + 30 && m.kind !== "watch") text = "GO!";
    if (m.you.out) text = "TOPPED OUT";
    panels.you.overlay.textContent = text;
    panels.you.overlay.className = `board-overlay ${text ? "show" : ""}`;
  }
  if (panels.bot && m.bot) {
    panels.bot.overlay.textContent = m.bot.out ? (m.bot.game.over ? "TOPPED OUT" : "LINE CAP") : "";
    panels.bot.overlay.className = `board-overlay ${m.bot.out ? "show" : ""}`;
  }
  // Once you are out, the bot plays on fast until the result is decided.
  const finishing = m.botOnly && m.kind !== "watch" && m.kind !== "solo";
  const overlay = $("overlay");
  if (finishing && overlay.hidden) {
    overlay.hidden = false;
    overlay.innerHTML = `<div class="card slim"><p>${botById(setup!.bot).name} is still playing…</p></div>`;
    overlay.firstElementChild!.append(button("Skip to result", true, () => m.finish()));
  }
}

function showResult(): void {
  const m = match!;
  const s = setup!;
  shown = true;
  const result = m.result!;
  const you = m.you?.game.view();
  const bot = m.bot?.game.view();
  const bot_ = s.kind === "solo" ? null : botById(s.bot);
  const sprint = m.kind === "sprint";
  const best = !you ? null : sprint ? m.you!.sprintFrame || null : you.score;
  let improved = false;
  if (m.kind !== "watch") {
    improved = saveRecord(recordKey(m.kind, s.level, s.kind === "solo" ? null : s.bot), result.winner, best, sprint);
    const daily = dailySetup();
    if (daily.kind === s.kind && daily.level === s.level && daily.bot === s.bot && daily.seed === s.seed) {
      saveRecord(`daily/${Math.floor(Date.now() / 86_400_000)}`, result.winner, best, sprint);
    }
  }
  const title = result.winner === "you" ? "You win!" : result.winner === "bot" ? `${bot_!.name} wins`
    : result.winner === "tie" ? "Tie!" : m.kind === "watch" ? `${bot_!.name}'s game` : "Game over";
  if (result.winner === "you") sfx.win();

  const rows: [string, (view: View, side: Side) => string][] = [
    ["Score", (view) => score(view.score)],
    ["Lines", (view) => String(view.lines)],
    ["Level", (view) => String(view.level)],
    ["Tetrises", (_, side) => String(side.tetrises)],
  ];
  if (sprint) rows.unshift([`Time to ${SPRINT_LINES}`, (_, side) => (side.sprintFrame ? clock(side.sprintFrame) : "—")]);
  const columns: [string, View, Side][] = [];
  if (you) columns.push(["You", you, m.you!]);
  if (bot) columns.push([bot_!.name, bot, m.bot!]);
  const table = `<table><tr><th></th>${columns.map(([name]) => `<th>${name}</th>`).join("")}</tr>${rows
    .map(([label, cell]) => `<tr><td>${label}</td>${columns.map(([, view, side]) => `<td>${cell(view, side)}</td>`).join("")}</tr>`)
    .join("")}</table>`;

  const overlay = $("overlay");
  overlay.hidden = false;
  overlay.innerHTML = `<div class="card result ${result.winner ?? ""}">
    <h2>${title}</h2><p>${result.reason}</p>${table}
    ${improved ? `<p class="best">New personal best!</p>` : ""}<div class="buttons"></div></div>`;
  const buttons = overlay.querySelector(".buttons")!;
  if (m.kind === "watch") {
    buttons.append(button("Watch another", true, () => void start({ ...s, seed: randomSeed() })));
  } else {
    buttons.append(button("Rematch (same pieces)", true, () => void start({ ...s })));
    buttons.append(button("New game", false, () => void start({ ...s, seed: s.kind === "solo" ? s.seed + 1 : randomSeed() })));
    const rank = bots.bots.findIndex((b) => b.id === s.bot);
    if (result.winner === "you" && rank >= 0 && rank + 1 < bots.bots.length) {
      const nextBot = bots.bots[rank + 1];
      buttons.append(button(`Next: ${nextBot.name} →`, false, () => {
        choice.bot = nextBot.id;
        void start({ ...s, bot: nextBot.id, seed: randomSeed() });
      }));
    }
    if (isVersus(s.kind) && you) {
      const brag = sprint && m.you!.sprintFrame ? `${clock(m.you!.sprintFrame)} to ${SPRINT_LINES}` : `${score(you.score)} points`;
      const text = `${result.winner === "you" ? "I beat" : "I lost to"} ${bot_!.name} with ${brag}`;
      buttons.append(button("Copy challenge link", false, async () => {
        const url = `${location.origin}${location.pathname}#c=${s.kind}.${s.level}.${s.bot}.${s.seed}.${encodeURIComponent(text)}`;
        await navigator.clipboard?.writeText(url).catch(() => undefined);
        pop(panels.you, "LINK COPIED", "level");
      }));
    }
  }
  buttons.append(button("Menu", false, toMenu));
}

function frame(now: number): void {
  requestAnimationFrame(frame);
  const elapsed = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;
  if (!match) return;
  if (!paused && !match.result) {
    const speed = match.kind === "watch" ? WATCH_SPEEDS[watchSpeed] : match.botOnly ? 6 : 1;
    accumulator += elapsed * FPS * speed;
    const steps = Math.floor(accumulator);
    accumulator -= steps;
    const input = held();
    for (let i = 0; i < steps && !match.result; i++) match.step(input);
    react(match.you, panels.you, true);
    react(match.bot, panels.bot, false);
  }
  const you = drawPanel(panels.you, match.you);
  const bot = drawPanel(panels.bot, match.bot);
  drawStatus(you, bot);
  if (match.result && !shown) showResult();
}

// ------------------------------------------------------------------ wiring

function wire(): void {
  $("start").addEventListener("click", () => {
    const versus = isVersus(choice.kind);
    void start({
      kind: choice.kind,
      level: versus ? choice.level : choice.soloLevel,
      bot: choice.bot,
      seed: versus ? randomSeed() : 1 + Math.floor(Math.random() * 65535),
    });
  });
  $("watch").addEventListener("click", () =>
    void start({ kind: "watch", level: choice.level, bot: choice.bot, seed: randomSeed() }));
  $("daily").addEventListener("click", () => void start(dailySetup()));
  $("quit").addEventListener("click", toMenu);
  $("pause").addEventListener("click", () => setPaused(!paused));
  $("speed").addEventListener("click", () => {
    watchSpeed = (watchSpeed + 1) % WATCH_SPEEDS.length;
    $("speed").textContent = `${WATCH_SPEEDS[watchSpeed]}×`;
  });
  const mute = $("mute");
  const showMute = () => { mute.textContent = isMuted() ? "🔇" : "🔊"; };
  mute.addEventListener("click", () => { setMuted(!isMuted()); showMute(); });
  showMute();
  addEventListener("keydown", (event) => {
    unlockAudio();
    if (!match || $("arena").hidden) return;
    if (event.code === "KeyP" || event.code === "Escape" || event.code === "Enter") {
      if (match.result) return;
      setPaused(!paused);
      event.preventDefault();
    }
  });
  addEventListener("pointerdown", unlockAudio);
  document.addEventListener("visibilitychange", () => { if (document.hidden) setPaused(true); });
  bindTouch($("touch"));
  if (matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0) {
    document.body.classList.add("touch-device");
  }
}

async function main(): Promise<void> {
  bots = await loadBots();
  wire();
  readChallengeLink();
  renderMenu();
  requestAnimationFrame((now) => { lastTime = now; frame(now); });
}

void main();
