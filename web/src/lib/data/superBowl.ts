import { query } from "@/lib/db";

export interface SuperBowlOddsRow {
  teamId: string;
  rank: number;
  impliedProbability: number;
}

export async function getSuperBowlOdds(season: number): Promise<SuperBowlOddsRow[]> {
  const rows = await query<{ teamId: string; rank: number; impliedProbability: string }>(
    `
    SELECT team_id AS "teamId", rank, implied_probability::text AS "impliedProbability"
    FROM super_bowl_odds
    WHERE season = $1
    ORDER BY rank ASC
    `,
    [season]
  );
  return rows.map((r) => ({ ...r, impliedProbability: Number(r.impliedProbability) }));
}
