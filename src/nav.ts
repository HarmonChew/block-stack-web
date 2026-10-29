// Console-style menus: arrows (or the d-pad) move a cursor between [data-nav]
// controls, Enter / X / A choose, Esc / Z / B go back. Hovering moves the cursor too.
import { sfx } from "./sound.ts";

let scope: () => HTMLElement | null = () => null;
let back: () => void = () => undefined;
let padStart: () => void = () => undefined;
let guardUntil = 0;

/** Tells the menus which element holds the current options, what Back does, and what
 * the gamepad's Start does when no menu is open (pause, in a match). */
export function setNavScope(current: () => HTMLElement | null, onBack: () => void, onPadStart: () => void): void {
  scope = current;
  back = onBack;
  padStart = onPadStart;
}

/** Ignores choose and back for a moment, so a key still held from play cannot pick an
 * option on a menu that just opened. */
export function guardMenu(ms = 400): void {
  guardUntil = performance.now() + ms;
}
const guarded = () => performance.now() < guardUntil;

function options(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>("[data-nav]")]
    .filter((element) => !element.closest("[hidden]") && !(element as HTMLButtonElement).disabled);
}

/** Puts the cursor on an element (or the first option) of the current scope. */
export function setCursor(target: HTMLElement | null, quiet = true): void {
  const root = scope();
  if (!root) return;
  const element = target ?? root.querySelector<HTMLElement>("[data-nav].cur") ?? options(root)[0];
  if (!element) return;
  if (!quiet && !element.classList.contains("cur")) sfx.menuMove();
  for (const other of root.querySelectorAll(".cur")) if (other !== element) other.classList.remove("cur");
  element.classList.add("cur");
  if (document.activeElement !== element) element.focus({ preventScroll: true });
  element.scrollIntoView({ block: "nearest" });
}

/** Moves the cursor to the nearest option in a direction (spatial navigation). */
function move(dx: number, dy: number): void {
  const root = scope();
  if (!root) return;
  const all = options(root);
  const current = all.find((element) => element.classList.contains("cur")) ?? all[0];
  if (!current) return;
  const from = current.getBoundingClientRect();
  const cx = from.left + from.width / 2;
  const cy = from.top + from.height / 2;
  let best: HTMLElement | null = null;
  let bestScore = Infinity;
  for (const element of all) {
    if (element === current) continue;
    const box = element.getBoundingClientRect();
    const ex = box.left + box.width / 2;
    const ey = box.top + box.height / 2;
    const along = (ex - cx) * dx + (ey - cy) * dy;
    if (along <= 4) continue;
    const across = Math.abs((ex - cx) * dy) + Math.abs((ey - cy) * dx);
    const score = along + across * 2.5;
    if (score < bestScore) {
      bestScore = score;
      best = element;
    }
  }
  if (best) setCursor(best, false);
}

const DIRECTIONS: Record<string, [number, number]> = {
  ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
};

function choose(): void {
  touchedFresh = null;
  scope()?.querySelector<HTMLElement>("[data-nav].cur")?.click();
}

const CHOOSE = new Set(["KeyX", "Enter", "Space"]);
const BACK = new Set(["Escape", "KeyZ", "Backspace"]);

addEventListener("keydown", (event) => {
  const root = scope();
  if (!root || event.altKey || event.ctrlKey || event.metaKey) return;
  touchedFresh = null;
  const direction = DIRECTIONS[event.code];
  if (direction) {
    move(...direction);
    event.preventDefault();
    return;
  }
  if (!CHOOSE.has(event.code) && !BACK.has(event.code)) return;
  // Enter or Space on a button outside the menu (Back, Sound, the HUD) presses that button.
  if ((event.code === "Enter" || event.code === "Space") && event.target instanceof HTMLButtonElement &&
      !event.target.matches("[data-nav]")) return;
  // Only arrows repeat; a held key or one carried over from play picks nothing.
  event.preventDefault();
  if (event.repeat || guarded()) return;
  if (CHOOSE.has(event.code)) choose();
  else back();
});

// On touch there is no hover, so options marked data-confirm take two taps: the first
// moves the cursor there (and shows what it is), the second chooses it.
let touchedFresh: HTMLElement | null = null;
addEventListener("pointerdown", (event) => {
  const element = (event.target as HTMLElement).closest?.<HTMLElement>("[data-nav][data-confirm]");
  touchedFresh = element && event.pointerType !== "mouse" && !element.classList.contains("cur") ? element : null;
}, true);
addEventListener("pointercancel", () => { touchedFresh = null; }, true);
addEventListener("click", (event) => {
  const element = (event.target as HTMLElement).closest?.<HTMLElement>("[data-nav][data-confirm]");
  if (!element || element !== touchedFresh) return;
  touchedFresh = null;
  event.stopImmediatePropagation();
  event.preventDefault();
  setCursor(element, false);
}, true);

addEventListener("pointerover", (event) => {
  const element = (event.target as HTMLElement).closest?.<HTMLElement>("[data-nav]");
  if (element && event.pointerType === "mouse" && scope()?.contains(element)) setCursor(element);
});
addEventListener("focusin", (event) => {
  const element = (event.target as HTMLElement).closest?.<HTMLElement>("[data-nav]");
  if (element && scope()?.contains(element) && !element.classList.contains("cur")) setCursor(element);
});

// Gamepad menus, edge-triggered: d-pad or stick to move, A (right face) or Start to
// choose, B (bottom face) to go back, matching the in-game NES mapping. The held set
// is tracked during play too, so a button held when a menu opens is not a new press.
let padHeld = new Set<string>();
export function pollMenuPad(): void {
  const now = new Set<string>();
  for (const pad of navigator.getGamepads?.() ?? []) {
    if (!pad) continue;
    const down = (index: number) => pad.buttons[index]?.pressed ?? false;
    const [x = 0, y = 0] = pad.axes;
    if (down(12) || y < -0.6) now.add("ArrowUp");
    if (down(13) || y > 0.6) now.add("ArrowDown");
    if (down(14) || x < -0.6) now.add("ArrowLeft");
    if (down(15) || x > 0.6) now.add("ArrowRight");
    if (down(1)) now.add("choose");
    if (down(9)) now.add("start");
    if (down(0)) now.add("back");
  }
  const fresh = [...now].filter((key) => !padHeld.has(key));
  padHeld = now;
  if (!scope()) {
    if (fresh.includes("start")) padStart();
    return;
  }
  for (const key of fresh) {
    if (key === "choose" || key === "start") {
      if (!guarded()) choose();
    } else if (key === "back") {
      if (!guarded()) back();
    } else move(...DIRECTIONS[key]);
  }
}
