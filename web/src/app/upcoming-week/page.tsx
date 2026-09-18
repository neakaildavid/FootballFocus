import { PageHeader } from "@/components/PageHeader";
import { PlayerLink } from "@/components/PlayerLink";
import { TeamBadge } from "@/components/TeamBadge";
import { ComingSoon } from "@/components/ComingSoon";
import { getUpcomingWeek, getUpcomingGames, getUpcomingInjuries, getUpcomingOdds } from "@/lib/data/upcomingWeek";

export const dynamic = "force-dynamic";

export default async function UpcomingWeekPage() {
  const upcoming = await getUpcomingWeek();

  if (!upcoming) {
    return (
      <div>
        <PageHeader title="Upcoming Week" />
        <p className="text-sm text-[var(--muted)]">No upcoming games on the schedule yet.</p>
      </div>
    );
  }

  const { season, week } = upcoming;
  const [games, injuries, odds] = await Promise.all([
    getUpcomingGames(season, week),
    getUpcomingInjuries(season, week),
    getUpcomingOdds(season, week),
  ]);

  const injuriesByTeam = new Map<string, typeof injuries>();
  for (const inj of injuries) {
    const list = injuriesByTeam.get(inj.teamId) ?? [];
    list.push(inj);
    injuriesByTeam.set(inj.teamId, list);
  }

  return (
    <div>
      <PageHeader
        title="Upcoming Week"
        subtitle={`${season} · Week ${week}`}
      />
      <div className="grid gap-8 sm:grid-cols-2">
        <section className="sm:col-span-2">
          <h2 className="mb-2 text-xs uppercase tracking-wide text-[var(--muted)]">
            Schedule{odds.size > 0 ? " & Win Probability" : ""}
          </h2>
          <ul className="divide-y divide-[var(--border)]">
            {games.map((g) => {
              const gameOdds = odds.get(g.gameId);
              return (
                <li key={g.gameId} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="flex items-center gap-2">
                    <TeamBadge teamId={g.awayTeamId} />
                    <span className="text-[var(--muted)]">@</span>
                    <TeamBadge teamId={g.homeTeamId} />
                    {gameOdds?.impliedProbHome != null && gameOdds.impliedProbAway != null && (
                      <span className="ml-2 text-xs text-[var(--muted)]">
                        {gameOdds.impliedProbHome >= gameOdds.impliedProbAway
                          ? `${g.homeTeamId.toUpperCase()} ${Math.round(gameOdds.impliedProbHome * 100)}%`
                          : `${g.awayTeamId.toUpperCase()} ${Math.round(gameOdds.impliedProbAway * 100)}%`}
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-[var(--muted)]">
                    {g.gameDate ? new Date(g.gameDate).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) : "TBD"}
                    {g.stadium ? ` · ${g.stadium}` : ""}
                  </span>
                </li>
              );
            })}
          </ul>
          {odds.size === 0 && (
            <p className="mt-2 text-[11px] text-[var(--muted)]">
              Win probability needs an Odds API key (see pipeline/README.md) or the step-6
              power-ranking model — not yet configured.
            </p>
          )}
        </section>

        <section>
          <h2 className="mb-2 text-xs uppercase tracking-wide text-[var(--muted)]">
            Projected Fantasy Leaders
          </h2>
          <ComingSoon phase="build step 6+ (needs a projection model)" />
        </section>

        <section>
          <h2 className="mb-2 text-xs uppercase tracking-wide text-[var(--muted)]">
            Strength of Matchup
          </h2>
          <ComingSoon phase="build step 6 (needs the power-ranking model)" />
        </section>

        <section className="sm:col-span-2">
          <h2 className="mb-2 text-xs uppercase tracking-wide text-[var(--muted)]">
            Injury Designations
          </h2>
          {injuries.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No injury designations reported yet this week.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {[...injuriesByTeam.entries()].map(([teamId, list]) => (
                <div key={teamId}>
                  <div className="mb-1 flex items-center gap-2">
                    <TeamBadge teamId={teamId} />
                  </div>
                  <ul className="space-y-1 text-sm">
                    {list.map((inj) => (
                      <li key={inj.playerId} className="flex items-center justify-between">
                        <PlayerLink id={inj.playerId} name={inj.playerName} teamId={inj.teamId} />
                        <span className="text-xs text-[var(--muted)]">{inj.status}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
