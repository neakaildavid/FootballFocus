import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { PlayerLink } from "@/components/PlayerLink";
import { TeamBadge } from "@/components/TeamBadge";
import { TrendArrow } from "@/components/TrendArrow";
import { getLatestStatsSeason } from "@/lib/data/season";
import {
  getLeaderboard,
  STAT_CATEGORIES,
  TIME_RANGES,
  StatCategory,
  TimeRange,
} from "@/lib/data/leaders";

export const dynamic = "force-dynamic";

function isStatCategory(value: string | undefined): value is StatCategory {
  return STAT_CATEGORIES.some((c) => c.key === value);
}
function isTimeRange(value: string | undefined): value is TimeRange {
  return TIME_RANGES.some((r) => r.key === value);
}

export default async function LeadersPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; range?: string; season?: string }>;
}) {
  const params = await searchParams;
  const category: StatCategory = isStatCategory(params.category) ? params.category : "recYards";
  const range: TimeRange = isTimeRange(params.range) ? params.range : "full";
  const latestSeason = await getLatestStatsSeason();
  const season = params.season ? Number(params.season) : latestSeason;

  const rows = await getLeaderboard(season, category, range);
  const categoryLabel = STAT_CATEGORIES.find((c) => c.key === category)?.label;

  const linkFor = (overrides: Partial<{ category: string; range: string; season: string }>) => {
    const next = new URLSearchParams({ category, range, season: String(season), ...overrides });
    return `/leaders?${next.toString()}`;
  };

  return (
    <div>
      <PageHeader
        title="Season Stats Leaders"
        subtitle={`${season} regular season${season !== latestSeason ? "" : " (current)"}`}
      />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1">
          {STAT_CATEGORIES.map((c) => (
            <Link
              key={c.key}
              href={linkFor({ category: c.key })}
              className={`rounded px-2.5 py-1 text-xs ${
                category === c.key
                  ? "bg-white/10 text-[var(--foreground)]"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {c.label}
            </Link>
          ))}
        </div>
        <div className="flex gap-1 self-start rounded border border-[var(--border)] p-0.5">
          {TIME_RANGES.map((r) => (
            <Link
              key={r.key}
              href={linkFor({ range: r.key })}
              className={`rounded px-2.5 py-1 text-xs ${
                range === r.key
                  ? "bg-white/10 text-[var(--foreground)]"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {r.label}
            </Link>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">No data for {season} yet.</p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-[11px] uppercase tracking-wide text-[var(--muted)]">
              <th className="py-2 pr-3 font-normal">#</th>
              <th className="py-2 pr-3 font-normal">Player</th>
              <th className="py-2 pr-3 font-normal">Team</th>
              <th className="py-2 pr-3 text-right font-normal">{categoryLabel}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.playerId} className="border-b border-[var(--border)]/60">
                <td className="py-2.5 pr-3 text-[var(--muted)]">{i + 1}</td>
                <td className="py-2.5 pr-3">
                  <PlayerLink id={row.playerId} name={row.playerName} teamId={row.teamId} />
                  <span className="ml-2 text-xs text-[var(--muted)]">{row.position}</span>
                </td>
                <td className="py-2.5 pr-3">
                  <TeamBadge teamId={row.teamId} />
                </td>
                <td className="py-2.5 pr-3 text-right tabular-nums">
                  {row.value.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                  <TrendArrow direction={row.trend.direction} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p className="mt-4 text-xs text-[var(--muted)]">
        Arrows appear only when a player&apos;s last 3 games differ significantly from their
        season baseline (z-score threshold, see <code>lib/trend.ts</code>) — not every row gets
        one.
      </p>
    </div>
  );
}
