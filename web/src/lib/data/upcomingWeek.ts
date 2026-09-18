import { query, queryOne } from "@/lib/db";

/**
 * The next slate of scheduled-but-not-yet-played games — this is
 * deliberately independent of getLatestStatsSeason(). "Upcoming" means
 * calendar-future, and nflverse publishes schedules well ahead of player
 * box scores, so the real upcoming slate can be (and currently is) in a
 * season the rest of the site treats as not-yet-"current" for stats
 * purposes. Both concepts are correct for what they're used for.
 */
export async function getUpcomingWeek(): Promise<{ season: number; week: number } | null> {
  return queryOne<{ season: number; week: number }>(
    `
    SELECT season, week
    FROM games
    WHERE status = 'scheduled'
    ORDER BY season ASC, week ASC
    LIMIT 1
    `
  );
}

export interface UpcomingGame {
  gameId: string;
  homeTeamId: string;
  awayTeamId: string;
  gameDate: string | null;
  stadium: string | null;
}

export async function getUpcomingGames(season: number, week: number): Promise<UpcomingGame[]> {
  return query<UpcomingGame>(
    `
    SELECT id AS "gameId", home_team_id AS "homeTeamId", away_team_id AS "awayTeamId",
           game_date AS "gameDate", stadium
    FROM games
    WHERE season = $1 AND week = $2 AND status = 'scheduled'
    ORDER BY game_date ASC NULLS LAST, id
    `,
    [season, week]
  );
}

export interface GameOdds {
  gameId: string;
  impliedProbHome: number | null;
  impliedProbAway: number | null;
  spreadHome: number | null;
  total: number | null;
  bookmakerCount: number;
}

/**
 * Latest-fetch odds per game, averaged across whichever bookmakers The
 * Odds API returned (see pipeline/ingest/odds.py). Returns an empty map
 * until ODDS_API_KEY is set and that ingestion step has run — the page
 * falls back to a placeholder in that case rather than assuming odds
 * exist.
 */
export async function getUpcomingOdds(season: number, week: number): Promise<Map<string, GameOdds>> {
  const rows = await query<{
    gameId: string;
    impliedProbHome: string | null;
    impliedProbAway: string | null;
    spreadHome: string | null;
    total: string | null;
    bookmakerCount: string;
  }>(
    `
    SELECT bo.game_id AS "gameId",
           avg(bo.implied_prob_home) AS "impliedProbHome",
           avg(bo.implied_prob_away) AS "impliedProbAway",
           avg(bo.spread_home) AS "spreadHome",
           avg(bo.total) AS "total",
           count(DISTINCT bo.bookmaker) AS "bookmakerCount"
    FROM betting_odds bo
    JOIN games g ON g.id = bo.game_id
    WHERE g.season = $1 AND g.week = $2
      AND bo.fetched_at = (SELECT max(fetched_at) FROM betting_odds WHERE game_id = bo.game_id)
    GROUP BY bo.game_id
    `,
    [season, week]
  );
  return new Map(
    rows.map((r) => [
      r.gameId,
      {
        gameId: r.gameId,
        impliedProbHome: r.impliedProbHome != null ? Number(r.impliedProbHome) : null,
        impliedProbAway: r.impliedProbAway != null ? Number(r.impliedProbAway) : null,
        spreadHome: r.spreadHome != null ? Number(r.spreadHome) : null,
        total: r.total != null ? Number(r.total) : null,
        bookmakerCount: Number(r.bookmakerCount),
      },
    ])
  );
}

export interface UpcomingInjury {
  playerId: string;
  playerName: string;
  teamId: string;
  status: string;
}

export async function getUpcomingInjuries(season: number, week: number): Promise<UpcomingInjury[]> {
  return query<UpcomingInjury>(
    `
    SELECT ir.player_id AS "playerId", p.full_name AS "playerName", ir.team_id AS "teamId", ir.status
    FROM injury_reports ir
    JOIN players p ON p.id = ir.player_id
    WHERE ir.season = $1 AND ir.week = $2 AND ir.status IN ('Out', 'Doubtful', 'Questionable')
    ORDER BY ir.team_id, p.full_name
    `,
    [season, week]
  );
}
