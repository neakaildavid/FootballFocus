import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { TEAMS } from "@/lib/teams";

const DIVISIONS = ["East", "North", "South", "West"] as const;

export default function TeamsIndexPage() {
  return (
    <div>
      <PageHeader title="Teams" subtitle="All 32 teams, offense-focused." />
      {(["AFC", "NFC"] as const).map((conf) => (
        <div key={conf} className="mb-8">
          <h2 className="mb-3 text-xs uppercase tracking-wide text-[var(--muted)]">{conf}</h2>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
            {DIVISIONS.map((div) => (
              <div key={div}>
                <h3 className="mb-1.5 text-[10px] uppercase tracking-wide text-[var(--muted)]">
                  {div}
                </h3>
                <ul className="space-y-1">
                  {TEAMS.filter((t) => t.conference === conf && t.division === div).map((t) => (
                    <li key={t.id}>
                      <Link
                        href={`/teams/${t.id}`}
                        className="glow-on-hover-text text-sm"
                        style={
                          {
                            "--glow-strong": `${t.color}80`,
                            "--glow-soft": `${t.color}40`,
                          } as React.CSSProperties
                        }
                      >
                        {t.city} {t.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
