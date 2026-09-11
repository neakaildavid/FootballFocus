import { PageHeader } from "@/components/PageHeader";
import { ComingSoon } from "@/components/ComingSoon";

export default function LastWeekPage() {
  return (
    <div>
      <PageHeader
        title="Last Week"
        subtitle="Refreshes every Tuesday after Monday Night Football."
      />
      <div className="grid gap-6 sm:grid-cols-2">
        <Section title="Top Hub Grades">
          <ComingSoon phase="build step 5 (Hub Grade model)" />
        </Section>
        <Section title="Top 5 Stat Leaders">
          <ComingSoon phase="build step 5" />
        </Section>
        <Section title="Best Fantasy Performances (PPR)">
          <ComingSoon phase="build step 5" />
        </Section>
        <Section title="Full Scores & Results">
          <ComingSoon phase="build step 5" />
        </Section>
        <Section title="Notable Performances">
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
