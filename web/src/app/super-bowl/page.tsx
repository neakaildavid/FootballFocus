import { PageHeader } from "@/components/PageHeader";
import { TeamBadge } from "@/components/TeamBadge";
import { getLatestStatsSeason } from "@/lib/data/season";
import { getSuperBowlOdds } from "@/lib/data/superBowl";
import { ComingSoon } from "@/components/ComingSoon";

export const dynamic = "force-dynamic";

export default async function SuperBowlPage() {
  const season = await getLatestStatsSeason();
  const odds = await getSuperBowlOdds(season);

  return (
    <div>
      <PageHeader
        title="Super Bowl Odds"
        subtitle={`${season} season · derived from the Power Rankings model`}
      />
      {odds.length === 0 ? (
        <ComingSoon phase="build step 6 (run pipeline.run_compute --only power_rankings super_bowl_odds)" />
      ) : (
        <>
          <p className="mb-4 text-xs text-[var(--muted)]">
            A projected 14-team field (top 7 by power ranking per conference — a proxy for actual
            seeding, not real tiebreaker rules), with implied probability from a softmax over each
            team&apos;s composite power-ranking score. Doesn&apos;t simulate the bracket or account
            for in-season elimination.
          </p>
          <table className="w-full max-w-lg border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-[var(--muted)]">
                <th className="py-2 pr-3 font-normal">#</th>
                <th className="py-2 pr-3 font-normal">Team</th>
                <th className="py-2 pr-3 text-right font-normal">Odds</th>
              </tr>
            </thead>
            <tbody>
              {odds.map((o) => (
                <tr key={o.teamId} className="border-b border-[var(--border)]/60">
                  <td className="py-2 pr-3 text-[var(--muted)]">{o.rank}</td>
                  <td className="py-2 pr-3">
                    <span className="flex items-center gap-2">
                      <TeamBadge teamId={o.teamId} />
                      {o.teamId.toUpperCase()}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {(o.impliedProbability * 100).toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
