import { notFound } from "next/navigation";
import { MOCK_PLAYERS } from "@/lib/mock/players";
import { getTeam } from "@/lib/teams";
import { TeamBadge } from "@/components/TeamBadge";
import { ComingSoon } from "@/components/ComingSoon";

export function generateStaticParams() {
  return MOCK_PLAYERS.map((p) => ({ playerId: p.id }));
}

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ playerId: string }>;
}) {
  const { playerId } = await params;
  const player = MOCK_PLAYERS.find((p) => p.id === playerId);
  if (!player) notFound();
  const team = getTeam(player.teamId);

  return (
    <div>
      <div className="mb-8 flex items-center gap-3 border-b border-[var(--border)] pb-4">
        <TeamBadge teamId={player.teamId} size="md" />
        <div>
          <h1 className="text-lg font-bold tracking-tight">{player.name}</h1>
          <p className="text-xs text-[var(--muted)]">
            {player.position} · {team ? `${team.city} ${team.name}` : player.teamId} · #{player.jersey}
          </p>
        </div>
      </div>

      <div className="grid gap-8 sm:grid-cols-2">
        <section>
          <h2 className="mb-2 text-xs uppercase tracking-wide text-[var(--muted)]">
            Season Stat Line
          </h2>
          <ComingSoon phase="build step 4" />
        </section>
        <section>
          <h2 className="mb-2 text-xs uppercase tracking-wide text-[var(--muted)]">
            Game-by-Game Log
          </h2>
          <ComingSoon phase="build step 4" />
        </section>
        <section>
          <h2 className="mb-2 text-xs uppercase tracking-wide text-[var(--muted)]">
            Trend (Rolling 3-Week Avg)
          </h2>
          <ComingSoon phase="build step 4" />
        </section>
        <section>
          <h2 className="mb-2 text-xs uppercase tracking-wide text-[var(--muted)]">
            Snap Share / Usage
          </h2>
          <ComingSoon phase="build step 7" />
        </section>
        <section>
          <h2 className="mb-2 text-xs uppercase tracking-wide text-[var(--muted)]">
            Hub Grade History
          </h2>
          <ComingSoon phase="build step 5" />
        </section>
        <section>
          <h2 className="mb-2 text-xs uppercase tracking-wide text-[var(--muted)]">
            Upcoming Matchup Context
          </h2>
          <ComingSoon phase="build step 5" />
        </section>
      </div>
    </div>
  );
}
