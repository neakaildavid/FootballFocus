import { PageHeader } from "@/components/PageHeader";
import { ComingSoon } from "@/components/ComingSoon";

export default function SuperBowlPage() {
  return (
    <div>
      <PageHeader
        title="Super Bowl Odds"
        subtitle="Statistically-driven favorite projections from the power-ranking model plus remaining strength of schedule and playoff seeding implications."
      />
      <ComingSoon phase="build step 6" />
    </div>
  );
}
