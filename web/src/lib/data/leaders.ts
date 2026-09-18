import { query } from "@/lib/db";
import { computeTrendFromSeries, TrendResult } from "@/lib/trend";

export type StatCategory =
  | "passYards"
  | "passTDs"
  | "recYards"
  | "receptions"
  | "rushYards"
  | "rushTDs"
  | "recTDs"
  | "totalTDs"
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

const RANGE_WEEKS: Record<TimeRange, number | null> = { full: null, last5: 5, last3: 3 };

export interface LeaderRow {
  playerId: string;
  playerName: string;
  position: string;
  teamId: string;
  value: number;
  trend: TrendResult;
}

interface StatRow {
  player_id: string;
  full_name: string;
  position: string;
  team_id: string;
  week: number;
  value: string; // numeric columns come back as strings from pg
}

function valueExprFor(category: StatCategory): string {
  switch (category) {
    case "passYards":
      return "pass_yards";
    case "passTDs":
      return "pass_tds";
    case "recYards":
      return "rec_yards";
    case "receptions":
      return "receptions";
    case "rushYards":
      return "rush_yards";
    case "rushTDs":
      return "rush_tds";
    case "recTDs":
      return "rec_tds";
    case "totalTDs":
      return "(pass_tds + rush_tds + rec_tds)";
    case "fantasyPPR":
      return "fantasy_points_ppr";
  }
}

export async function getLeaderboard(
  season: number,
  category: StatCategory,
  range: TimeRange,
  limit = 25
): Promise<LeaderRow[]> {
  const valueExpr = valueExprFor(category);

  // Pull every game for the season for players who touch this stat at all,
  // then aggregate + compute trend in JS — a season is ~5-6k rows, cheap to
  // process in-process and much simpler than window functions for the
  // recent-vs-baseline trend math (see lib/trend.ts).
  const rows = await query<StatRow>(
    `
    SELECT pws.player_id, p.full_name, p.position, pws.team_id, pws.week,
           ${valueExpr}::numeric AS value
    FROM player_weekly_stats pws
    JOIN players p ON p.id = pws.player_id
    WHERE pws.season = $1 AND pws.season_type = 'REG'
    ORDER BY pws.player_id, pws.week ASC
    `,
    [season]
  );

  const byPlayer = new Map<string, { name: string; position: string; games: StatRow[] }>();
  for (const row of rows) {
    const entry = byPlayer.get(row.player_id);
    if (entry) {
      entry.games.push(row);
    } else {
      byPlayer.set(row.player_id, { name: row.full_name, position: row.position, games: [row] });
    }
  }

  const windowWeeks = RANGE_WEEKS[range];
  const results: LeaderRow[] = [];
  for (const [playerId, { name, position, games }] of byPlayer) {
    // Rows are ordered by week ASC, so the last game's team reflects a
    // mid-season trade correctly (a player's most recent team), rather
    // than whichever team they started the season with.
    const teamId = games[games.length - 1].team_id;
    const allValues = games.map((g) => Number(g.value));
    const windowed = windowWeeks ? games.slice(-windowWeeks) : games;
    const value = windowed.reduce((a, g) => a + Number(g.value), 0);
    if (value === 0) continue;

    // Trend always reflects the season's full recent-vs-baseline shape,
    // independent of which time-range filter is selected — the filter
    // changes the total shown, not the definition of "trending".
    const trend = computeTrendFromSeries(allValues, 3);

    results.push({ playerId, playerName: name, position, teamId, value, trend });
  }

  results.sort((a, b) => b.value - a.value);
  return results.slice(0, limit);
}
