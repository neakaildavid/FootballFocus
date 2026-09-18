import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { TEAMS } from "@/lib/teams";
import { getLatestStatsSeason } from "@/lib/data/season";

export interface SearchEntry {
  id: string;
  label: string;
  sub: string;
  href: string;
}

interface PlayerRow {
  id: string;
  full_name: string;
  position: string;
  team_id: string | null;
}

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();

  const teamMatches: SearchEntry[] = TEAMS.filter(
    (t) =>
      !q ||
      `${t.city} ${t.name}`.toLowerCase().includes(q.toLowerCase()) ||
      t.abbr.toLowerCase().includes(q.toLowerCase())
  )
    .slice(0, 5)
    .map((t) => ({
      id: `team-${t.id}`,
      label: `${t.city} ${t.name}`,
      sub: `Team · ${t.abbr}`,
      href: `/teams/${t.id}`,
    }));

  // Restrict to players with a stat line in the latest stats season —
  // players.current_team_id is each player's all-time *last* team, so
  // without this filter a decades-retired player whose career happened to
  // end on a given team would surface here indefinitely as if still active.
  const season = await getLatestStatsSeason();
  const namePattern = q.length >= 2 ? `%${q}%` : "%";
  const playerRows = await query<PlayerRow>(
    `
    SELECT DISTINCT ON (p.id) p.id, p.full_name, p.position, p.current_team_id AS team_id
    FROM players p
    JOIN player_weekly_stats pws ON pws.player_id = p.id AND pws.season = $1
    WHERE p.full_name ILIKE $2
    ORDER BY p.id, p.full_name
    LIMIT 8
    `,
    [season, namePattern]
  );

  const playerMatches: SearchEntry[] = playerRows.map((p) => ({
    id: `player-${p.id}`,
    label: p.full_name,
    sub: `${p.position} · ${p.team_id?.toUpperCase() ?? ""}`,
    href: `/players/${p.id}`,
  }));

  const results = [...playerMatches, ...teamMatches].slice(0, 8);
  return NextResponse.json(results);
}
