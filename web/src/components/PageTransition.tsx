"use client";

import { usePathname } from "next/navigation";

/**
 * Remounts on every route change (keyed on pathname), which replays the
 * .page-transition fade-up defined in globals.css. A plain CSS mount
 * animation rather than React's <ViewTransition> because that API isn't
 * exposed by the React version this Next.js install resolves.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="page-transition">
      {children}
    </div>
  );
}
