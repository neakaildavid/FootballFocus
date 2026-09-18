import { query, queryOne } from "@/lib/db";
import { computeTrendFromSeries, TrendResult } from "@/lib/trend";

export interface PlayerProfile {
  id: string;
  fullName: string;
  position: string;
  teamId: string | null;
  college: string | null;
  draftYear: number | null;
  draftRound: number | null;
  draftPick: number | null;
  rookieSeason: number | null;
}

export async function getPlayerProfile(playerId: string): Promise<PlayerProfile | null> {
  return queryOne<PlayerProfile>(
    `
    SELECT id, full_name AS "fullName", position, current_team_id AS "teamId",
           college, draft_year AS "draftYear", draft_round AS "draftRound",
           draft_pick AS "draftPick", rookie_season AS "rookieSeason"
    FROM players
    WHERE id = $1
    `,
    [playerId]
  );
}

export interface PlayerGameRow {
  season: number;
  week: number;
  opponentTeamId: string;
  passAttempts: number;
  completions: number;
  passYards: number;
  passTDs: number;
  interceptions: number;
  carries: number;
  rushYards: number;
  rushTDs: number;
  targets: number;
  receptions: number;
  recYards: number;
  recTDs: number;
  fantasyPointsPpr: number;
  offenseSnapPct: number | null;
  targetShare: number | null;
  carryShare: number | null;
}

async function getGameLogAllSeasons(playerId: string): Promise<PlayerGameRow[]> {
  return query<PlayerGameRow>(
    `
    SELECT season, week, opponent_team_id AS "opponentTeamId",
           pass_attempts AS "passAttempts", completions, pass_yards AS "passYards",
           pass_tds AS "passTDs", interceptions,
           carries, rush_yards AS "rushYards", rush_tds AS "rushTDs",
           targets, receptions, rec_yards AS "recYards", rec_tds AS "recTDs",
           fantasy_points_ppr::numeric AS "fantasyPointsPpr",
           offense_snap_pct::numeric AS "offenseSnapPct",
           target_share::numeric AS "targetShare",
           carry_share::numeric AS "carryShare"
    FROM player_weekly_stats
    WHERE player_id = $1 AND season_type = 'REG'
    ORDER BY season ASC, week ASC
    `,
    [playerId]
  );
}

const PRIMARY_STAT: Record<string, keyof PlayerGameRow> = {
  QB: "passYards",
  RB: "rushYards",
  WR: "recYards",
  TE: "recYards",
  FB: "rushYards",
};

export interface PlayerPageData {
  gameLog: PlayerGameRow[];
  season: number | null;
  seasonTotals: Record<string, number> | null;
  trend: TrendResult | null;
  primaryStatLabel: string | null;
}

const STAT_LABELS: Record<string, string> = {
  passYards: "Passing Yards",
  rushYards: "Rushing Yards",
  recYards: "Receiving Yards",
};

export async function getPlayerPageData(playerId: string, position: string): Promise<PlayerPageData> {
  const allGames = await getGameLogAllSeasons(playerId);
  if (allGames.length === 0) {
    return { gameLog: [], season: null, seasonTotals: null, trend: null, primaryStatLabel: null };
  }

  const season = allGames[allGames.length - 1].season;
  const gameLog = allGames.filter((g) => g.season === season);

  const seasonTotals: Record<string, number> = {};
  for (const g of gameLog) {
    for (const key of [
      "passYards", "passTDs", "interceptions", "completions", "passAttempts",
      "rushYards", "rushTDs", "carries",
      "recYards", "recTDs", "receptions", "targets",
      "fantasyPointsPpr",
    ] as const) {
      seasonTotals[key] = (seasonTotals[key] ?? 0) + Number(g[key] ?? 0);
    }
  }

  const primaryStatKey = PRIMARY_STAT[position];
  let trend: TrendResult | null = null;
  if (primaryStatKey) {
    const series = gameLog.map((g) => Number(g[primaryStatKey] ?? 0));
    trend = computeTrendFromSeries(series, 3);
  }

  return {
    gameLog,
    season,
    seasonTotals,
    trend,
    primaryStatLabel: primaryStatKey ? STAT_LABELS[primaryStatKey] : null,
  };
}

export interface HubGradePoint {
  week: number;
  grade: number;
}

export async function getPlayerHubGradeHistory(playerId: string, season: number): Promise<HubGradePoint[]> {
  const rows = await query<{ week: number; grade: string }>(
    `SELECT week, grade::text AS grade FROM hub_grades WHERE player_id = $1 AND season = $2 ORDER BY week ASC`,
    [playerId, season]
  );
  return rows.map((r) => ({ week: r.week, grade: Number(r.grade) }));
}
