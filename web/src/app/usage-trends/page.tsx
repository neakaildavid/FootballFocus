import { PageHeader } from "@/components/PageHeader";
import { ComingSoon } from "@/components/ComingSoon";

export default function UsageTrendsPage() {
  return (
    <div>
      <PageHeader
        title="Snap Count / Usage Trends"
        subtitle="Snap share, target share, carry share, and route participation over time — feeds the same trend-detection module used on Season Leaders."
      />
      <ComingSoon phase="build step 7 (reuses lib/trend.ts)" />
    </div>
  );
}
