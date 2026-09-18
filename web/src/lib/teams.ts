// Static team reference data: identity + brand color used for the glow accent.
// This is metadata only (names/abbreviations/public brand colors) — not game data.
// Real stats/rosters/schedules come from the nfl_data_py pipeline (see /pipeline).

export type Conference = "AFC" | "NFC";
export type Division = "East" | "North" | "South" | "West";

export interface Team {
  id: string; // stable slug, matches nflverse team abbreviation lowercased
  abbr: string; // nflverse-style team abbreviation, e.g. "KC"
  name: string; // full team name
  city: string;
  conference: Conference;
  division: Division;
  color: string; // primary brand color, used for glow accents
  colorSecondary: string;
}

export const TEAMS: Team[] = [
  { id: "buf", abbr: "BUF", city: "Buffalo", name: "Bills", conference: "AFC", division: "East", color: "#00338D", colorSecondary: "#C60C30" },
  { id: "mia", abbr: "MIA", city: "Miami", name: "Dolphins", conference: "AFC", division: "East", color: "#008E97", colorSecondary: "#FC4C02" },
  { id: "ne", abbr: "NE", city: "New England", name: "Patriots", conference: "AFC", division: "East", color: "#002244", colorSecondary: "#C60C30" },
  { id: "nyj", abbr: "NYJ", city: "New York", name: "Jets", conference: "AFC", division: "East", color: "#125740", colorSecondary: "#FFFFFF" },

  { id: "bal", abbr: "BAL", city: "Baltimore", name: "Ravens", conference: "AFC", division: "North", color: "#241773", colorSecondary: "#9E7C0C" },
  { id: "cin", abbr: "CIN", city: "Cincinnati", name: "Bengals", conference: "AFC", division: "North", color: "#FB4F14", colorSecondary: "#000000" },
  { id: "cle", abbr: "CLE", city: "Cleveland", name: "Browns", conference: "AFC", division: "North", color: "#FF6B00", colorSecondary: "#311D00" },
  { id: "pit", abbr: "PIT", city: "Pittsburgh", name: "Steelers", conference: "AFC", division: "North", color: "#FFB612", colorSecondary: "#101820" },

  { id: "hou", abbr: "HOU", city: "Houston", name: "Texans", conference: "AFC", division: "South", color: "#03202F", colorSecondary: "#A71930" },
  { id: "ind", abbr: "IND", city: "Indianapolis", name: "Colts", conference: "AFC", division: "South", color: "#002C5F", colorSecondary: "#A2AAAD" },
  { id: "jax", abbr: "JAX", city: "Jacksonville", name: "Jaguars", conference: "AFC", division: "South", color: "#101820", colorSecondary: "#D7A22A" },
  { id: "ten", abbr: "TEN", city: "Tennessee", name: "Titans", conference: "AFC", division: "South", color: "#4B92DB", colorSecondary: "#0C2340" },

  { id: "den", abbr: "DEN", city: "Denver", name: "Broncos", conference: "AFC", division: "West", color: "#FB4F14", colorSecondary: "#002244" },
  { id: "kc", abbr: "KC", city: "Kansas City", name: "Chiefs", conference: "AFC", division: "West", color: "#E31837", colorSecondary: "#FFB81C" },
  { id: "lv", abbr: "LV", city: "Las Vegas", name: "Raiders", conference: "AFC", division: "West", color: "#A5ACAF", colorSecondary: "#000000" },
  { id: "lac", abbr: "LAC", city: "Los Angeles", name: "Chargers", conference: "AFC", division: "West", color: "#0080C6", colorSecondary: "#FFC20E" },

  { id: "dal", abbr: "DAL", city: "Dallas", name: "Cowboys", conference: "NFC", division: "East", color: "#869397", colorSecondary: "#041E42" },
  { id: "nyg", abbr: "NYG", city: "New York", name: "Giants", conference: "NFC", division: "East", color: "#0B2265", colorSecondary: "#A71930" },
  { id: "phi", abbr: "PHI", city: "Philadelphia", name: "Eagles", conference: "NFC", division: "East", color: "#004C54", colorSecondary: "#A5ACAF" },
  { id: "was", abbr: "WAS", city: "Washington", name: "Commanders", conference: "NFC", division: "East", color: "#5A1414", colorSecondary: "#FFB612" },

  { id: "chi", abbr: "CHI", city: "Chicago", name: "Bears", conference: "NFC", division: "North", color: "#0B162A", colorSecondary: "#C83803" },
  { id: "det", abbr: "DET", city: "Detroit", name: "Lions", conference: "NFC", division: "North", color: "#0076B6", colorSecondary: "#B0B7BC" },
  { id: "gb", abbr: "GB", city: "Green Bay", name: "Packers", conference: "NFC", division: "North", color: "#203731", colorSecondary: "#FFB612" },
  { id: "min", abbr: "MIN", city: "Minnesota", name: "Vikings", conference: "NFC", division: "North", color: "#4F2683", colorSecondary: "#FFC62F" },

  { id: "atl", abbr: "ATL", city: "Atlanta", name: "Falcons", conference: "NFC", division: "South", color: "#A71930", colorSecondary: "#000000" },
  { id: "car", abbr: "CAR", city: "Carolina", name: "Panthers", conference: "NFC", division: "South", color: "#0085CA", colorSecondary: "#101820" },
  { id: "no", abbr: "NO", city: "New Orleans", name: "Saints", conference: "NFC", division: "South", color: "#D3BC8D", colorSecondary: "#101820" },
  { id: "tb", abbr: "TB", city: "Tampa Bay", name: "Buccaneers", conference: "NFC", division: "South", color: "#D50A0A", colorSecondary: "#B1BABF" },

  { id: "ari", abbr: "ARI", city: "Arizona", name: "Cardinals", conference: "NFC", division: "West", color: "#97233F", colorSecondary: "#FFB612" },
  { id: "lar", abbr: "LAR", city: "Los Angeles", name: "Rams", conference: "NFC", division: "West", color: "#003594", colorSecondary: "#FFA300" },
  { id: "sf", abbr: "SF", city: "San Francisco", name: "49ers", conference: "NFC", division: "West", color: "#AA0000", colorSecondary: "#B3995D" },
  { id: "sea", abbr: "SEA", city: "Seattle", name: "Seahawks", conference: "NFC", division: "West", color: "#002244", colorSecondary: "#69BE28" },
];

export const TEAMS_BY_ID: Record<string, Team> = Object.fromEntries(
  TEAMS.map((t) => [t.id, t])
);

export function getTeam(id: string): Team | undefined {
  return TEAMS_BY_ID[id.toLowerCase()];
}

// ESPN's CDN, the same logo source nflverse's own import_team_desc()
// points to (team_logo_espn column) — verified directly against that
// dataset rather than assumed, since two teams don't follow the plain
// "id.png" pattern: Washington's asset is keyed "wsh" not "was", and
// Carolina's default logo doesn't read well on a dark background, so
// ESPN publishes a dedicated "500-dark" variant for it. Hotlinked, not
// downloaded/rehosted — same "use the public, community-standard source"
// approach as every other data source in this project.
const LOGO_ABBR_OVERRIDES: Record<string, string> = { was: "wsh" };
const LOGO_VARIANT_OVERRIDES: Record<string, string> = { car: "500-dark" };

export function getTeamLogoUrl(id: string): string {
  const abbr = LOGO_ABBR_OVERRIDES[id] ?? id;
  const variant = LOGO_VARIANT_OVERRIDES[id] ?? "500";
  return `https://a.espncdn.com/i/teamlogos/nfl/${variant}/${abbr}.png`;
}
