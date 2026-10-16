#!/usr/bin/env bash
#
# E2E Shard Database Setup
#
# Clones the main Supabase database into N shard databases
# and starts a PostgREST container + nginx reverse proxy for each shard.
#
# The nginx proxy strips the /rest/v1/ prefix that Supabase JS client adds,
# and passes /auth/v1/* through to return mock responses.
#
# Uses Docker exec for pg_dump/psql (no local PostgreSQL client needed).
# All containers join Supabase's Docker network for DB access.
#
# Usage:
#   bash scripts/e2e-setup-databases.sh setup 12
#   bash scripts/e2e-setup-databases.sh cleanup 12
#
set -euo pipefail

ACTION="${1:-setup}"
SHARD_COUNT="${2:-12}"

# Supabase Docker container and network names (matches supabase start output)
DB_CONTAINER="supabase_db_gitbox"
DOCKER_NETWORK="supabase_network_gitbox"

# PostgreSQL connection (inside Docker network)
PG_USER=postgres
PG_PASS=postgres

# Port configuration
POSTGREST_BASE_PORT=54400  # External ports for the proxy (54400-54411)
POSTGREST_IMAGE="postgrest/postgrest:v12.2.3"
JWT_SECRET="super-secret-jwt-token-with-at-least-32-characters-long"

# Temp directory for nginx configs
NGINX_CONF_DIR="/tmp/e2e-nginx-confs"

# ─── Helper: run commands inside the Supabase DB container ────
db_exec() {
  docker exec -e PGPASSWORD="$PG_PASS" "$DB_CONTAINER" "$@"
}

# psql exits 0 when a statement fails unless ON_ERROR_STOP is set, so a broken
# dump would still be treated as a seeded shard.
psql_stop() {
  db_exec psql -U "$PG_USER" -v ON_ERROR_STOP=1 "$@"
}

# ─── Cleanup ─────────────────────────────────────────────────
cleanup() {
  echo "🧹 Cleaning up shard databases and PostgREST containers..."
  for i in $(seq 1 "$SHARD_COUNT"); do
    docker rm -f "e2e-postgrest-${i}" 2>/dev/null || true
    docker rm -f "e2e-proxy-${i}" 2>/dev/null || true
    db_exec psql -U "$PG_USER" \
      -c "DROP DATABASE IF EXISTS gitbox_shard_${i};" 2>/dev/null || true
  done
  # Clean up temp files
  db_exec rm -f /tmp/e2e-template.sql 2>/dev/null || true
  rm -rf "$NGINX_CONF_DIR" 2>/dev/null || true
  echo "✅ Cleanup complete"
}

# ─── Generate nginx config for a shard ───────────────────────
generate_nginx_conf() {
  local shard_num="$1"
  local conf_file="${NGINX_CONF_DIR}/shard-${shard_num}.conf"

  cat > "$conf_file" <<EOF
events { worker_connections 64; }
http {
  server {
    listen 80;

    # Supabase JS client calls /rest/v1/<table> - strip prefix for PostgREST
    location /rest/v1/ {
      proxy_pass http://e2e-postgrest-${shard_num}:3000/;
      proxy_set_header Host \$host;
      proxy_set_header X-Real-IP \$remote_addr;
      proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }

    # Auth endpoints - return mock 200 responses
    # Server-side auth is handled by APP_ENV=test code proxy in server.ts
    location /auth/v1/token {
      default_type application/json;
      return 200 '{"access_token":"mock","token_type":"bearer","expires_in":3600}';
    }
    location /auth/v1/user {
      default_type application/json;
      return 200 '{"id":"00000000-0000-0000-0000-000000000001","email":"test@gitbox.dev"}';
    }
    location /auth/v1/ {
      default_type application/json;
      return 200 '{}';
    }
  }
}
EOF
}

