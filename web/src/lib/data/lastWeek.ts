import { query, queryOne } from "@/lib/db";

/**
 * The most recent week that's actually FINISHED — every game in it has
 * status = 'final' — not just the highest week with any stats at all.
 * Without this distinction, mid-week (e.g. after Thursday Night Football
 * but before Sunday's games) this would show a "Last Week" that's really
 * the *current*, still-in-progress week, mixing finished and not-yet-played
 * games under a "final results" page. Once the current week's last game
 * finishes, this naturally advances to it — see getCurrentWeek() in
 * thisWeek.ts for the complementary "week in progress" concept.
 *
 * Also requires player_weekly_stats to exist for that week, guarding
 * against the gap between games finishing and nflverse publishing box
 * scores (typically same-day, but not instant).
 */
export async function getLastCompletedWeek(season: number): Promise<number | null> {
  const row = await queryOne<{ week: number | null }>(
    `
    SELECT g.week
    FROM games g
    WHERE g.season = $1
    GROUP BY g.week
    HAVING bool_and(g.status = 'final')
       AND EXISTS (
         SELECT 1 FROM player_weekly_stats pws
         WHERE pws.season = $1 AND pws.week = g.week
       )
    ORDER BY g.week DESC
    LIMIT 1
    `,
    [season]
  );
  return row?.week ?? null;
}

export interface FocusGradeRow {
  playerId: string;
  playerName: string;
  position: string;
  teamId: string;
  grade: number;
}

export async function getTopFocusGrades(season: number, week: number, limit = 10): Promise<FocusGradeRow[]> {
  const rows = await query<Omit<FocusGradeRow, "grade"> & { grade: string }>(
    `
    SELECT fg.player_id AS "playerId", p.full_name AS "playerName", p.position,
           pws.team_id AS "teamId", fg.grade::numeric AS grade
    FROM focus_grades fg
    JOIN players p ON p.id = fg.player_id
    JOIN player_weekly_stats pws ON pws.player_id = fg.player_id AND pws.game_id = fg.game_id
    WHERE fg.season = $1 AND fg.week = $2
    ORDER BY fg.grade DESC
    LIMIT $3
    `,
    [season, week, limit]
  );
  return rows.map((r) => ({ ...r, grade: Number(r.grade) }));
}

export interface WeeklyStatRow {
  playerId: string;
  playerName: string;
  teamId: string;
  value: number;
}

async function topByColumn(season: number, week: number, column: string, limit: number): Promise<WeeklyStatRow[]> {
  // node-postgres returns NUMERIC columns as strings (to avoid silent
  // precision loss), so this fetches raw and converts explicitly rather
  // than trusting WeeklyStatRow's `value: number` at the query boundary.
  const rows = await query<{ playerId: string; playerName: string; teamId: string; value: string }>(
    `
    SELECT pws.player_id AS "playerId", p.full_name AS "playerName", pws.team_id AS "teamId",
           ${column}::numeric AS value
    FROM player_weekly_stats pws
    JOIN players p ON p.id = pws.player_id
    WHERE pws.season = $1 AND pws.week = $2 AND ${column} > 0
    ORDER BY ${column} DESC
    LIMIT $3
    `,
    [season, week, limit]
  );
  return rows.map((r) => ({ ...r, value: Number(r.value) }));
}

export interface WeeklyStatLeaders {
  passYards: WeeklyStatRow[];
  rushYards: WeeklyStatRow[];
  recYards: WeeklyStatRow[];
}

export async function getWeeklyStatLeaders(season: number, week: number, limit = 5): Promise<WeeklyStatLeaders> {
  const [passYards, rushYards, recYards] = await Promise.all([
    topByColumn(season, week, "pass_yards", limit),
    topByColumn(season, week, "rush_yards", limit),
    topByColumn(season, week, "rec_yards", limit),
  ]);
  return { passYards, rushYards, recYards };
}

export async function getTopFantasyPerformances(season: number, week: number, limit = 10): Promise<WeeklyStatRow[]> {
  return topByColumn(season, week, "fantasy_points_ppr", limit);
}

export interface GameResult {
  gameId: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number | null;
  awayScore: number | null;
}

export async function getWeekResults(season: number, week: number): Promise<GameResult[]> {
  return query<GameResult>(
    `
    SELECT id AS "gameId", home_team_id AS "homeTeamId", away_team_id AS "awayTeamId",
           home_score AS "homeScore", away_score AS "awayScore"
    FROM games
    WHERE season = $1 AND week = $2 AND status = 'final'
    ORDER BY id
    `,
    [season, week]
  );
}

export interface NotableInjury {
  playerId: string;
  playerName: string;
  teamId: string;
  status: string;
  description: string | null;
}

export async function getNotableInjuries(season: number, week: number, limit = 10): Promise<NotableInjury[]> {
  return query<NotableInjury>(
    `
    SELECT ir.player_id AS "playerId", p.full_name AS "playerName", ir.team_id AS "teamId",
           ir.status, ir.description
    FROM injury_reports ir
    JOIN players p ON p.id = ir.player_id
    WHERE ir.season = $1 AND ir.week = $2 AND ir.status IN ('Out', 'Doubtful')
    ORDER BY p.full_name
    LIMIT $3
    `,
    [season, week, limit]
  );
}
