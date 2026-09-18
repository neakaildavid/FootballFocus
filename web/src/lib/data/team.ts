import { query, queryOne } from "@/lib/db";

export interface RosterEntry {
  id: string;
  fullName: string;
  position: string;
}

/**
 * Roster as of `season`, derived from who actually has a stat line for this
 * team that season — not players.current_team_id, which is each player's
 * all-time *last* team and would otherwise resurface decades-retired
 * players whose final season happened to be with this franchise (e.g. a
 * 1980s QB whose career ended here shows up forever as "on the roster").
 */
export async function getTeamRoster(teamId: string, season: number): Promise<RosterEntry[]> {
  return query<RosterEntry>(
    `
    SELECT id, "fullName", position FROM (
      SELECT DISTINCT p.id, p.full_name AS "fullName", p.position
      FROM players p
      JOIN player_weekly_stats pws ON pws.player_id = p.id
      WHERE pws.team_id = $1 AND pws.season = $2
    ) roster
    ORDER BY
      CASE position WHEN 'QB' THEN 0 WHEN 'RB' THEN 1 WHEN 'WR' THEN 2 WHEN 'TE' THEN 3 ELSE 4 END,
      "fullName"
    `,
    [teamId, season]
  );
}

export interface TeamGameResult {
  gameId: string;
  season: number;
  week: number;
  opponentTeamId: string;
  isHome: boolean;
  pointsFor: number | null;
  pointsAgainst: number | null;
  result: "W" | "L" | "T" | null;
}

export async function getTeamSchedule(teamId: string, season: number): Promise<TeamGameResult[]> {
  return query<TeamGameResult>(
    `
    SELECT tws.game_id AS "gameId", tws.season, tws.week,
           tws.opponent_team_id AS "opponentTeamId", tws.is_home AS "isHome",
           tws.points_for AS "pointsFor", tws.points_against AS "pointsAgainst",
           tws.result
    FROM team_weekly_stats tws
    WHERE tws.team_id = $1 AND tws.season = $2
    ORDER BY tws.week ASC
    `,
    [teamId, season]
  );
}

export interface OffensiveTendencies {
  pointsPerGame: number;
  yardsPerPlay: number;
  epaPerPlay: number;
  passRate: number;
  redzoneEfficiency: number | null;
}

export async function getOffensiveTendencies(teamId: string, season: number): Promise<OffensiveTendencies | null> {
  const row = await queryOne<{
    pointsPerGame: string | null;
    yardsPerPlay: string | null;
    epaPerPlay: string | null;
    passRate: string | null;
    redzoneEfficiency: string | null;
  }>(
    `
    SELECT
      avg(points_for)::text AS "pointsPerGame",
      (sum(yards_offense)::numeric / nullif(sum(plays_offense), 0))::text AS "yardsPerPlay",
      avg(epa_per_play_offense)::text AS "epaPerPlay",
      avg(pass_rate)::text AS "passRate",
      (sum(redzone_tds)::numeric / nullif(sum(redzone_trips), 0))::text AS "redzoneEfficiency"
    FROM team_weekly_stats
    WHERE team_id = $1 AND season = $2 AND season_type = 'REG'
    `,
    [teamId, season]
  );
  if (!row || row.pointsPerGame == null) return null;
  return {
    pointsPerGame: Number(row.pointsPerGame),
    yardsPerPlay: Number(row.yardsPerPlay),
    epaPerPlay: Number(row.epaPerPlay),
    passRate: Number(row.passRate),
    redzoneEfficiency: row.redzoneEfficiency != null ? Number(row.redzoneEfficiency) : null,
  };
}
