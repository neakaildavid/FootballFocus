import { PageHeader } from "@/components/PageHeader";
import { TeamBadge } from "@/components/TeamBadge";
import { getLatestStatsSeason } from "@/lib/data/season";
import { getStandings } from "@/lib/data/standings";
import { getLatestPowerRankings } from "@/lib/data/powerRankings";
import { TEAMS, Conference, Division } from "@/lib/teams";

export const dynamic = "force-dynamic";

const DIVISIONS: Division[] = ["East", "North", "South", "West"];
const CONFERENCES: Conference[] = ["AFC", "NFC"];

export default async function StandingsPage() {
  const season = await getLatestStatsSeason();
  const [standings, rankings] = await Promise.all([
    getStandings(season),
    getLatestPowerRankings(season),
  ]);

  const standingsByTeam = new Map(standings.map((s) => [s.teamId, s]));

  return (
    <div>
      <PageHeader title="Standings & Power Rankings" subtitle={`${season} season`} />

      <section className="mb-10">
        <h2 className="mb-3 text-xs uppercase tracking-wide text-[var(--muted)]">Standings</h2>
        {CONFERENCES.map((conf) => (
          <div key={conf} className="mb-6">
            <h3 className="mb-2 text-xs uppercase tracking-wide text-[var(--muted)]">{conf}</h3>
            <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
              {DIVISIONS.map((div) => {
                const teams = TEAMS.filter((t) => t.conference === conf && t.division === div)
                  .map((t) => ({ team: t, s: standingsByTeam.get(t.id) }))
                  .filter((x) => x.s)
                  .sort((a, b) => (b.s!.wins - b.s!.losses) - (a.s!.wins - a.s!.losses));
                if (teams.length === 0) return null;
                return (
                  <div key={div}>
                    <h4 className="mb-1 text-xs uppercase tracking-wide text-[var(--muted)]">{div}</h4>
                    <table className="w-full text-xs">
                      <tbody>
                        {teams.map(({ team, s }) => (
                          <tr key={team.id} className="border-b border-[var(--border)]/60">
                            <td className="py-1.5 pr-2">
                              <span className="flex items-center gap-1.5">
                                <TeamBadge teamId={team.id} />
                                {team.abbr}
                              </span>
                            </td>
                            <td className="py-1.5 pr-2 text-right tabular-nums text-[var(--muted)]">
                              {s!.wins}-{s!.losses}
                              {s!.ties > 0 ? `-${s!.ties}` : ""}
                            </td>
                            <td className="py-1.5 text-right tabular-nums text-[var(--muted)]">{s!.streak}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      <section>
        <h2 className="mb-1 text-xs uppercase tracking-wide text-[var(--muted)]">Power Rankings</h2>
        <p className="mb-3 text-xs text-[var(--muted)]">
          Our own weighted composite of season-to-date point differential, offensive/defensive EPA
          per play, net yards per play, red zone efficiency, turnover margin, and strength of
          schedule — each z-scored against the rest of the league. Not a win-loss ranking.
        </p>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-[var(--muted)]">
              <th className="py-2 pr-3 font-normal">#</th>
              <th className="py-2 pr-3 font-normal">Team</th>
              <th className="py-2 pr-3 text-right font-normal">Score</th>
              <th className="py-2 pr-3 text-right font-normal hidden sm:table-cell">Pt Diff</th>
              <th className="py-2 pr-3 text-right font-normal hidden sm:table-cell">EPA Off</th>
              <th className="py-2 pr-3 text-right font-normal hidden sm:table-cell">EPA Def</th>
            </tr>
          </thead>
          <tbody>
            {rankings.map((r) => {
              const s = standingsByTeam.get(r.teamId);
              return (
                <tr key={r.teamId} className="border-b border-[var(--border)]/60">
                  <td className="py-2 pr-3 text-[var(--muted)]">{r.rank}</td>
                  <td className="py-2 pr-3">
                    <span className="flex items-center gap-2">
                      <TeamBadge teamId={r.teamId} />
                      {r.teamId.toUpperCase()}
                      {s && (
                        <span className="text-xs text-[var(--muted)]">
                          {s.wins}-{s.losses}
                          {s.ties > 0 ? `-${s.ties}` : ""}
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">{r.compositeScore.toFixed(2)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-[var(--muted)] hidden sm:table-cell">
                    {r.pointDiffZ?.toFixed(2) ?? "—"}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-[var(--muted)] hidden sm:table-cell">
                    {r.epaOffenseZ?.toFixed(2) ?? "—"}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-[var(--muted)] hidden sm:table-cell">
                    {r.epaDefenseZ?.toFixed(2) ?? "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
