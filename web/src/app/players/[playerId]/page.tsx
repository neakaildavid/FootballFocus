import { notFound } from "next/navigation";
import { getPlayerProfile, getPlayerPageData } from "@/lib/data/player";
import { getTeam } from "@/lib/teams";
import { TeamBadge } from "@/components/TeamBadge";
import { TrendArrow } from "@/components/TrendArrow";
import { ComingSoon } from "@/components/ComingSoon";

export const dynamic = "force-dynamic";

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ playerId: string }>;
}) {
  const { playerId } = await params;
  const profile = await getPlayerProfile(playerId);
  if (!profile) notFound();

  const { gameLog, season, seasonTotals, trend, primaryStatLabel } = await getPlayerPageData(
    playerId,
    profile.position
  );
  const team = profile.teamId ? getTeam(profile.teamId) : null;

  return (
    <div>
      <div className="mb-8 flex items-center gap-3 border-b border-[var(--border)] pb-4">
        {profile.teamId && <TeamBadge teamId={profile.teamId} size="md" />}
        <div>
          <h1 className="text-lg font-bold tracking-tight">{profile.fullName}</h1>
          <p className="text-xs text-[var(--muted)]">
            {profile.position} · {team ? `${team.city} ${team.name}` : "Free agent"}
            {profile.college ? ` · ${profile.college}` : ""}
          </p>
        </div>
      </div>

      {!season || !seasonTotals ? (
        <ComingSoon phase="build step 3 (no game data ingested for this player yet)" />
      ) : (
        <div className="grid gap-8 sm:grid-cols-2">
          <section>
            <h2 className="mb-2 text-xs uppercase tracking-wide text-[var(--muted)]">
              {season} Stat Line
            </h2>
            <StatLine position={profile.position} totals={seasonTotals} />
          </section>

          <section>
            <h2 className="mb-2 text-xs uppercase tracking-wide text-[var(--muted)]">
              Trend (Last 3 vs. Season Baseline)
            </h2>
            {trend && primaryStatLabel ? (
              <p className="text-sm">
                {primaryStatLabel}
                <TrendArrow direction={trend.direction} />
                <span className="ml-2 text-xs text-[var(--muted)]">z = {trend.zScore.toFixed(2)}</span>
              </p>
            ) : (
              <p className="text-sm text-[var(--muted)]">Not enough games yet to compute a trend.</p>
            )}
          </section>

          <section className="sm:col-span-2">
            <h2 className="mb-2 text-xs uppercase tracking-wide text-[var(--muted)]">
              {season} Game-by-Game Log
            </h2>
            <GameLogTable position={profile.position} gameLog={gameLog} />
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
      )}
    </div>
  );
}

function StatLine({ position, totals }: { position: string; totals: Record<string, number> }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
      {position === "QB" && (
        <>
          <Stat label="Comp/Att" value={`${totals.completions}/${totals.passAttempts}`} />
          <Stat label="Pass Yards" value={totals.passYards} />
          <Stat label="Pass TDs" value={totals.passTDs} />
          <Stat label="INTs" value={totals.interceptions} />
        </>
      )}
      {(position === "RB" || position === "FB") && (
        <>
          <Stat label="Carries" value={totals.carries} />
          <Stat label="Rush Yards" value={totals.rushYards} />
          <Stat label="Rush TDs" value={totals.rushTDs} />
        </>
      )}
      {(position === "WR" || position === "TE") && (
        <>
          <Stat label="Receptions" value={totals.receptions} />
          <Stat label="Targets" value={totals.targets} />
          <Stat label="Rec Yards" value={totals.recYards} />
          <Stat label="Rec TDs" value={totals.recTDs} />
        </>
      )}
      <Stat label="Fantasy (PPR)" value={totals.fantasyPointsPpr?.toFixed(1)} />
    </dl>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between border-b border-[var(--border)]/60 py-1">
      <dt className="text-[var(--muted)]">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

function GameLogTable({
  position,
  gameLog,
}: {
  position: string;
  gameLog: Awaited<ReturnType<typeof getPlayerPageData>>["gameLog"];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[500px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] text-left text-[11px] uppercase tracking-wide text-[var(--muted)]">
            <th className="py-2 pr-3 font-normal">Wk</th>
            <th className="py-2 pr-3 font-normal">Opp</th>
            {position === "QB" && (
              <>
                <th className="py-2 pr-3 text-right font-normal">Yds</th>
                <th className="py-2 pr-3 text-right font-normal">TD</th>
                <th className="py-2 pr-3 text-right font-normal">INT</th>
              </>
            )}
            {(position === "RB" || position === "FB") && (
              <>
                <th className="py-2 pr-3 text-right font-normal">Car</th>
                <th className="py-2 pr-3 text-right font-normal">Yds</th>
                <th className="py-2 pr-3 text-right font-normal">TD</th>
              </>
            )}
            {(position === "WR" || position === "TE") && (
              <>
                <th className="py-2 pr-3 text-right font-normal">Rec</th>
                <th className="py-2 pr-3 text-right font-normal">Yds</th>
                <th className="py-2 pr-3 text-right font-normal">TD</th>
              </>
            )}
            <th className="py-2 pr-3 text-right font-normal">Snap%</th>
            <th className="py-2 pr-3 text-right font-normal">PPR</th>
          </tr>
        </thead>
        <tbody>
          {gameLog.map((g) => (
            <tr key={g.week} className="border-b border-[var(--border)]/60">
              <td className="py-2 pr-3 text-[var(--muted)]">{g.week}</td>
              <td className="py-2 pr-3">
                <TeamBadge teamId={g.opponentTeamId} />
              </td>
              {position === "QB" && (
                <>
                  <td className="py-2 pr-3 text-right tabular-nums">{g.passYards}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{g.passTDs}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{g.interceptions}</td>
                </>
              )}
              {(position === "RB" || position === "FB") && (
                <>
                  <td className="py-2 pr-3 text-right tabular-nums">{g.carries}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{g.rushYards}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{g.rushTDs}</td>
                </>
              )}
              {(position === "WR" || position === "TE") && (
                <>
                  <td className="py-2 pr-3 text-right tabular-nums">{g.receptions}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{g.recYards}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{g.recTDs}</td>
                </>
              )}
              <td className="py-2 pr-3 text-right tabular-nums text-[var(--muted)]">
                {g.offenseSnapPct != null ? `${Math.round(Number(g.offenseSnapPct) * 100)}%` : "—"}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums">{Number(g.fantasyPointsPpr).toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
