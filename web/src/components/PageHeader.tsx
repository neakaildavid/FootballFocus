import { AmbientGlow } from "@/components/AmbientGlow";

export function PageHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="relative mb-8 border-b border-[var(--border)] pb-5">
      <AmbientGlow className="-top-8 left-0 h-24 w-52" animate={false} />
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      {subtitle && <p className="mt-1.5 text-sm text-[var(--muted)]">{subtitle}</p>}
    </div>
  );
}
