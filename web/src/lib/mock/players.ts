// Placeholder player data for scaffolding UI before the real data pipeline
// (see /pipeline and build-order step 3) is wired up. Shapes mirror the
// eventual DB-backed API response so swapping the data source later is a
// drop-in replacement, not a rewrite.

export type Position = "QB" | "RB" | "WR" | "TE";

export interface PlayerSummary {
  id: string; // slug, e.g. "patrick-mahomes"
  name: string;
  position: Position;
  teamId: string; // matches Team.id in lib/teams.ts
  jersey: number;
}

export const MOCK_PLAYERS: PlayerSummary[] = [
  { id: "patrick-mahomes", name: "Patrick Mahomes", position: "QB", teamId: "kc", jersey: 15 },
  { id: "josh-allen", name: "Josh Allen", position: "QB", teamId: "buf", jersey: 17 },
  { id: "lamar-jackson", name: "Lamar Jackson", position: "QB", teamId: "bal", jersey: 8 },
  { id: "ja-marr-chase", name: "Ja'Marr Chase", position: "WR", teamId: "cin", jersey: 1 },
  { id: "ceedee-lamb", name: "CeeDee Lamb", position: "WR", teamId: "dal", jersey: 88 },
  { id: "tyreek-hill", name: "Tyreek Hill", position: "WR", teamId: "mia", jersey: 10 },
  { id: "christian-mccaffrey", name: "Christian McCaffrey", position: "RB", teamId: "sf", jersey: 23 },
  { id: "bijan-robinson", name: "Bijan Robinson", position: "RB", teamId: "atl", jersey: 7 },
  { id: "travis-kelce", name: "Travis Kelce", position: "TE", teamId: "kc", jersey: 87 },
  { id: "sam-laporta", name: "Sam LaPorta", position: "TE", teamId: "det", jersey: 87 },
];
