// The recorded bot games in public/bots (tools/make_bots.py, tools/verify-bots.ts).

export interface Bot {
  id: string;
  name: string;
  blurb: string;
  tap_hz: number;
  reaction_ms: number;
  typical: Record<string, { score: number; lines: number }>;
}

export interface BotStats {
  sprintFrames: number;
  sprintFinishPct: number;
  blitzScore: number;
}

export interface BotIndex {
  engine: string;
  fallgorithm: string;
  levels: number[];
  seeds: number[];
  bots: Bot[];
  stats: Record<string, BotStats>; // keyed "<level>/<bot id>"
}

const base = `${import.meta.env.BASE_URL}bots/`;

export async function loadBots(): Promise<BotIndex> {
  const [index, stats] = await Promise.all([
    fetch(`${base}index.json`).then((response) => response.json()),
    fetch(`${base}stats.json`).then((response) => response.json()),
  ]);
  return { ...index, stats };
}

/** One bot game's controller input, one byte per frame. */
export async function loadBotGame(level: number, bot: string, seed: number): Promise<Uint8Array> {
  const response = await fetch(`${base}${level}/${bot}/${seed}.bin`);
  if (!response.ok || !response.body) throw new Error(`bot game ${level}/${bot}/${seed}: ${response.status}`);
  const stream = response.body.pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
