import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { PlayerLink } from "@/components/PlayerLink";
import { TeamBadge } from "@/components/TeamBadge";
import { getLatestStatsSeason } from "@/lib/data/season";
import { getUsageMovers, USAGE_METRICS, UsageMetric, UsageMoverRow } from "@/lib/data/usageTrends";

export const dynamic = "force-dynamic";

function isUsageMetric(value: string | undefined): value is UsageMetric {
  return USAGE_METRICS.some((m) => m.key === value);
}

export default async function UsageTrendsPage({
  searchParams,
}: {
  searchParams: Promise<{ metric?: string }>;
}) {
  const params = await searchParams;
  const metric: UsageMetric = isUsageMetric(params.metric) ? params.metric : "target_share";
  const season = await getLatestStatsSeason();
  const { risers, fallers } = await getUsageMovers(season, metric);
  const label = USAGE_METRICS.find((m) => m.key === metric)?.label;

  return (
    <div>
      <PageHeader
        title="Snap Count / Usage Trends"
        subtitle={`${season} season · players whose last 3 games differ significantly from their season baseline`}
      />

      <div className="mb-6 flex flex-wrap gap-1">
        {USAGE_METRICS.map((m) => (
          <Link
            key={m.key}
            href={`/usage-trends?metric=${m.key}`}
            className={`rounded px-2.5 py-1 text-xs ${
              metric === m.key
                ? "bg-white/10 text-[var(--foreground)]"
                : "text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            {m.label}
          </Link>
        ))}
      </div>

      <div className="grid gap-8 sm:grid-cols-2">
        <section>
          <h2 className="mb-2 text-xs uppercase tracking-wide text-[var(--accent-up)]">
            Rising — {label}
          </h2>
          <MoverList rows={risers} />
        </section>
        <section>
          <h2 className="mb-2 text-xs uppercase tracking-wide text-[var(--accent-down)]">
            Falling — {label}
          </h2>
          <MoverList rows={fallers} />
        </section>
      </div>

      <p className="mt-6 text-xs text-[var(--muted)]">
        Route participation isn&apos;t included — it needs charting data (routes run per pass
        play) that isn&apos;t available from free sources; nflverse&apos;s free FTN charting data
        covers play-level context (motion, play action, blitzers) but not per-player routes.
      </p>
    </div>
  );
}

function MoverList({ rows }: { rows: UsageMoverRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-[var(--muted)]">No significant movers this season.</p>;
  }
  return (
    <ol className="space-y-1.5 text-sm">
      {rows.slice(0, 15).map((r, i) => (
        <li key={r.playerId} className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <span className="w-4 text-[var(--muted)]">{i + 1}</span>
            <TeamBadge teamId={r.teamId} />
            <PlayerLink id={r.playerId} name={r.playerName} teamId={r.teamId} />
            <span className="text-xs text-[var(--muted)]">{r.position}</span>
          </span>
          <span className="tabular-nums text-xs text-[var(--muted)]">
            {(r.baselineAvg * 100).toFixed(0)}% → {(r.recentAvg * 100).toFixed(0)}%
          </span>
        </li>
      ))}
    </ol>
  );
}
