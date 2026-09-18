import Link from "next/link";
import Image from "next/image";
import { PageHeader } from "@/components/PageHeader";
import { TEAMS, getTeamLogoUrl } from "@/lib/teams";

const DIVISIONS = ["East", "North", "South", "West"] as const;

export default function TeamsIndexPage() {
  return (
    <div>
      <PageHeader title="Teams" subtitle="All 32 teams, offense-focused." />
      {(["AFC", "NFC"] as const).map((conf) => (
        <div key={conf} className="mb-8">
          <h2 className="mb-3 text-xs uppercase tracking-wide text-[var(--muted)]">{conf}</h2>
          <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
            {DIVISIONS.map((div) => (
              <div key={div}>
                <h3 className="mb-2 text-xs uppercase tracking-wide text-[var(--muted)]">
                  {div}
                </h3>
                <ul className="space-y-2">
                  {TEAMS.filter((t) => t.conference === conf && t.division === div).map((t) => (
                    <li key={t.id}>
                      <Link
                        href={`/teams/${t.id}`}
                        className="glow-on-hover-text flex items-center gap-2 text-sm"
                        style={
                          {
                            "--glow-strong": `${t.color}80`,
                            "--glow-soft": `${t.color}40`,
                          } as React.CSSProperties
                        }
                      >
                        <Image
                          src={getTeamLogoUrl(t.id)}
                          alt=""
                          width={20}
                          height={20}
                          className="object-contain"
                        />
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
