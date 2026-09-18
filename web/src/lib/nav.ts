export interface NavItem {
  href: string;
  label: string;
  short: string; // used in the compact/mobile nav
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/leaders", label: "Season Leaders", short: "Leaders" },
  { href: "/last-week", label: "Last Week", short: "Last Wk" },
  { href: "/this-week", label: "This Week", short: "This Wk" },
  { href: "/standings", label: "Standings & Power Rankings", short: "Standings" },
  { href: "/super-bowl", label: "Super Bowl Odds", short: "Super Bowl" },
  { href: "/usage-trends", label: "Usage Trends", short: "Usage" },
  { href: "/breakouts", label: "Breakout Tracker", short: "Breakouts" },
  { href: "/teams", label: "Teams", short: "Teams" },
];
