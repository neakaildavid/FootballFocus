import Link from "next/link";
import { NAV_ITEMS } from "@/lib/nav";

export default function Home() {
  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Football Focus</h1>
        <p className="mt-3 max-w-xl text-base text-[var(--muted)]">
          A minimalist, data-driven stat hub for NFL offensive players and teams — real box
          scores, efficiency grades, and power rankings, refreshed automatically every week.
        </p>
      </div>

      <nav className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="glow-on-hover rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 py-4 transition-colors hover:bg-white/[0.03]"
            style={
              {
                "--glow-strong": "rgba(242,241,236,0.15)",
                "--glow-soft": "rgba(242,241,236,0.06)",
              } as React.CSSProperties
            }
          >
            <div className="text-base font-medium">{item.label}</div>
          </Link>
        ))}
      </nav>

      <p className="text-sm text-[var(--muted)]">
        Press <kbd className="rounded-md border border-[var(--border)] px-1.5 py-0.5">⌘K</kbd>{" "}
        anywhere to jump straight to a player or team.
      </p>
    </div>
  );
}
