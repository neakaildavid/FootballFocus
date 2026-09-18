import Link from "next/link";
import Image from "next/image";
import { CSSProperties } from "react";
import { getTeam, getTeamLogoUrl } from "@/lib/teams";
import { rgba } from "@/lib/color";

export function TeamBadge({ teamId, size = "sm" }: { teamId: string; size?: "sm" | "md" }) {
  const team = getTeam(teamId);
  if (!team) return null;
  const px = size === "sm" ? 24 : 40;
  const glowVars = {
    "--glow-strong": rgba(team.color, 0.65),
    "--glow-soft": rgba(team.color, 0.35),
  } as CSSProperties;

  return (
    <Link
      href={`/teams/${team.id}`}
      title={`${team.city} ${team.name}`}
      className="glow-on-hover-logo inline-flex shrink-0 items-center justify-center"
      style={glowVars}
    >
      <Image
        src={getTeamLogoUrl(team.id)}
        alt={`${team.city} ${team.name} logo`}
        width={px}
        height={px}
        className="object-contain"
      />
    </Link>
  );
}
