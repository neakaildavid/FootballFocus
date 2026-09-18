export function ComingSoon({ phase, children }: { phase: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--border)] px-4 py-10 text-center text-sm text-[var(--muted)]">
      <p>
        This section is scaffolded with placeholder data. Real data + logic lands in{" "}
        <span className="text-[var(--foreground)]">{phase}</span>.
      </p>
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}
