import { PageHeader } from "@/components/PageHeader";
import { ComingSoon } from "@/components/ComingSoon";

export default function UpcomingWeekPage() {
  return (
    <div>
      <PageHeader
        title="Upcoming Week"
        subtitle="Schedule, win probabilities, and matchup-adjusted projections. Refreshes every Tuesday."
      />
      <div className="grid gap-6 sm:grid-cols-2">
        <Section title="Schedule & Win Probability">
          <ComingSoon phase="build step 5 (The Odds API integration)" />
        </Section>
        <Section title="Projected Fantasy Leaders">
          <ComingSoon phase="build step 5" />
        </Section>
        <Section title="Strength of Matchup">
          <ComingSoon phase="build step 5" />
        </Section>
        <Section title="Pre-game Context">
          <ComingSoon phase="build step 5" />
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
