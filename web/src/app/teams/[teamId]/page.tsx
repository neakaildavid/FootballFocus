import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getTeam, getTeamLogoUrl } from "@/lib/teams";
import { getTeamRoster, getTeamSchedule, getOffensiveTendencies } from "@/lib/data/team";
import { getTeamPowerRankingHistory } from "@/lib/data/powerRankings";
import { getLatestStatsSeason } from "@/lib/data/season";
import { computeTrendFromSeries } from "@/lib/trend";
import { PlayerLink } from "@/components/PlayerLink";
import { TeamBadge } from "@/components/TeamBadge";
import { TrendArrow } from "@/components/TrendArrow";

export const dynamic = "force-dynamic";

export default async function TeamPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const team = getTeam(teamId);
  if (!team) notFound();

  const season = await getLatestStatsSeason();
  const [roster, schedule, tendencies, rankingHistory] = await Promise.all([
    getTeamRoster(team.id, season),
    getTeamSchedule(team.id, season),
    getOffensiveTendencies(team.id, season),
    getTeamPowerRankingHistory(team.id, season),
  ]);
  const latestRanking = rankingHistory[rankingHistory.length - 1] ?? null;
  const rankingTrend = computeTrendFromSeries(rankingHistory.map((r) => r.compositeScore), 3);

  const glowVars = {
    "--glow-strong": `${team.color}90`,
    "--glow-soft": `${team.color}45`,
  } as React.CSSProperties;

  return (
    <div>
      <div className="mb-8 border-b border-[var(--border)] pb-6">
        <div className="flex items-center gap-4">
          <span className="glow-static flex h-16 w-16 items-center justify-center rounded-2xl" style={glowVars}>
            <Image
              src={getTeamLogoUrl(team.id)}
              alt={`${team.city} ${team.name} logo`}
              width={56}
              height={56}
              className="object-contain"
              priority
            />
          </span>
          <div>
            <h1
              className="glow-static-text text-2xl font-bold tracking-tight"
              style={{ color: team.color, ...glowVars }}
            >
              {team.city} {team.name}
            </h1>
            <p className="text-sm text-[var(--muted)]">
              {team.conference} {team.division}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-8 sm:grid-cols-2">
        <section>
          <h2 className="mb-2 text-xs uppercase tracking-wide text-[var(--muted)]">
            Offensive Roster
          </h2>
          <ul className="space-y-1.5 text-sm">
            {roster.length === 0 && (
              <li className="text-[var(--muted)]">No offensive players on record for this team.</li>
            )}
            {roster.map((p) => (
              <li key={p.id} className="flex items-center justify-between">
                <PlayerLink id={p.id} name={p.fullName} teamId={team.id} />
                <span className="text-xs text-[var(--muted)]">{p.position}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-xs uppercase tracking-wide text-[var(--muted)]">
            Offensive Tendencies
          </h2>
          {tendencies ? (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
              <TendencyStat label="Points/Game" value={tendencies.pointsPerGame.toFixed(1)} />
              <TendencyStat label="Yards/Play" value={tendencies.yardsPerPlay.toFixed(2)} />
              <TendencyStat label="EPA/Play" value={tendencies.epaPerPlay.toFixed(3)} />
              <TendencyStat label="Pass Rate" value={`${Math.round(tendencies.passRate * 100)}%`} />
              {tendencies.redzoneEfficiency != null && (
                <TendencyStat
                  label="Red Zone TD%"
                  value={`${Math.round(tendencies.redzoneEfficiency * 100)}%`}
                />
              )}
            </dl>
          ) : (
            <p className="text-sm text-[var(--muted)]">No offensive data on record for this team yet.</p>
          )}
        </section>

        <section>
          <h2 className="mb-2 text-xs uppercase tracking-wide text-[var(--muted)]">
            {season} Schedule &amp; Results
          </h2>
          {schedule.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No games on record for this team yet.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {schedule.map((g) => (
                <li key={g.gameId} className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span className="w-10 text-[var(--muted)]">Wk {g.week}</span>
                    <span className="text-[var(--muted)]">{g.isHome ? "vs" : "@"}</span>
                    <TeamBadge teamId={g.opponentTeamId} />
                  </span>
                  <span className="tabular-nums text-[var(--muted)]">
                    {g.pointsFor != null && g.pointsAgainst != null ? (
                      <>
                        <span
                          className={
                            g.result === "W"
                              ? "text-[var(--accent-up)]"
                              : g.result === "L"
                                ? "text-[var(--accent-down)]"
                                : ""
                          }
                        >
                          {g.result}
                        </span>{" "}
                        {g.pointsFor}-{g.pointsAgainst}
                      </>
                    ) : (
                      "—"
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-2 text-xs uppercase tracking-wide text-[var(--muted)]">
            Power Ranking &amp; Trend
          </h2>
          {latestRanking ? (
            <p className="text-sm">
              <Link href="/standings" className="underline decoration-[var(--border)] underline-offset-4">
                #{latestRanking.rank}
              </Link>{" "}
              overall
              <TrendArrow direction={rankingTrend.direction} />
              <span className="ml-2 text-xs text-[var(--muted)]">
                score {latestRanking.compositeScore.toFixed(2)}
              </span>
            </p>
          ) : (
            <p className="text-sm text-[var(--muted)]">No power ranking computed for this team yet.</p>
          )}
        </section>
      </div>
    </div>
  );
}

function TendencyStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-[var(--border)]/60 py-1">
      <dt className="text-[var(--muted)]">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
