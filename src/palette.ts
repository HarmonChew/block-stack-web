// Level palettes. Like the NES, every level recolours the blocks, cycling every ten
// levels; these ten pairs are our own. Each piece family has one block style.

export interface Palette {
  a: string; // first colour
  b: string; // second colour
  ground: string; // the screen behind the boards, a deep shade of `a`
  deep: string; // a darker `a` that light text passes 4.5:1 on, for filled plates
}

const PAIRS: [string, string][] = [
  ["#3b6cf6", "#f5a524"], // royal blue / amber
  ["#14a76c", "#c3e956"], // jade / lime
  ["#d8366f", "#ffcf5c"], // raspberry / sun
  ["#7646e8", "#3fd8c8"], // violet / aqua
  ["#e8572a", "#f7e26b"], // vermilion / lemon
  ["#0e93a8", "#ff8fb1"], // teal / rose
  ["#b8324b", "#8fc7ff"], // crimson / sky
  ["#3f8f3a", "#ffb072"], // moss / apricot
  ["#4f55e0", "#ff7ac1"], // indigo / pink
  ["#a9762a", "#67e0a3"], // brass / mint
];

function shade(hex: string, amount: number): string {
  const value = parseInt(hex.slice(1), 16);
  const channel = (shift: number) => Math.round(((value >> shift) & 255) * amount + 6);
  return `rgb(${channel(16)} ${channel(8)} ${channel(0)})`;
}

export const PALETTES: Palette[] = PAIRS.map(([a, b]) => ({ a, b, ground: shade(a, 0.13), deep: shade(a, 0.66) }));

export function palette(level: number): Palette {
  return PALETTES[((level % 10) + 10) % 10];
}

export const WHITE = "#f7f4ea";
export const DEAD = "#545a6b";

// Block styles: 0 white core in colour a, 1 solid a, 2 solid b.
// Piece order is the engine's: I J L O S T Z. I, O and T share the white core;
// the mirror pairs share a colour (J and L in a, S and Z in b).
const STYLE_BY_PIECE = [0, 1, 1, 0, 2, 0, 2];

export function blockStyle(piece: number): number {
  return STYLE_BY_PIECE[piece] ?? 1;
}

/** A 9x9 pixel frame for CSS border-image: colour a, white, colour a, then a dark fill. */
function frameImage(colours: Palette): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='9' height='9' viewBox='0 0 9 9' shape-rendering='crispEdges'>` +
    `<path fill='${colours.a}' d='M1 0h7v1H1zM0 1h1v7H0zM8 1h1v7H8zM1 8h7v1H1z'/>` +
    `<path fill='${WHITE}' d='M1 1h7v1H1zM1 2h1v5H1zM7 2h1v5H7zM1 7h7v1H1z'/>` +
    `<path fill='${colours.a}' d='M2 2h5v1H2zM2 3h1v3H2zM6 3h1v3H6zM2 6h5v1H2z'/>` +
    `<rect x='3' y='3' width='3' height='3' fill='#05060a' fill-opacity='.92'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/** A 14x14 pixel disc for the touch A/B buttons: rim in colour a, face in colour b. */
function buttonImage(colours: Palette): string {
  const spans = [[4, 9], [2, 11], [1, 12], [1, 12], [0, 13], [0, 13], [0, 13], [0, 13], [0, 13], [0, 13],
                 [1, 12], [1, 12], [2, 11], [4, 9]];
  const inside = (x: number, y: number) => y >= 0 && y < 14 && x >= spans[y][0] && x <= spans[y][1];
  let rects = "";
  spans.forEach(([from, to], y) => {
    for (let x = from; x <= to; x++) {
      const rim = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
      const shine = (x === 3 && (y === 3 || y === 4)) || (x === 4 && y === 3);
      rects += `<rect x='${x}' y='${y}' width='1' height='1' fill='${rim ? colours.a : shine ? WHITE : colours.b}'/>`;
    }
  });
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 14 14' shape-rendering='crispEdges'>${rects}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

const frames = PALETTES.map(frameImage);
const buttons = PALETTES.map(buttonImage);

/** Sets --pa, --pb, --ground and --frame on an element so CSS can follow the level. */
export function applyPalette(element: HTMLElement, level: number): void {
  const index = ((level % 10) + 10) % 10;
  const colours = PALETTES[index];
  element.style.setProperty("--pa", colours.a);
  element.style.setProperty("--pb", colours.b);
  element.style.setProperty("--ground", colours.ground);
  element.style.setProperty("--pd", colours.deep);
  element.style.setProperty("--frame", frames[index]);
  element.style.setProperty("--btn", buttons[index]);
}
