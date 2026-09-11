import Link from "next/link";
import { NAV_ITEMS } from "@/lib/nav";

export default function Home() {
  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">NFL Offense Stats Hub</h1>
        <p className="mt-2 max-w-xl text-sm text-[var(--muted)]">
          A minimalist, terminal-style stat hub for NFL offensive players and teams.
          Free data only, automated weekly. Scaffolding is in progress — pages below
          use placeholder data until each build step lands.
        </p>
      </div>

      <nav className="grid grid-cols-1 gap-px overflow-hidden rounded border border-[var(--border)] bg-[var(--border)] sm:grid-cols-2">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="glow-on-hover bg-[var(--background)] px-5 py-4 transition-colors hover:bg-white/[0.03]"
            style={
              {
                "--glow-strong": "rgba(242,241,236,0.15)",
                "--glow-soft": "rgba(242,241,236,0.06)",
              } as React.CSSProperties
            }
          >
            <div className="text-sm font-medium">{item.label}</div>
          </Link>
        ))}
      </nav>

      <p className="text-xs text-[var(--muted)]">
        Press <kbd className="rounded border border-[var(--border)] px-1.5 py-0.5">⌘K</kbd> anywhere
        to jump straight to a player or team.
      </p>
    </div>
  );
}
