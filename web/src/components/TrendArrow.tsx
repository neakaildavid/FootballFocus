import { TrendDirection } from "@/lib/trend";

export function TrendArrow({ direction }: { direction: TrendDirection }) {
  if (direction === "none") return null;
  const up = direction === "up";
  return (
    <span
      aria-label={up ? "trending up" : "trending down"}
      title={up ? "trending up" : "trending down"}
      className={`inline-block ml-1.5 text-xs align-middle ${
        up ? "text-[var(--accent-up)]" : "text-[var(--accent-down)]"
      }`}
    >
      {up ? "▲" : "▼"}
    </span>
  );
}
