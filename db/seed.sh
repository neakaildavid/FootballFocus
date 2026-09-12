#!/usr/bin/env bash
# Applies all SQL files in db/seed/, in filename order. Unlike migrate.sh,
# these aren't tracked/skipped — each seed file is written to be idempotent
# (INSERT ... ON CONFLICT ...) so it's safe to re-run any time, e.g. after
# adding a new team-color tweak to web/src/lib/teams.ts.
#
# Usage:
#   DATABASE_URL=postgres://user@localhost:5432/footballfocus_dev ./db/seed.sh
set -euo pipefail

: "${DATABASE_URL:?Set DATABASE_URL first, e.g. postgres://$(whoami)@localhost:5432/footballfocus_dev}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SEED_DIR="$SCRIPT_DIR/seed"

shopt -s nullglob
for file in "$SEED_DIR"/*.sql; do
  echo "seed  $(basename "$file")"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$file"
done

echo "done."
