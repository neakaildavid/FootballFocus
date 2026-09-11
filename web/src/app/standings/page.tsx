import { PageHeader } from "@/components/PageHeader";
import { ComingSoon } from "@/components/ComingSoon";

export default function StandingsPage() {
  return (
    <div>
      <PageHeader
        title="Standings & Power Rankings"
        subtitle="Live division/conference standings plus a weighted composite power-ranking model (not win-loss only)."
      />
      <div className="grid gap-6 sm:grid-cols-2">
        <Section title="Division & Conference Standings">
          <ComingSoon phase="build step 6" />
        </Section>
        <Section title="Power Rankings">
          <ComingSoon phase="build step 6 (see /pipeline/power_rankings.py for the weighting formula, once built)" />
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
