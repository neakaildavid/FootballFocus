import { notFound } from "next/navigation";
import { getTeam } from "@/lib/teams";
import { getTeamRoster, getTeamSchedule } from "@/lib/data/team";
import { getLatestStatsSeason } from "@/lib/data/season";
import { PlayerLink } from "@/components/PlayerLink";
import { TeamBadge } from "@/components/TeamBadge";
import { ComingSoon } from "@/components/ComingSoon";

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
  const [roster, schedule] = await Promise.all([
    getTeamRoster(team.id, season),
    getTeamSchedule(team.id, season),
  ]);

  const glowVars = {
    "--glow-strong": `${team.color}90`,
    "--glow-soft": `${team.color}45`,
  } as React.CSSProperties;

  return (
    <div>
      <div className="mb-8 border-b border-[var(--border)] pb-4">
        <div className="flex items-center gap-3">
          <span
            className="glow-static flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] text-xs font-bold"
            style={{ color: team.color, ...glowVars }}
          >
            {team.abbr}
          </span>
          <div>
            <h1
              className="glow-static-text text-lg font-bold tracking-tight"
              style={{ color: team.color, ...glowVars }}
            >
              {team.city} {team.name}
            </h1>
            <p className="text-xs text-[var(--muted)]">
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
          <ComingSoon phase="build step 6 (needs play-by-play aggregation)" />
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
            Power Ranking & Trend
          </h2>
          <ComingSoon phase="build step 6" />
        </section>
      </div>
    </div>
  );
}
