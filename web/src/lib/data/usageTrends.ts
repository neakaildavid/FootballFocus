import { query } from "@/lib/db";
import { computeTrendFromSeries, TrendResult } from "@/lib/trend";

export type UsageMetric = "offense_snap_pct" | "target_share" | "carry_share";

export const USAGE_METRICS: { key: UsageMetric; label: string }[] = [
  { key: "offense_snap_pct", label: "Offensive Snap Share" },
  { key: "target_share", label: "Target Share" },
  { key: "carry_share", label: "Carry Share" },
];

export interface UsageMoverRow {
  playerId: string;
  playerName: string;
  position: string;
  teamId: string;
  recentAvg: number;
  baselineAvg: number;
  trend: TrendResult;
}

interface RawRow {
  playerId: string;
  playerName: string;
  position: string;
  teamId: string;
  week: number;
  value: string | null;
}

/**
 * Players trending up or down in a given usage metric this season, using
 * the same recent-3-vs-baseline z-score contract as Season Leaders
 * (lib/trend.ts's computeTrendFromSeries) — usage often moves before
 * counting stats do, which is the whole point of tracking it separately.
 */
export async function getUsageMovers(
  season: number,
  metric: UsageMetric,
  minGames = 5
): Promise<{ risers: UsageMoverRow[]; fallers: UsageMoverRow[] }> {
  const rows = await query<RawRow>(
    `
    SELECT pws.player_id AS "playerId", p.full_name AS "playerName", p.position,
           pws.team_id AS "teamId", pws.week, ${metric}::text AS value
    FROM player_weekly_stats pws
    JOIN players p ON p.id = pws.player_id
    WHERE pws.season = $1 AND pws.season_type = 'REG' AND ${metric} IS NOT NULL
    ORDER BY pws.player_id, pws.week ASC
    `,
    [season]
  );

  const byPlayer = new Map<string, { name: string; position: string; teamId: string; games: RawRow[] }>();
  for (const row of rows) {
    const entry = byPlayer.get(row.playerId);
    if (entry) {
      entry.games.push(row);
    } else {
      byPlayer.set(row.playerId, { name: row.playerName, position: row.position, teamId: row.teamId, games: [row] });
    }
  }

  const movers: UsageMoverRow[] = [];
  for (const [playerId, { name, position, games }] of byPlayer) {
    if (games.length < minGames) continue;
    const values = games.map((g) => Number(g.value));
    const trend = computeTrendFromSeries(values, 3);
    if (trend.direction === "none") continue;

    const recent = values.slice(-3);
    const baseline = values.slice(0, values.length - 3);
    movers.push({
      playerId,
      playerName: name,
      position,
      teamId: games[games.length - 1].teamId,
      recentAvg: recent.reduce((a, b) => a + b, 0) / recent.length,
      baselineAvg: baseline.reduce((a, b) => a + b, 0) / baseline.length,
      trend,
    });
  }

  const risers = movers.filter((m) => m.trend.direction === "up").sort((a, b) => b.trend.zScore - a.trend.zScore);
  const fallers = movers.filter((m) => m.trend.direction === "down").sort((a, b) => a.trend.zScore - b.trend.zScore);
  return { risers, fallers };
}
