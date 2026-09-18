import { query } from "@/lib/db";

export interface StandingsRow {
  teamId: string;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  streak: string;
}

interface TeamGameRow {
  teamId: string;
  week: number;
  result: "W" | "L" | "T";
  pointsFor: string;
  pointsAgainst: string;
}

function computeStreak(resultsInOrder: ("W" | "L" | "T")[]): string {
  if (resultsInOrder.length === 0) return "-";
  const last = resultsInOrder[resultsInOrder.length - 1];
  let count = 0;
  for (let i = resultsInOrder.length - 1; i >= 0 && resultsInOrder[i] === last; i--) count++;
  return `${last}${count}`;
}

export async function getStandings(season: number): Promise<StandingsRow[]> {
  // Regular season only — this is what determines playoff seeding and
  // matches every real standings page's convention. Combining in
  // postseason games would inflate records past 17 games for teams that
  // made a playoff run (an early version of this query did exactly that).
  const rows = await query<TeamGameRow>(
    `
    SELECT team_id AS "teamId", week, result,
           points_for::text AS "pointsFor", points_against::text AS "pointsAgainst"
    FROM team_weekly_stats
    WHERE season = $1 AND season_type = 'REG' AND result IS NOT NULL
    ORDER BY team_id, week ASC
    `,
    [season]
  );

  const byTeam = new Map<string, TeamGameRow[]>();
  for (const row of rows) {
    const list = byTeam.get(row.teamId) ?? [];
    list.push(row);
    byTeam.set(row.teamId, list);
  }

  const standings: StandingsRow[] = [];
  for (const [teamId, games] of byTeam) {
    const wins = games.filter((g) => g.result === "W").length;
    const losses = games.filter((g) => g.result === "L").length;
    const ties = games.filter((g) => g.result === "T").length;
    const pointsFor = games.reduce((a, g) => a + Number(g.pointsFor), 0);
    const pointsAgainst = games.reduce((a, g) => a + Number(g.pointsAgainst), 0);
    const streak = computeStreak(games.map((g) => g.result));
    standings.push({ teamId, wins, losses, ties, pointsFor, pointsAgainst, streak });
  }
  return standings;
}
