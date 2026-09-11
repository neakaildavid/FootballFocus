"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { PlayerLink } from "@/components/PlayerLink";
import { TeamBadge } from "@/components/TeamBadge";
import { TrendArrow } from "@/components/TrendArrow";
import { classifyTrend } from "@/lib/trend";
import { MOCK_PLAYERS } from "@/lib/mock/players";
import {
  STAT_CATEGORIES,
  TIME_RANGES,
  StatCategory,
  TimeRange,
  mockLeaderboard,
} from "@/lib/mock/leaders";

export default function LeadersPage() {
  const [category, setCategory] = useState<StatCategory>("recYards");
  const [range, setRange] = useState<TimeRange>("full");

  const rows = useMemo(() => mockLeaderboard(category, range), [category, range]);
  const playersById = useMemo(
    () => Object.fromEntries(MOCK_PLAYERS.map((p) => [p.id, p])),
    []
  );

  return (
    <div>
      <PageHeader
        title="Season Stats Leaders"
        subtitle="Placeholder data — real leaderboards land once the ingestion pipeline is wired in (build step 3-4)."
      />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1">
          {STAT_CATEGORIES.map((c) => (
            <button
              key={c.key}
              onClick={() => setCategory(c.key)}
              className={`rounded px-2.5 py-1 text-xs ${
                category === c.key
                  ? "bg-white/10 text-[var(--foreground)]"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1 self-start rounded border border-[var(--border)] p-0.5">
          {TIME_RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`rounded px-2.5 py-1 text-xs ${
                range === r.key
                  ? "bg-white/10 text-[var(--foreground)]"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] text-left text-[11px] uppercase tracking-wide text-[var(--muted)]">
            <th className="py-2 pr-3 font-normal">#</th>
            <th className="py-2 pr-3 font-normal">Player</th>
            <th className="py-2 pr-3 font-normal">Team</th>
            <th className="py-2 pr-3 text-right font-normal">
              {STAT_CATEGORIES.find((c) => c.key === category)?.label}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const player = playersById[row.playerId];
            if (!player) return null;
            const trend = classifyTrend(row.zScore);
            return (
              <tr key={row.playerId} className="border-b border-[var(--border)]/60">
                <td className="py-2.5 pr-3 text-[var(--muted)]">{i + 1}</td>
                <td className="py-2.5 pr-3">
                  <PlayerLink id={player.id} name={player.name} teamId={player.teamId} />
                  <span className="ml-2 text-xs text-[var(--muted)]">{player.position}</span>
                </td>
                <td className="py-2.5 pr-3">
                  <TeamBadge teamId={player.teamId} />
                </td>
                <td className="py-2.5 pr-3 text-right tabular-nums">
                  {row.value.toLocaleString()}
                  <TrendArrow direction={trend.direction} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <p className="mt-4 text-xs text-[var(--muted)]">
        Arrows appear only when a player&apos;s recent-window rate crosses the configured
        z-score threshold vs. their baseline (see <code>lib/trend.ts</code>) — not every
        row gets one.
      </p>
    </div>
  );
}
