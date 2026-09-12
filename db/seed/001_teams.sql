-- Static team reference data. Generated from web/src/lib/teams.ts to keep
-- the two in sync (the frontend uses this list for the standings page shell
-- and command palette even before the DB is wired up). Idempotent — safe to
-- re-run any time via db/seed.sh.

INSERT INTO teams (id, abbr, name, city, conference, division, color, color_secondary)
VALUES
  ('buf', 'BUF', 'Bills', 'Buffalo', 'AFC', 'East', '#00338D', '#C60C30'),
  ('mia', 'MIA', 'Dolphins', 'Miami', 'AFC', 'East', '#008E97', '#FC4C02'),
  ('ne', 'NE', 'Patriots', 'New England', 'AFC', 'East', '#002244', '#C60C30'),
  ('nyj', 'NYJ', 'Jets', 'New York', 'AFC', 'East', '#125740', '#FFFFFF'),
  ('bal', 'BAL', 'Ravens', 'Baltimore', 'AFC', 'North', '#241773', '#9E7C0C'),
  ('cin', 'CIN', 'Bengals', 'Cincinnati', 'AFC', 'North', '#FB4F14', '#000000'),
  ('cle', 'CLE', 'Browns', 'Cleveland', 'AFC', 'North', '#FF6B00', '#311D00'),
  ('pit', 'PIT', 'Steelers', 'Pittsburgh', 'AFC', 'North', '#FFB612', '#101820'),
  ('hou', 'HOU', 'Texans', 'Houston', 'AFC', 'South', '#03202F', '#A71930'),
  ('ind', 'IND', 'Colts', 'Indianapolis', 'AFC', 'South', '#002C5F', '#A2AAAD'),
  ('jax', 'JAX', 'Jaguars', 'Jacksonville', 'AFC', 'South', '#101820', '#D7A22A'),
  ('ten', 'TEN', 'Titans', 'Tennessee', 'AFC', 'South', '#4B92DB', '#0C2340'),
  ('den', 'DEN', 'Broncos', 'Denver', 'AFC', 'West', '#FB4F14', '#002244'),
  ('kc', 'KC', 'Chiefs', 'Kansas City', 'AFC', 'West', '#E31837', '#FFB81C'),
  ('lv', 'LV', 'Raiders', 'Las Vegas', 'AFC', 'West', '#A5ACAF', '#000000'),
  ('lac', 'LAC', 'Chargers', 'Los Angeles', 'AFC', 'West', '#0080C6', '#FFC20E'),
  ('dal', 'DAL', 'Cowboys', 'Dallas', 'NFC', 'East', '#869397', '#041E42'),
  ('nyg', 'NYG', 'Giants', 'New York', 'NFC', 'East', '#0B2265', '#A71930'),
  ('phi', 'PHI', 'Eagles', 'Philadelphia', 'NFC', 'East', '#004C54', '#A5ACAF'),
  ('was', 'WAS', 'Commanders', 'Washington', 'NFC', 'East', '#5A1414', '#FFB612'),
  ('chi', 'CHI', 'Bears', 'Chicago', 'NFC', 'North', '#0B162A', '#C83803'),
  ('det', 'DET', 'Lions', 'Detroit', 'NFC', 'North', '#0076B6', '#B0B7BC'),
  ('gb', 'GB', 'Packers', 'Green Bay', 'NFC', 'North', '#203731', '#FFB612'),
  ('min', 'MIN', 'Vikings', 'Minnesota', 'NFC', 'North', '#4F2683', '#FFC62F'),
  ('atl', 'ATL', 'Falcons', 'Atlanta', 'NFC', 'South', '#A71930', '#000000'),
  ('car', 'CAR', 'Panthers', 'Carolina', 'NFC', 'South', '#0085CA', '#101820'),
  ('no', 'NO', 'Saints', 'New Orleans', 'NFC', 'South', '#D3BC8D', '#101820'),
  ('tb', 'TB', 'Buccaneers', 'Tampa Bay', 'NFC', 'South', '#D50A0A', '#B1BABF'),
  ('ari', 'ARI', 'Cardinals', 'Arizona', 'NFC', 'West', '#97233F', '#FFB612'),
  ('lar', 'LAR', 'Rams', 'Los Angeles', 'NFC', 'West', '#003594', '#FFA300'),
  ('sf', 'SF', '49ers', 'San Francisco', 'NFC', 'West', '#AA0000', '#B3995D'),
  ('sea', 'SEA', 'Seahawks', 'Seattle', 'NFC', 'West', '#002244', '#69BE28')
ON CONFLICT (id) DO UPDATE SET
  abbr = EXCLUDED.abbr,
  name = EXCLUDED.name,
  city = EXCLUDED.city,
  conference = EXCLUDED.conference,
  division = EXCLUDED.division,
  color = EXCLUDED.color,
  color_secondary = EXCLUDED.color_secondary;

-- Historical abbreviation aliases for franchises that relocated/rebranded
-- since 1999 (nfl_data_py's earliest season). season_end is the last season
-- the alias was used; NULL means it's the current abbreviation (already
-- covered by teams.abbr, listed here too so ingestion can resolve either).
INSERT INTO team_abbr_aliases (alias_abbr, team_id, season_start, season_end)
VALUES
  ('OAK', 'lv', 1999, 2019),
  ('LV', 'lv', 2020, NULL),
  ('SD', 'lac', 1999, 2016),
  ('LAC', 'lac', 2017, NULL),
  ('STL', 'lar', 1999, 2015),
  ('LA', 'lar', 2016, 2019),
  ('LAR', 'lar', 2020, NULL),
  ('WAS', 'was', 1999, 2019),
  ('WFT', 'was', 2020, 2021),
  ('WAS', 'was', 2022, NULL)
ON CONFLICT (alias_abbr, season_start) DO NOTHING;