# ─── Setup ───────────────────────────────────────────────────
setup() {
  echo "📦 Creating ${SHARD_COUNT} shard databases..."

  # Create temp directory for nginx configs
  mkdir -p "$NGINX_CONF_DIR"

  # 1. Dump the main 'postgres' DB (migrations + seed already applied by db:reset)
  # Copying vault.secrets is denied for this role, and a shard does not use it.
  # Leaving the COPY in makes ON_ERROR_STOP stop after the fixture rows.
  db_exec pg_dump -U "$PG_USER" \
    -d postgres --no-owner --no-privileges \
    --exclude-table-data=vault.secrets \
    -f /tmp/e2e-template.sql
  # realtime functions set log_min_messages, which this role cannot do. Those
  # lines are not the app's seed. Left in, ON_ERROR_STOP stops before any
  # fixture row is copied.
  db_exec sed -i "/SET log_min_messages TO 'fatal'/d" /tmp/e2e-template.sql

  # 2. Per shard: create DB, load dump, start PostgREST + nginx proxy
  for i in $(seq 1 "$SHARD_COUNT"); do
    DB_NAME="gitbox_shard_${i}"
    PORT=$((POSTGREST_BASE_PORT + i - 1))

    # Create fresh database and load schema+seed from dump. stdout is the
    # dump's notices; a statement error goes to stderr and stops the script.
    psql_stop \
      -c "DROP DATABASE IF EXISTS ${DB_NAME};" \
      -c "CREATE DATABASE ${DB_NAME};"
    psql_stop \
      -d "$DB_NAME" -f /tmp/e2e-template.sql > /dev/null

    # Grant table permissions to anon, authenticated, and service_role roles
    # (pg_dump --no-privileges strips GRANTs)
    # - anon: PostgREST default role
    # - authenticated: PostgREST role when using JWT with role=authenticated
    #   (test JWT sets auth.uid() for RLS policy evaluation)
    # - service_role: bypasses RLS for E2E setup/teardown helpers (db-query.ts)
    # RLS stays ENABLED — policies enforce access via auth.uid() from test JWT
    # USAGE on schema auth: a function that runs with the caller's rights
    # (create_board_with_status_lists) looks up auth.uid() by name when it
    # runs, which needs USAGE on the schema. Supabase grants it to these three
    # roles; a policy does not need it because it stores the function's OID.
    psql_stop -d "$DB_NAME" -c "
      GRANT USAGE ON SCHEMA auth TO anon;
      GRANT USAGE ON SCHEMA auth TO authenticated;
      GRANT USAGE ON SCHEMA auth TO service_role;
      GRANT USAGE ON SCHEMA public TO anon;
      GRANT USAGE ON SCHEMA public TO authenticated;
      GRANT USAGE ON SCHEMA public TO service_role;
      GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
      GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
      GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
      GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;
      GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
      GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
    " > /dev/null

    # A function loaded from the dump is executable by everyone (PUBLIC), the
    # PostgreSQL default, because the dump carries no REVOKE. Repeat the rights
    # of the migrations that take EXECUTE away from visitors, so a shard
    # refuses the same callers as a database built from the migrations (CI
    # and production). A migration that revokes EXECUTE on another function
    # needs its lines here too.
    psql_stop -d "$DB_NAME" -c "
      REVOKE ALL ON FUNCTION public.create_board_with_status_lists(text, jsonb) FROM PUBLIC, anon;
      GRANT EXECUTE ON FUNCTION public.create_board_with_status_lists(text, jsonb) TO authenticated, service_role;
      REVOKE ALL ON FUNCTION public.projectinfo(public.repocard) FROM PUBLIC, anon;
      GRANT EXECUTE ON FUNCTION public.projectinfo(public.repocard) TO authenticated, service_role;
      REVOKE ALL ON FUNCTION public.projectinfo_slate_text(jsonb, text) FROM PUBLIC, anon;
      GRANT EXECUTE ON FUNCTION public.projectinfo_slate_text(jsonb, text) TO authenticated;
      REVOKE ALL ON FUNCTION public.projectinfo_note_holds_text(text) FROM PUBLIC, anon;
      GRANT EXECUTE ON FUNCTION public.projectinfo_note_holds_text(text) TO authenticated;
      REVOKE ALL ON FUNCTION public.projectinfo_link_count(jsonb) FROM PUBLIC, anon;
      GRANT EXECUTE ON FUNCTION public.projectinfo_link_count(jsonb) TO authenticated;
      REVOKE ALL ON TABLE public.saved_repository_mark FROM PUBLIC, anon;
      GRANT SELECT ON TABLE public.saved_repository_mark TO authenticated;
    " > /dev/null

    # Start PostgREST container (internal only, no port mapping)
    docker run -d --name "e2e-postgrest-${i}" \
      --network "$DOCKER_NETWORK" \
      -e PGRST_DB_URI="postgres://${PG_USER}:${PG_PASS}@${DB_CONTAINER}:5432/${DB_NAME}" \
      -e PGRST_DB_SCHEMAS="public" \
      -e PGRST_DB_ANON_ROLE="anon" \
      -e PGRST_JWT_SECRET="${JWT_SECRET}" \
      "$POSTGREST_IMAGE" > /dev/null

    # Generate nginx config and start proxy container
    generate_nginx_conf "$i"
    docker run -d --name "e2e-proxy-${i}" \
      --network "$DOCKER_NETWORK" \
      -p "${PORT}:80" \
      -v "${NGINX_CONF_DIR}/shard-${i}.conf:/etc/nginx/nginx.conf:ro" \
      nginx:alpine > /dev/null
  done

  # 3. Cleanup temp dump inside container
  db_exec rm -f /tmp/e2e-template.sql

  # 4. Wait for all proxy instances to be ready
  echo "⏳ Waiting for PostgREST instances..."
  for i in $(seq 1 "$SHARD_COUNT"); do
    PORT=$((POSTGREST_BASE_PORT + i - 1))
    elapsed=0
    while ! curl -sf "http://127.0.0.1:${PORT}/rest/v1/" > /dev/null 2>&1; do
      sleep 0.5
      elapsed=$((elapsed + 1))
      if [ "$elapsed" -ge 60 ]; then
        echo "❌ Shard ${i} proxy on port ${PORT} failed to start within 30s"
        echo "   PostgREST logs: docker logs e2e-postgrest-${i}"
        echo "   Proxy logs: docker logs e2e-proxy-${i}"
        exit 1
      fi
    done
  done

  echo "✅ ${SHARD_COUNT} PostgREST instances ready (ports ${POSTGREST_BASE_PORT}-$((POSTGREST_BASE_PORT + SHARD_COUNT - 1)))"
}

# ─── Main ────────────────────────────────────────────────────
case "$ACTION" in
  setup)
    cleanup
    setup
    ;;
  cleanup)
    cleanup
    ;;
  *)
    echo "Usage: $0 [setup|cleanup] [shard_count]"
    exit 1
    ;;
esac
