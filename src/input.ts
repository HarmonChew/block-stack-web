// Keyboard, gamepad and touch buttons, merged into the engine's per-frame bitmask.
// The engine does DAS itself, so this only reports which buttons are held.
import { DOWN, LEFT, RIGHT, ROTATE_CCW, ROTATE_CW } from "./engine.ts";

const KEYS: Record<string, number> = {
  ArrowLeft: LEFT, KeyA: LEFT,
  ArrowRight: RIGHT, KeyD: RIGHT,
  ArrowDown: DOWN, KeyS: DOWN,
  KeyX: ROTATE_CW, ArrowUp: ROTATE_CW, KeyK: ROTATE_CW,
  KeyZ: ROTATE_CCW, KeyJ: ROTATE_CCW,
};

let keys = 0;
let touch = 0;

addEventListener("keydown", (event) => {
  const bit = KEYS[event.code];
  if (bit === undefined) return;
  keys |= bit;
  event.preventDefault();
});
addEventListener("keyup", (event) => {
  const bit = KEYS[event.code];
  if (bit !== undefined) keys &= ~bit;
});
addEventListener("blur", () => {
  keys = 0;
  touch = 0;
});

// Standard gamepad mapping: d-pad 12-15; NES A (rotate right) on the right face
// button, NES B (rotate left) on the bottom one. The left stick works too.
function gamepad(): number {
  let bits = 0;
  for (const pad of navigator.getGamepads?.() ?? []) {
    if (!pad) continue;
    const down = (index: number) => pad.buttons[index]?.pressed ?? false;
    const [x = 0, y = 0] = pad.axes;
    if (down(14) || x < -0.5) bits |= LEFT;
    if (down(15) || x > 0.5) bits |= RIGHT;
    if (down(13) || y > 0.5) bits |= DOWN;
    if (down(1) || down(3)) bits |= ROTATE_CW;
    if (down(0) || down(2)) bits |= ROTATE_CCW;
  }
  return bits;
}

let suppressed = 0;

/** Ignores the buttons held right now until each is released (after resuming, say). */
export function suppressHeld(): void {
  suppressed = keys | touch | gamepad();
}

/** The buttons held right now. */
export function held(): number {
  let bits = keys | touch | gamepad();
  suppressed &= bits;
  bits &= ~suppressed;
  if ((bits & (LEFT | RIGHT)) === (LEFT | RIGHT)) bits &= ~(LEFT | RIGHT);
  return bits;
}

/** Wires on-screen buttons with a data-button attribute (left, right, down, cw, ccw). */
export function bindTouch(root: HTMLElement): void {
  const bits: Record<string, number> = { left: LEFT, right: RIGHT, down: DOWN, cw: ROTATE_CW, ccw: ROTATE_CCW };
  for (const button of root.querySelectorAll<HTMLElement>("[data-button]")) {
    const bit = bits[button.dataset.button!];
    const release = () => { touch &= ~bit; button.classList.remove("held"); };
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      touch |= bit;
      button.classList.add("held");
    });
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("contextmenu", (event) => event.preventDefault());
  }
}
