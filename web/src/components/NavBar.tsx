"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { NAV_ITEMS } from "@/lib/nav";
import { CommandPalette } from "@/components/CommandPalette";

export function NavBar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--background)]/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <Link
          href="/"
          className="press-feedback shrink-0 text-base font-bold tracking-tight transition-opacity duration-200 hover:opacity-80"
        >
          Football<span className="text-[var(--muted)]"> Focus</span>
        </Link>

        <nav className="hidden flex-1 items-center gap-1 overflow-x-auto lg:flex">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || pathname?.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`press-feedback whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-colors duration-200 ${
                  active
                    ? "text-[var(--foreground)] bg-white/[0.06]"
                    : "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-white/[0.03]"
                }`}
              >
                {item.short}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <CommandPalette />
          <button
            aria-label="Toggle menu"
            onClick={() => setMobileOpen((v) => !v)}
            className="press-feedback rounded-lg border border-[var(--border)] px-2.5 py-2 text-sm transition-colors duration-200 hover:bg-white/[0.06] lg:hidden"
          >
            {mobileOpen ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <nav className="stagger-item flex flex-col gap-0.5 border-t border-[var(--border)] px-4 py-2 lg:hidden">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className="press-feedback rounded-lg px-3 py-2.5 text-sm text-[var(--muted)] transition-colors duration-200 hover:bg-white/[0.06] hover:text-[var(--foreground)]"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
