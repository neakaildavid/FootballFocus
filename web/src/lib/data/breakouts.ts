import { query } from "@/lib/db";
import { computeTrendFromSeries, TrendResult } from "@/lib/trend";

export interface BreakoutRow {
  playerId: string;
  playerName: string;
  position: string;
  teamId: string;
  rookieSeason: number;
  recentAvgPpr: number;
  baselineAvgPpr: number;
  trend: TrendResult;
}

interface RawRow {
  playerId: string;
  playerName: string;
  position: string;
  teamId: string;
  rookieSeason: number;
  week: number;
  fantasyPointsPpr: string | null;
}

/**
 * Rookies and second-year players whose fantasy production (a blend of
 * opportunity and results — the standard "is this guy breaking out"
 * signal) is trending significantly above their own season baseline.
 * Same trend contract as Season Leaders / Usage Trends
 * (lib/trend.ts's computeTrendFromSeries), applied to a filtered
 * rookie/sophomore player pool instead of the whole league.
 */
export async function getBreakoutCandidates(season: number, minGames = 5): Promise<BreakoutRow[]> {
  const rows = await query<RawRow>(
    `
    SELECT pws.player_id AS "playerId", p.full_name AS "playerName", p.position,
           pws.team_id AS "teamId", p.rookie_season AS "rookieSeason", pws.week,
           pws.fantasy_points_ppr::text AS "fantasyPointsPpr"
    FROM player_weekly_stats pws
    JOIN players p ON p.id = pws.player_id
    WHERE pws.season = $1 AND pws.season_type = 'REG'
      AND p.rookie_season IN ($1, $1 - 1)
    ORDER BY pws.player_id, pws.week ASC
    `,
    [season]
  );

  const byPlayer = new Map<
    string,
    { name: string; position: string; teamId: string; rookieSeason: number; games: RawRow[] }
  >();
  for (const row of rows) {
    const entry = byPlayer.get(row.playerId);
    if (entry) {
      entry.games.push(row);
    } else {
      byPlayer.set(row.playerId, {
        name: row.playerName,
        position: row.position,
        teamId: row.teamId,
        rookieSeason: row.rookieSeason,
        games: [row],
      });
    }
  }

  const candidates: BreakoutRow[] = [];
  for (const [playerId, { name, position, rookieSeason, games }] of byPlayer) {
    if (games.length < minGames) continue;
    const values = games.map((g) => Number(g.fantasyPointsPpr ?? 0));
    const trend = computeTrendFromSeries(values, 3);
    if (trend.direction !== "up") continue;

    const recent = values.slice(-3);
    const baseline = values.slice(0, values.length - 3);
    candidates.push({
      playerId,
      playerName: name,
      position,
      teamId: games[games.length - 1].teamId,
      rookieSeason,
      recentAvgPpr: recent.reduce((a, b) => a + b, 0) / recent.length,
      baselineAvgPpr: baseline.reduce((a, b) => a + b, 0) / baseline.length,
      trend,
    });
  }

  return candidates.sort((a, b) => b.trend.zScore - a.trend.zScore);
}
