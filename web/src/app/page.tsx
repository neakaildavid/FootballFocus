import Link from "next/link";
import {
  Trophy,
  CalendarClock,
  CalendarDays,
  ListOrdered,
  Crown,
  TrendingUp,
  Rocket,
  Shield,
  LucideIcon,
} from "lucide-react";
import { AmbientGlow } from "@/components/AmbientGlow";
import { staggerDelay } from "@/lib/style";
import { getLatestStatsSeason } from "@/lib/data/season";

export const dynamic = "force-dynamic";

const FEATURES: {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
}[] = [
  {
    href: "/leaders",
    label: "Season Leaders",
    description: "Real box-score leaders across every offensive stat, full season or trailing weeks.",
    icon: Trophy,
  },
  {
    href: "/last-week",
    label: "Last Week",
    description: "Top Focus Grades, fantasy performances, and full results from the last completed week.",
    icon: CalendarClock,
  },
  {
    href: "/this-week",
    label: "This Week",
    description: "Every matchup on the board, win probability, and injury designations.",
    icon: CalendarDays,
  },
  {
    href: "/standings",
    label: "Standings & Power Rankings",
    description: "Division standings plus our own EPA-driven composite power ranking.",
    icon: ListOrdered,
  },
  {
    href: "/super-bowl",
    label: "Super Bowl Odds",
    description: "Implied championship odds derived straight from the Power Rankings model.",
    icon: Crown,
  },
  {
    href: "/usage-trends",
    label: "Usage Trends",
    description: "Snap share and target share risers and fallers vs. season baseline.",
    icon: TrendingUp,
  },
  {
    href: "/breakouts",
    label: "Breakout Tracker",
    description: "Rookies and 2nd-year players trending well above their own baseline.",
    icon: Rocket,
  },
  {
    href: "/teams",
    label: "Teams",
    description: "All 32 teams — rosters, schedules, and offensive tendencies.",
    icon: Shield,
  },
];

export default async function Home() {
  const season = await getLatestStatsSeason();

  return (
    <div className="flex flex-col gap-14">
      <div className="relative pt-2 pb-2">
        <AmbientGlow className="-top-20 -left-20 h-72 w-72" color="rgba(62,207,114,0.2)" />
        <AmbientGlow className="-top-8 right-0 h-64 w-64" color="rgba(244,241,236,0.14)" />

        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)]">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--accent-up)] opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--accent-up)]" />
          </span>
          Live for the {season} season
        </div>

        <h1
          className="glow-static-text text-4xl font-bold tracking-tight sm:text-5xl"
          style={
            {
              "--glow-strong": "rgba(244,241,236,0.45)",
              "--glow-soft": "rgba(244,241,236,0.2)",
            } as React.CSSProperties
          }
        >
          Football<span className="text-[var(--muted)]"> Focus</span>
        </h1>
        <p className="mt-4 max-w-xl text-base text-[var(--muted)]">
          A minimalist, data-driven stat hub for NFL offensive players and teams — real box
          scores, efficiency grades, and power rankings, refreshed automatically every 6 hours.
        </p>
      </div>

      <nav className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((item, i) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="glow-on-hover card-hover press-feedback stagger-item group rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"
              style={
                {
                  "--glow-strong": "rgba(242,241,236,0.15)",
                  "--glow-soft": "rgba(242,241,236,0.06)",
                  ...staggerDelay(i),
                } as React.CSSProperties
              }
            >
              <Icon
                className="mb-4 h-6 w-6 text-[var(--muted)] transition-colors duration-200 group-hover:text-[var(--foreground)]"
                strokeWidth={1.5}
                aria-hidden
              />
              <div className="text-base font-medium">{item.label}</div>
              <p className="mt-1.5 text-sm leading-relaxed text-[var(--muted)]">{item.description}</p>
            </Link>
          );
        })}
      </nav>

      <p className="text-sm text-[var(--muted)]">
        Press <kbd className="rounded-md border border-[var(--border)] px-1.5 py-0.5">⌘K</kbd>{" "}
        anywhere to jump straight to a player or team.
      </p>
    </div>
  );
}
