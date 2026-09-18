import { query, queryOne } from "@/lib/db";

/**
 * The week currently being played — the earliest (season, week) that still
 * has at least one not-yet-final game. Mid-week (e.g. after Thursday Night
 * Football but before Sunday's games) this correctly stays on the current
 * week rather than jumping ahead, since that week still has scheduled
 * games. Once every game in it finishes, this naturally advances to the
 * next week — which is also exactly when getLastCompletedWeek() (in
 * lastWeek.ts) starts returning the week that just finished.
 *
 * Deliberately independent of getLatestStatsSeason(): "this week" means
 * calendar-current, and nflverse publishes schedules well ahead of player
 * box scores, so the real current week can be (and often is) in a season
 * the rest of the site still treats as not-yet-"current" for stats
 * purposes. Both concepts are correct for what they're used for.
 */
export async function getCurrentWeek(): Promise<{ season: number; week: number } | null> {
  return queryOne<{ season: number; week: number }>(
    `
    SELECT season, week
    FROM games
    WHERE status != 'final'
    ORDER BY season ASC, week ASC
    LIMIT 1
    `
  );
}

export interface WeekGame {
  gameId: string;
  homeTeamId: string;
  awayTeamId: string;
  gameDate: string | null;
  stadium: string | null;
  status: "scheduled" | "in_progress" | "final";
  homeScore: number | null;
  awayScore: number | null;
}

/** Every game in the week, finished or not — a finished game shows its
 * score, an unplayed one shows date/stadium instead. */
export async function getWeekGames(season: number, week: number): Promise<WeekGame[]> {
  return query<WeekGame>(
    `
    SELECT id AS "gameId", home_team_id AS "homeTeamId", away_team_id AS "awayTeamId",
           game_date AS "gameDate", stadium, status,
           home_score AS "homeScore", away_score AS "awayScore"
    FROM games
    WHERE season = $1 AND week = $2
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
 * exist. The Odds API drops a game once it starts, so this naturally only
 * ever has rows for this week's not-yet-played games.
 */
export async function getWeekOdds(season: number, week: number): Promise<Map<string, GameOdds>> {
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

export interface WeekInjury {
  playerId: string;
  playerName: string;
  teamId: string;
  status: string;
}

export async function getWeekInjuries(season: number, week: number): Promise<WeekInjury[]> {
  return query<WeekInjury>(
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
