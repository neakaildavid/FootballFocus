import { MOCK_PLAYERS } from "./players";

export interface LeaderRow {
  playerId: string;
  value: number;
  zScore: number; // recent-window rate vs. baseline; see lib/trend.ts
}

export type StatCategory =
  | "recYards"
  | "receptions"
  | "rushYards"
  | "rushTDs"
  | "recTDs"
  | "totalTDs"
  | "passYards"
  | "passTDs"
  | "fantasyPPR";

export const STAT_CATEGORIES: { key: StatCategory; label: string }[] = [
  { key: "passYards", label: "Passing Yards" },
  { key: "passTDs", label: "Passing TDs" },
  { key: "recYards", label: "Receiving Yards" },
  { key: "receptions", label: "Receptions" },
  { key: "rushYards", label: "Rushing Yards" },
  { key: "rushTDs", label: "Rushing TDs" },
  { key: "recTDs", label: "Receiving TDs" },
  { key: "totalTDs", label: "Total TDs" },
  { key: "fantasyPPR", label: "Fantasy Points (PPR)" },
];

export type TimeRange = "full" | "last5" | "last3";
export const TIME_RANGES: { key: TimeRange; label: string }[] = [
  { key: "full", label: "Full Season" },
  { key: "last5", label: "Last 5 Weeks" },
  { key: "last3", label: "Last 3 Weeks" },
];

// Deterministic placeholder numbers, just enough spread to exercise sorting
// and the trend-arrow threshold. Replaced by real weekly-stat aggregation
// once the pipeline (build-order step 3) is wired in.
export function mockLeaderboard(category: StatCategory, range: TimeRange): LeaderRow[] {
  const seedShift: Record<TimeRange, number> = { full: 0, last5: 1, last3: 2 };
  return MOCK_PLAYERS.map((p, i) => {
    const base = 1400 - i * 97 + seedShift[range] * 23;
    const z = ((i % 5) - 2) * 0.9 + (seedShift[range] === 2 ? 0.6 : 0);
    return { playerId: p.id, value: Math.max(base, 40), zScore: Number(z.toFixed(2)) };
  }).sort((a, b) => b.value - a.value);
}
