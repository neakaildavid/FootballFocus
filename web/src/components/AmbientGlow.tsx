/**
 * A soft, blurred color blob used as decoration behind hero/header content.
 * Positioned absolutely by the caller via `className`; stays at a negative
 * z-index so it never competes with text contrast. `animate` gives it a
 * slow drift — left on for hero moments, off for repeated per-page chrome
 * (PageHeader) so it doesn't distract on every navigation.
 */
export function AmbientGlow({
  className = "",
  color = "rgba(244,241,236,0.35)",
  animate = true,
}: {
  className?: string;
  color?: string;
  animate?: boolean;
}) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute -z-10 rounded-full blur-[70px] ${
        animate ? "ambient-glow" : "opacity-[0.3]"
      } ${className}`}
      style={{ background: color }}
    />
  );
}
