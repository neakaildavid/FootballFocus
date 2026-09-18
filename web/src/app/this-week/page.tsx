import { PageHeader } from "@/components/PageHeader";
import { PlayerLink } from "@/components/PlayerLink";
import { TeamBadge } from "@/components/TeamBadge";
import { ComingSoon } from "@/components/ComingSoon";
import { getCurrentWeek, getWeekGames, getWeekInjuries, getWeekOdds } from "@/lib/data/thisWeek";
import { getLatestPowerRankings } from "@/lib/data/powerRankings";

export const dynamic = "force-dynamic";

export default async function ThisWeekPage() {
  const current = await getCurrentWeek();

  if (!current) {
    return (
      <div>
        <PageHeader title="This Week" />
        <p className="text-sm text-[var(--muted)]">No games on the schedule right now.</p>
      </div>
    );
  }

  const { season, week } = current;
  const [games, injuries, odds, powerRankings] = await Promise.all([
    getWeekGames(season, week),
    getWeekInjuries(season, week),
    getWeekOdds(season, week),
    getLatestPowerRankings(season),
  ]);
  const rankByTeam = new Map(powerRankings.map((r) => [r.teamId, r.rank]));

  const injuriesByTeam = new Map<string, typeof injuries>();
  for (const inj of injuries) {
    const list = injuriesByTeam.get(inj.teamId) ?? [];
    list.push(inj);
    injuriesByTeam.set(inj.teamId, list);
  }

  return (
    <div>
      <PageHeader title="This Week" subtitle={`${season} · Week ${week}`} />
      <div className="grid gap-8 sm:grid-cols-2">
        <section className="sm:col-span-2">
          <h2 className="mb-2 text-xs uppercase tracking-wide text-[var(--muted)]">Matchups</h2>
          <ul className="divide-y divide-[var(--border)]">
            {games.map((g) => {
              const gameOdds = odds.get(g.gameId);
              const isFinal = g.status === "final";
              return (
                <li key={g.gameId} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="flex items-center gap-2">
                    <TeamBadge teamId={g.awayTeamId} />
                    <span className="text-[var(--muted)]">@</span>
                    <TeamBadge teamId={g.homeTeamId} />
                    {!isFinal && gameOdds?.impliedProbHome != null && gameOdds.impliedProbAway != null && (
                      <span className="ml-2 text-xs text-[var(--muted)]">
                        {gameOdds.impliedProbHome >= gameOdds.impliedProbAway
                          ? `${g.homeTeamId.toUpperCase()} ${Math.round(gameOdds.impliedProbHome * 100)}%`
                          : `${g.awayTeamId.toUpperCase()} ${Math.round(gameOdds.impliedProbAway * 100)}%`}
                      </span>
                    )}
                  </span>
                  {isFinal ? (
                    <span className="tabular-nums font-medium">
                      {g.awayScore}-{g.homeScore}
                    </span>
                  ) : (
                    <span className="text-xs text-[var(--muted)]">
                      {g.gameDate
                        ? new Date(g.gameDate).toLocaleDateString(undefined, {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          })
                        : "TBD"}
                      {g.stadium ? ` · ${g.stadium}` : ""}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
          {odds.size === 0 && games.some((g) => g.status !== "final") && (
            <p className="mt-2 text-xs text-[var(--muted)]">
              Win probability needs an Odds API key (see pipeline/README.md) — not yet configured.
            </p>
          )}
        </section>

        <section>
          <h2 className="mb-2 text-xs uppercase tracking-wide text-[var(--muted)]">
            Projected Fantasy Leaders
          </h2>
          <ComingSoon phase="a future enhancement (needs a per-player projection model)" />
        </section>

        <section>
          <h2 className="mb-2 text-xs uppercase tracking-wide text-[var(--muted)]">
            Strength of Matchup
          </h2>
          {rankByTeam.size === 0 ? (
            <ComingSoon phase="run pipeline.run_compute --only power_rankings for this season" />
          ) : (
            <ul className="space-y-1.5 text-sm">
              {games.map((g) => {
                const homeRank = rankByTeam.get(g.homeTeamId);
                const awayRank = rankByTeam.get(g.awayTeamId);
                return (
                  <li key={g.gameId} className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <TeamBadge teamId={g.awayTeamId} size="sm" />
                      <span className="text-xs text-[var(--muted)]">
                        {awayRank ? `#${awayRank}` : "—"}
                      </span>
                      <span className="text-[var(--muted)]">@</span>
                      <TeamBadge teamId={g.homeTeamId} size="sm" />
                      <span className="text-xs text-[var(--muted)]">
                        {homeRank ? `#${homeRank}` : "—"}
                      </span>
                    </span>
                    {homeRank && awayRank && (
                      <span className="text-xs text-[var(--muted)]">
                        {Math.abs(homeRank - awayRank) <= 4 ? "Close matchup" : "Mismatch"}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-2 text-xs text-[var(--muted)]">By overall Power Ranking (see Standings).</p>
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
