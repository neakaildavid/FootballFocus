"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import Fuse from "fuse.js";
import { TEAMS } from "@/lib/teams";
import { MOCK_PLAYERS } from "@/lib/mock/players";

interface SearchEntry {
  id: string;
  label: string;
  sub: string;
  href: string;
}

function buildIndex(): SearchEntry[] {
  const teamEntries: SearchEntry[] = TEAMS.map((t) => ({
    id: `team-${t.id}`,
    label: `${t.city} ${t.name}`,
    sub: `Team · ${t.abbr}`,
    href: `/teams/${t.id}`,
  }));
  const playerEntries: SearchEntry[] = MOCK_PLAYERS.map((p) => ({
    id: `player-${p.id}`,
    label: p.name,
    sub: `${p.position} · ${p.teamId.toUpperCase()}`,
    href: `/players/${p.id}`,
  }));
  return [...playerEntries, ...teamEntries];
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();

  const index = useMemo(() => buildIndex(), []);
  const fuse = useMemo(
    () => new Fuse(index, { keys: ["label", "sub"], threshold: 0.35 }),
    [index]
  );

  const results = useMemo(() => {
    if (!query.trim()) return index.slice(0, 8);
    return fuse.search(query).map((r) => r.item).slice(0, 8);
  }, [query, fuse, index]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  function go(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Search players and teams"
        className="glow-on-hover flex items-center gap-2 rounded border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
        style={{ "--glow-strong": "rgba(242,241,236,0.25)", "--glow-soft": "rgba(242,241,236,0.12)" } as React.CSSProperties}
      >
        <span aria-hidden>⌕</span>
        <span className="hidden sm:inline">Search players, teams…</span>
        <kbd className="ml-1 hidden rounded border border-[var(--border)] px-1.5 py-0.5 text-[10px] sm:inline">
          ⌘K
        </kbd>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 pt-[12vh]"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-lg mx-4 rounded-md border border-[var(--border)] bg-[var(--surface)] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <Command shouldFilter={false} className="font-mono">
              <div className="flex items-center border-b border-[var(--border)] px-3">
                <span className="mr-2 text-[var(--muted)]" aria-hidden>⌕</span>
                <Command.Input
                  autoFocus
                  value={query}
                  onValueChange={setQuery}
                  placeholder="Jump to a player or team…"
                  className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-[var(--muted)]"
                />
                <kbd className="text-[10px] text-[var(--muted)] border border-[var(--border)] rounded px-1.5 py-0.5">
                  esc
                </kbd>
              </div>
              <Command.List className="max-h-80 overflow-y-auto p-1">
                <Command.Empty className="px-3 py-6 text-center text-sm text-[var(--muted)]">
                  No results.
                </Command.Empty>
                {results.map((r) => (
                  <Command.Item
                    key={r.id}
                    value={r.id}
                    onSelect={() => go(r.href)}
                    className="flex cursor-pointer items-center justify-between rounded px-3 py-2 text-sm data-[selected=true]:bg-white/5"
                  >
                    <span>{r.label}</span>
                    <span className="text-xs text-[var(--muted)]">{r.sub}</span>
                  </Command.Item>
                ))}
              </Command.List>
            </Command>
          </div>
        </div>
      )}
    </>
  );
}
