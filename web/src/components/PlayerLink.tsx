import Link from "next/link";
import { CSSProperties } from "react";
import { getTeam } from "@/lib/teams";
import { rgba } from "@/lib/color";

/**
 * Every leaderboard/table mention of a player links to their player page and
 * carries their team's subtle glow accent on hover, per the visual design
 * spec (glow used sparingly, not solid color fills).
 */
export function PlayerLink({
  id,
  name,
  teamId,
}: {
  id: string;
  name: string;
  teamId: string;
}) {
  const team = getTeam(teamId);
  const glowVars = team
    ? ({
        "--glow-strong": rgba(team.color, 0.5),
        "--glow-soft": rgba(team.color, 0.28),
      } as CSSProperties)
    : undefined;

  return (
    <Link
      href={`/players/${id}`}
      className="glow-on-hover-text underline decoration-[var(--border)] underline-offset-4 hover:decoration-transparent"
      style={glowVars}
    >
      {name}
    </Link>
  );
}
