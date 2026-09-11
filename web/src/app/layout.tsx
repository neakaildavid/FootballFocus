import type { Metadata } from "next";
import "./globals.css";
import { NavBar } from "@/components/NavBar";

export const metadata: Metadata = {
  title: "NFL Offense Stats Hub",
  description: "A minimalist, data-driven hub for NFL offensive player and team statistics.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col antialiased">
        <NavBar />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
        <footer className="border-t border-[var(--border)] px-4 py-6 text-center text-[11px] text-[var(--muted)]">
          Data via nflverse / nfl_data_py. &quot;Hub Grade&quot; is our own metric, not affiliated with PFF.
        </footer>
      </body>
    </html>
  );
}
