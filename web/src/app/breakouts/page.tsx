import { PageHeader } from "@/components/PageHeader";
import { PlayerLink } from "@/components/PlayerLink";
import { TeamBadge } from "@/components/TeamBadge";
import { TrendArrow } from "@/components/TrendArrow";
import { getLatestStatsSeason } from "@/lib/data/season";
import { getBreakoutCandidates } from "@/lib/data/breakouts";

export const dynamic = "force-dynamic";

export default async function BreakoutsPage() {
  const season = await getLatestStatsSeason();
  const candidates = await getBreakoutCandidates(season);

  return (
    <div>
      <PageHeader
        title="Rookie / Breakout Tracker"
        subtitle={`${season} season · rookies and 2nd-year players trending significantly above their own baseline`}
      />

      {candidates.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">No breakout candidates found this season.</p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-[11px] uppercase tracking-wide text-[var(--muted)]">
              <th className="py-2 pr-3 font-normal">Player</th>
              <th className="py-2 pr-3 font-normal">Team</th>
              <th className="py-2 pr-3 font-normal">Class</th>
              <th className="py-2 pr-3 text-right font-normal">Baseline PPR</th>
              <th className="py-2 pr-3 text-right font-normal">Last 3 PPR</th>
            </tr>
          </thead>
          <tbody>
            {candidates.map((c) => (
              <tr key={c.playerId} className="border-b border-[var(--border)]/60">
                <td className="py-2.5 pr-3">
                  <PlayerLink id={c.playerId} name={c.playerName} teamId={c.teamId} />
                  <span className="ml-2 text-xs text-[var(--muted)]">{c.position}</span>
                </td>
                <td className="py-2.5 pr-3">
                  <TeamBadge teamId={c.teamId} />
                </td>
                <td className="py-2.5 pr-3 text-xs text-[var(--muted)]">
                  {c.rookieSeason === season ? "Rookie" : "2nd Year"}
                </td>
                <td className="py-2.5 pr-3 text-right tabular-nums text-[var(--muted)]">
                  {c.baselineAvgPpr.toFixed(1)}
                </td>
                <td className="py-2.5 pr-3 text-right tabular-nums">
                  {c.recentAvgPpr.toFixed(1)}
                  <TrendArrow direction={c.trend.direction} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p className="mt-4 text-xs text-[var(--muted)]">
        Ranked by how far a player&apos;s last 3 games of PPR fantasy production (a blend of
        opportunity and results) exceed their own season baseline — same z-score contract as
        Season Leaders and Usage Trends (see <code>lib/trend.ts</code>).
      </p>
    </div>
  );
}
