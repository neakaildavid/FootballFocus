import Link from "next/link";
import { CSSProperties } from "react";
import { getTeam } from "@/lib/teams";
import { rgba } from "@/lib/color";

export function TeamBadge({ teamId, size = "sm" }: { teamId: string; size?: "sm" | "md" }) {
  const team = getTeam(teamId);
  if (!team) return null;
  const dims = size === "sm" ? "h-5 w-5 text-[10px]" : "h-8 w-8 text-xs";
  const glowVars = {
    "--glow-strong": rgba(team.color, 0.55),
    "--glow-soft": rgba(team.color, 0.3),
  } as CSSProperties;

  return (
    <Link
      href={`/teams/${team.id}`}
      title={`${team.city} ${team.name}`}
      className={`glow-on-hover inline-flex ${dims} items-center justify-center rounded-full border border-[var(--border)] shrink-0 font-bold`}
      style={{ color: team.color, ...glowVars }}
    >
      {team.abbr}
    </Link>
  );
}
