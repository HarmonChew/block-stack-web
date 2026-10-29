// Pixel icons drawn as SVG from little bitmaps ('#' is a pixel), in currentColor.

function pixels(rows: string[]): string {
  const width = Math.max(...rows.map((row) => row.length));
  let rects = "";
  rows.forEach((row, y) => {
    for (const run of row.matchAll(/#+/g)) {
      rects += `<rect x="${run.index}" y="${y}" width="${run[0].length}" height="1"/>`;
    }
  });
  return `<svg class="px-icon" viewBox="0 0 ${width} ${rows.length}" width="${width}" height="${rows.length}"
    fill="currentColor" shape-rendering="crispEdges" aria-hidden="true">${rects}</svg>`;
}

export const ICONS = {
  cursor: pixels([
    "#....",
    "##...",
    "###..",
    "####.",
    "###..",
    "##...",
    "#....",
  ]),
  back: pixels([
    "...#...",
    "..##...",
    ".######",
    "#######",
    ".######",
    "..##...",
    "...#...",
  ]),
  left: pixels([
    "...#",
    "..##",
    ".###",
    "####",
    ".###",
    "..##",
    "...#",
  ]),
  right: pixels([
    "#...",
    "##..",
    "###.",
    "####",
    "###.",
    "##..",
    "#...",
  ]),
  down: pixels([
    "#######",
    ".#####.",
    "..###..",
    "...#...",
  ]),
  pause: pixels([
    "##.##",
    "##.##",
    "##.##",
    "##.##",
    "##.##",
    "##.##",
    "##.##",
  ]),
  play: pixels([
    "#....",
    "##...",
    "###..",
    "####.",
    "###..",
    "##...",
    "#....",
  ]),
  soundOn: pixels([
    "...#.....",
    "..##..#..",
    "####...#.",
    "####.#.#.",
    "####...#.",
    "..##..#..",
    "...#.....",
  ]),
  soundOff: pixels([
    "...#.....",
    "..##.....",
    "####.#.#.",
    "####..#..",
    "####.#.#.",
    "..##.....",
    "...#.....",
  ]),
  star: pixels([
    "...#...",
    "..###..",
    "#######",
    ".#####.",
    "..###..",
    ".##.##.",
    "##...##",
  ]),
};
