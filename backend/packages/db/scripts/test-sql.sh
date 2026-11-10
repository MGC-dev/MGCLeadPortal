#!/usr/bin/env bash
# Applies every migration to a throwaway Postgres database and runs the RLS tests.
# Usage: DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres pnpm --filter @mgc/db test:sql
set -euo pipefail
cd "$(dirname "$0")/../supabase"
: "${DATABASE_URL:?Set DATABASE_URL to an empty test database}"
PSQL=(psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -X)
"${PSQL[@]}" -c 'drop schema if exists public cascade; drop schema if exists private cascade; drop schema if exists auth cascade; drop schema if exists extensions cascade; create schema public;'
"${PSQL[@]}" -f sql-tests/00_auth_stub.sql
for f in migrations/*.sql; do echo "migrate: $f"; "${PSQL[@]}" -f "$f"; done
set +e
out=$("${PSQL[@]}" -At -f sql-tests/10_rls.sql 2>&1); code=$?
set -e
echo "$out" | grep -oE '(ok: .*|ERROR: .*)'
[ $code -eq 0 ] || { echo 'RLS tests failed'; exit 1; }
echo "RLS tests passed: $(echo "$out" | grep -c 'ok:') checks"
