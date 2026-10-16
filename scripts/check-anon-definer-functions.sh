#!/usr/bin/env bash
#
# Fail when anon can execute a SECURITY DEFINER function in schema public.
#
# Such a function bypasses row level security for anyone who holds the public
# API key. Trigger functions are excluded: they do not run as an RPC.
#
# Reads the postgres database of the local stack, the one `supabase db reset`
# just built. An E2E shard is the wrong database: shards are loaded with
# pg_dump --no-privileges, so every function there looks executable by PUBLIC.
#
# The count is the anon_definer_functions column of the verification query in
# docs/plans/2026-10-16-remove-public-board.md. Expected: 0.
#
# Usage: bash scripts/check-anon-definer-functions.sh
#
set -euo pipefail

DB_CONTAINER="${DB_CONTAINER:-supabase_db_gitbox}"

count=$(docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres -q -tA -v ON_ERROR_STOP=1 <<'SQL'
SELECT count(*)
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prosecdef
  AND p.prorettype NOT IN ('trigger'::regtype, 'event_trigger'::regtype)
  AND has_function_privilege('anon', p.oid, 'EXECUTE');
SQL
)

echo "anon_definer_functions=${count}"

if [ "$count" != "0" ]; then
  echo "anon can execute these SECURITY DEFINER functions in schema public:"
  docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres -q -v ON_ERROR_STOP=1 <<'SQL'
SELECT p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' AS function
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prosecdef
  AND p.prorettype NOT IN ('trigger'::regtype, 'event_trigger'::regtype)
  AND has_function_privilege('anon', p.oid, 'EXECUTE')
ORDER BY 1;
SQL
  exit 1
fi
