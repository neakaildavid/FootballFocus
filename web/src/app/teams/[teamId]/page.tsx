import { notFound } from "next/navigation";
import { getTeam, TEAMS } from "@/lib/teams";
import { MOCK_PLAYERS } from "@/lib/mock/players";
import { PlayerLink } from "@/components/PlayerLink";
import { ComingSoon } from "@/components/ComingSoon";

export function generateStaticParams() {
  return TEAMS.map((t) => ({ teamId: t.id }));
}

export default async function TeamPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const team = getTeam(teamId);
  if (!team) notFound();

  const roster = MOCK_PLAYERS.filter((p) => p.teamId === team.id);
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
            Offensive Roster (placeholder)
          </h2>
          <ul className="space-y-1.5 text-sm">
            {roster.length === 0 && (
              <li className="text-[var(--muted)]">No placeholder players seeded for this team yet.</li>
            )}
            {roster.map((p) => (
              <li key={p.id} className="flex items-center justify-between">
                <PlayerLink id={p.id} name={p.name} teamId={p.teamId} />
                <span className="text-xs text-[var(--muted)]">
                  {p.position} · #{p.jersey}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-xs uppercase tracking-wide text-[var(--muted)]">
            Offensive Tendencies
          </h2>
          <ComingSoon phase="build step 4" />
        </section>

        <section>
          <h2 className="mb-2 text-xs uppercase tracking-wide text-[var(--muted)]">
            Schedule & Results
          </h2>
          <ComingSoon phase="build step 3" />
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
