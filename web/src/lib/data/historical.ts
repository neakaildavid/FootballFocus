import { query, queryOne } from "@/lib/db";

const PRIMARY_STAT_COLUMN: Record<string, string> = {
  QB: "pass_yards",
  RB: "rush_yards",
  FB: "rush_yards",
  WR: "rec_yards",
  TE: "rec_yards",
};

export const PRIMARY_STAT_LABEL: Record<string, string> = {
  QB: "passing yards",
  RB: "rushing yards",
  FB: "rushing yards",
  WR: "receiving yards",
  TE: "receiving yards",
};

export interface HistoricalComparison {
  statLabel: string;
  value: number;
  rank: number;
  totalPlayerSeasons: number;
  sinceSeason: number;
  throughWeek: number;
}

/**
 * "Nth-most <stat> through Week W since <year>" — compares this player's
 * cumulative total through their current week against every other
 * player-season at the same position, at the same week-of-season
 * checkpoint, across every season this database has ingested (currently
 * 2015-2024; see README's build-order notes on why that range and not the
 * full 1999+ history nflverse could support).
 */
export async function getHistoricalComparison(
  playerId: string,
  position: string,
  season: number,
  week: number
): Promise<HistoricalComparison | null> {
  const column = PRIMARY_STAT_COLUMN[position];
  if (!column) return null;

  const sinceRow = await queryOne<{ min: number }>(
    "SELECT min(season) AS min FROM player_weekly_stats WHERE season_type = 'REG'"
  );
  const sinceSeason = sinceRow?.min ?? season;

  const rows = await query<{ playerId: string; season: number; cumValue: string }>(
    `
    WITH cumulative AS (
      SELECT pws.player_id, pws.season, pws.week,
             SUM(${column}) OVER (PARTITION BY pws.player_id, pws.season ORDER BY pws.week) AS cum_value
      FROM player_weekly_stats pws
      JOIN players p ON p.id = pws.player_id
      WHERE p.position = $1 AND pws.season_type = 'REG'
    )
    SELECT player_id AS "playerId", season, cum_value::text AS "cumValue"
    FROM cumulative
    WHERE week = $2
    ORDER BY cum_value DESC
    `,
    [position, week]
  );

  const index = rows.findIndex((r) => r.playerId === playerId && r.season === season);
  if (index === -1) return null;

  return {
    statLabel: PRIMARY_STAT_LABEL[position],
    value: Number(rows[index].cumValue),
    rank: index + 1,
    totalPlayerSeasons: rows.length,
    sinceSeason,
    throughWeek: week,
  };
}
