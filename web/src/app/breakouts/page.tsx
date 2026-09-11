import { PageHeader } from "@/components/PageHeader";
import { ComingSoon } from "@/components/ComingSoon";

export default function BreakoutsPage() {
  return (
    <div>
      <PageHeader
        title="Rookie / Breakout Tracker"
        subtitle="Rookies and second-year players whose recent-weeks performance or usage trend significantly exceeds their baseline."
      />
      <ComingSoon phase="build step 7 (reuses lib/trend.ts)" />
    </div>
  );
}
