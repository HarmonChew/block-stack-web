// Personal records, kept in this browser's localStorage.
import type { Kind, Winner } from "./match.ts";

export interface Record {
  plays: number;
  wins: number;
  best: number; // sprint: fewest frames to 40 lines; other modes: highest score
}

const KEY = "bsa.records.v1";
const records: { [key: string]: Record } = JSON.parse(localStorage.getItem(KEY) ?? "{}");

export function recordKey(kind: Kind, level: number, bot: string | null): string {
  return kind === "solo" ? `solo/${level}` : `${kind}/${level}/${bot}`;
}

export function getRecord(key: string): Record | undefined {
  return records[key];
}

/** Saves one finished game; returns true when it beat an earlier best. */
export function saveRecord(key: string, winner: Winner | null, best: number | null, lowerIsBetter: boolean): boolean {
  const entry = (records[key] ??= { plays: 0, wins: 0, best: 0 });
  entry.plays++;
  if (winner === "you") entry.wins++;
  const better = best !== null && best > 0 &&
    (entry.best === 0 || (lowerIsBetter ? best < entry.best : best > entry.best));
  const improved = better && entry.best > 0;
  if (better) entry.best = best!;
  localStorage.setItem(KEY, JSON.stringify(records));
  return improved;
}
