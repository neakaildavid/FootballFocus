// Small color utilities backing the team-color "glow" accent used throughout
// the UI (see globals.css .glow / .glow-hover classes). Kept dependency-free.

export function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const full = clean.length === 3
    ? clean.split("").map((c) => c + c).join("")
    : clean;
  const num = parseInt(full, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

export function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Inline style producing a soft glow in a team's color. Used sparingly, per
 * the design spec: player names, badges, and stat rows tied to a team, glow
 * on hover or on key elements rather than everywhere at once.
 */
export function glowStyle(color: string, opts: { text?: boolean; strength?: number } = {}) {
  const strength = opts.strength ?? 1;
  const soft = rgba(color, 0.55 * strength);
  const softer = rgba(color, 0.3 * strength);
  return opts.text
    ? { textShadow: `0 0 8px ${soft}, 0 0 18px ${softer}` }
    : { boxShadow: `0 0 10px ${soft}, 0 0 24px ${softer}` };
}
