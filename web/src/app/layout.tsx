import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { NavBar } from "@/components/NavBar";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Football Focus",
  description: "A minimalist, data-driven hub for NFL offensive player and team statistics.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`h-full ${geistSans.variable}`}>
      <body className="min-h-full flex flex-col antialiased">
        <NavBar />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
        <footer className="border-t border-[var(--border)] px-4 py-6 text-center text-sm text-[var(--muted)]">
          Data via nflverse / nfl_data_py. &quot;Focus Grade&quot; is our own metric, not affiliated with PFF.
        </footer>
      </body>
    </html>
  );
}
