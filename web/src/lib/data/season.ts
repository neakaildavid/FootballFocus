import { queryOne } from "@/lib/db";

/**
 * The latest season with real weekly player stats — not just the latest
 * season with a schedule. nflverse publishes schedules well ahead of box
 * scores, so a just-started season can have games but no player_weekly_stats
 * yet (true as of writing: 2025/2026 schedules exist, but nflverse hasn't
 * published those seasons' player_stats release yet). Deriving this from
 * the data means the site's "current season" advances automatically the
 * moment a fresh ingestion run lands real stats, no code change needed.
 */
export async function getLatestStatsSeason(): Promise<number> {
  const row = await queryOne<{ max: number | null }>(
    "SELECT max(season) AS max FROM player_weekly_stats WHERE season_type = 'REG'"
  );
  return row?.max ?? new Date().getFullYear();
}
