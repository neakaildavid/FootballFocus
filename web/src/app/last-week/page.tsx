import { PageHeader } from "@/components/PageHeader";
import { PlayerLink } from "@/components/PlayerLink";
import { TeamBadge } from "@/components/TeamBadge";
import { getLatestStatsSeason } from "@/lib/data/season";
import {
  getLastWeek,
  getTopHubGrades,
  getWeeklyStatLeaders,
  getTopFantasyPerformances,
  getWeekResults,
  getNotableInjuries,
  WeeklyStatRow,
} from "@/lib/data/lastWeek";

export const dynamic = "force-dynamic";

export default async function LastWeekPage() {
  const season = await getLatestStatsSeason();
  const week = await getLastWeek(season);

  if (!week) {
    return (
      <div>
        <PageHeader title="Last Week" />
        <p className="text-sm text-[var(--muted)]">No completed games on record yet.</p>
      </div>
    );
  }

  const [hubGrades, statLeaders, fantasy, results, injuries] = await Promise.all([
    getTopHubGrades(season, week),
    getWeeklyStatLeaders(season, week),
    getTopFantasyPerformances(season, week),
    getWeekResults(season, week),
    getNotableInjuries(season, week),
  ]);

  return (
    <div>
      <PageHeader
        title="Last Week"
        subtitle={`${season} · Week ${week}`}
      />
      <div className="grid gap-8 sm:grid-cols-2">
        <Section title="Top Hub Grades">
          <ol className="space-y-1.5 text-sm">
            {hubGrades.map((g, i) => (
              <li key={g.playerId} className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="w-4 text-[var(--muted)]">{i + 1}</span>
                  <TeamBadge teamId={g.teamId} />
                  <PlayerLink id={g.playerId} name={g.playerName} teamId={g.teamId} />
                  <span className="text-xs text-[var(--muted)]">{g.position}</span>
                </span>
                <span className="tabular-nums">{g.grade.toFixed(1)}</span>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-[11px] text-[var(--muted)]">
            Our own 0-100 efficiency grade, not PFF&apos;s — rewards per-play efficiency, so a
            low-volume big-play game can outscore a compiler day.
          </p>
        </Section>

        <Section title="Best Fantasy Performances (PPR)">
          <StatList rows={fantasy} suffix=" pts" decimals={1} />
        </Section>

        <Section title="Top Stat Leaders">
          <div className="space-y-4">
            <div>
              <h3 className="mb-1 text-[11px] text-[var(--muted)]">Passing Yards</h3>
              <StatList rows={statLeaders.passYards} compact />
            </div>
            <div>
              <h3 className="mb-1 text-[11px] text-[var(--muted)]">Rushing Yards</h3>
              <StatList rows={statLeaders.rushYards} compact />
            </div>
            <div>
              <h3 className="mb-1 text-[11px] text-[var(--muted)]">Receiving Yards</h3>
              <StatList rows={statLeaders.recYards} compact />
            </div>
          </div>
        </Section>

        <Section title="Full Scores & Results">
          <ul className="space-y-1.5 text-sm">
            {results.map((g) => (
              <li key={g.gameId} className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <TeamBadge teamId={g.awayTeamId} />
                  <span className="text-[var(--muted)]">@</span>
                  <TeamBadge teamId={g.homeTeamId} />
                </span>
                <span className="tabular-nums">
                  {g.awayScore}-{g.homeScore}
                </span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Notable Injuries">
          {injuries.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No notable injury designations that week.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {injuries.map((inj) => (
                <li key={inj.playerId} className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <TeamBadge teamId={inj.teamId} />
                    <PlayerLink id={inj.playerId} name={inj.playerName} teamId={inj.teamId} />
                  </span>
                  <span className="text-xs text-[var(--muted)]">
                    {inj.status}
                    {inj.description ? ` · ${inj.description}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-xs uppercase tracking-wide text-[var(--muted)]">{title}</h2>
      {children}
    </section>
  );
}

function StatList({
  rows,
  suffix = "",
  decimals = 0,
  compact = false,
}: {
  rows: WeeklyStatRow[];
  suffix?: string;
  decimals?: number;
  compact?: boolean;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-[var(--muted)]">No qualifying performances.</p>;
  }
  return (
    <ol className={`space-y-1 ${compact ? "text-xs" : "text-sm"}`}>
      {rows.map((r, i) => (
        <li key={r.playerId} className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <span className="w-4 text-[var(--muted)]">{i + 1}</span>
            <TeamBadge teamId={r.teamId} size="sm" />
            <PlayerLink id={r.playerId} name={r.playerName} teamId={r.teamId} />
          </span>
          <span className="tabular-nums">
            {r.value.toLocaleString(undefined, { maximumFractionDigits: decimals })}
            {suffix}
          </span>
        </li>
      ))}
    </ol>
  );
}
