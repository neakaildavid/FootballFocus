import { query } from "@/lib/db";

export interface PowerRankingRow {
  teamId: string;
  rank: number;
  compositeScore: number;
  pointDiffZ: number | null;
  yardsPerPlayZ: number | null;
  epaOffenseZ: number | null;
  epaDefenseZ: number | null;
  redzoneEffZ: number | null;
  turnoverMarginZ: number | null;
  strengthOfScheduleZ: number | null;
}

interface RawRow extends Omit<PowerRankingRow, "compositeScore" | "pointDiffZ" | "yardsPerPlayZ" | "epaOffenseZ" | "epaDefenseZ" | "redzoneEffZ" | "turnoverMarginZ" | "strengthOfScheduleZ"> {
  compositeScore: string;
  pointDiffZ: string | null;
  yardsPerPlayZ: string | null;
  epaOffenseZ: string | null;
  epaDefenseZ: string | null;
  redzoneEffZ: string | null;
  turnoverMarginZ: string | null;
  strengthOfScheduleZ: string | null;
}

const toNum = (v: string | null) => (v == null ? null : Number(v));

export async function getLatestPowerRankings(season: number): Promise<PowerRankingRow[]> {
  const rows = await query<RawRow>(
    `
    SELECT team_id AS "teamId", rank, composite_score::text AS "compositeScore",
           point_diff_z::text AS "pointDiffZ", yards_per_play_z::text AS "yardsPerPlayZ",
           epa_offense_z::text AS "epaOffenseZ", epa_defense_z::text AS "epaDefenseZ",
           redzone_eff_z::text AS "redzoneEffZ", turnover_margin_z::text AS "turnoverMarginZ",
           strength_of_schedule_z::text AS "strengthOfScheduleZ"
    FROM power_rankings
    WHERE season = $1 AND week = (SELECT max(week) FROM power_rankings WHERE season = $1)
    ORDER BY rank ASC
    `,
    [season]
  );
  return rows.map((r) => ({
    teamId: r.teamId,
    rank: r.rank,
    compositeScore: Number(r.compositeScore),
    pointDiffZ: toNum(r.pointDiffZ),
    yardsPerPlayZ: toNum(r.yardsPerPlayZ),
    epaOffenseZ: toNum(r.epaOffenseZ),
    epaDefenseZ: toNum(r.epaDefenseZ),
    redzoneEffZ: toNum(r.redzoneEffZ),
    turnoverMarginZ: toNum(r.turnoverMarginZ),
    strengthOfScheduleZ: toNum(r.strengthOfScheduleZ),
  }));
}
