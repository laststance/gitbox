#!/usr/bin/env bash
#
# Parallel E2E Test Orchestrator
#
# Runs N Playwright shards in parallel, each with its own Next.js server
# and its own PostgREST + PostgreSQL database for true E2E isolation.
#
# MSW mocks GitHub API only. All Supabase/PostgREST calls hit real databases.
#
# Usage:
#   pnpm e2e:parallel              # Run 12 shards (default)
#   pnpm e2e:parallel --shards 4   # Run 4 shards
#   pnpm e2e:parallel --skip-build # Skip build (reuse existing .next/)
#   pnpm e2e:parallel --grep "kanban" # Filter tests by grep pattern
#
set -euo pipefail

# ─── Configuration ─────────────────────────────────────────────
SHARD_COUNT=12
BASE_PORT=3008
POSTGREST_BASE_PORT=54400
SKIP_BUILD=false
GREP_PATTERN=""
EXTRA_PW_ARGS=()

# Local Supabase credentials (matches supabase start output)
LOCAL_SUPABASE_URL="http://127.0.0.1:54321"
LOCAL_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
LOCAL_SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"

# ─── Parse arguments ───────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --shards)
      SHARD_COUNT="$2"
      shift 2
      ;;
    --skip-build)
      SKIP_BUILD=true
      shift
      ;;
    --grep)
      GREP_PATTERN="$2"
      shift 2
      ;;
    *)
      EXTRA_PW_ARGS+=("$1")
      shift
      ;;
  esac
done

# ─── Cleanup trap ──────────────────────────────────────────────
SERVER_PIDS=()
SHARD_PIDS=()

cleanup() {
  echo ""
  echo "🧹 Cleaning up..."
  # Kill all Next.js servers
  for pid in "${SERVER_PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  # Kill any remaining shard processes
  for pid in "${SHARD_PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
  # Clean up PostgREST containers and shard databases
  bash scripts/e2e-setup-databases.sh cleanup "$SHARD_COUNT"
}
trap cleanup EXIT INT TERM

# ─── Step 1: Verify Supabase ──────────────────────────────────
echo "🔍 Checking Supabase..."
if curl -sf "${LOCAL_SUPABASE_URL}/rest/v1/" -H "apikey: ${LOCAL_SUPABASE_ANON_KEY}" > /dev/null 2>&1; then
  echo "✅ Supabase is running"
else
  echo "⚠️  Supabase not reachable at ${LOCAL_SUPABASE_URL}"
  echo "   Start it with: cd src/supabase && supabase start"
  exit 1
fi

# ─── Step 2: Reset database ───────────────────────────────────
echo "🔄 Resetting database..."
pnpm db:reset 2>&1 | tail -3
echo "✅ Database reset complete"

# ─── Step 3: Setup shard databases + PostgREST ────────────────
echo "🗄️  Setting up ${SHARD_COUNT} shard databases and PostgREST instances..."
bash scripts/e2e-setup-databases.sh setup "$SHARD_COUNT"

# ─── Step 4: Build application ────────────────────────────────
if [ "$SKIP_BUILD" = true ] && [ -d ".next" ]; then
  echo "⏭️  Skipping build (--skip-build flag, .next/ exists)"
else
  echo "🔨 Building application..."
  NEXT_PUBLIC_ENABLE_MSW_MOCK=true \
  APP_ENV=test \
  NEXT_PUBLIC_SUPABASE_URL="${LOCAL_SUPABASE_URL}" \
  NEXT_PUBLIC_SUPABASE_ANON_KEY="${LOCAL_SUPABASE_ANON_KEY}" \
  SUPABASE_SERVICE_ROLE_KEY="${LOCAL_SUPABASE_SERVICE_ROLE_KEY}" \
    pnpm build
  echo "✅ Build complete"
fi

# ─── Step 5: Clean previous reports ───────────────────────────
rm -rf blob-report playwright-report
mkdir -p blob-report

# ─── Step 6: Start Next.js servers ────────────────────────────
echo "🚀 Starting ${SHARD_COUNT} Next.js servers (ports ${BASE_PORT}-$((BASE_PORT + SHARD_COUNT - 1)))..."

for i in $(seq 0 $((SHARD_COUNT - 1))); do
  port=$((BASE_PORT + i))
  postgrest_port=$((POSTGREST_BASE_PORT + i))
  APP_ENV=test \
  NEXT_PUBLIC_ENABLE_MSW_MOCK=true \
  NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:${postgrest_port}" \
  NEXT_PUBLIC_SUPABASE_ANON_KEY="${LOCAL_SUPABASE_ANON_KEY}" \
  SUPABASE_SERVICE_ROLE_KEY="${LOCAL_SUPABASE_SERVICE_ROLE_KEY}" \
    pnpm exec next start -p "$port" > "/tmp/e2e-server-${port}.log" 2>&1 &
  SERVER_PIDS+=($!)
done

# ─── Step 7: Wait for all servers to be ready ─────────────────
echo "⏳ Waiting for servers to be ready..."
MAX_WAIT=60
for i in $(seq 0 $((SHARD_COUNT - 1))); do
  port=$((BASE_PORT + i))
  elapsed=0
  while ! curl -sf "http://localhost:${port}" > /dev/null 2>&1; do
    sleep 1
    elapsed=$((elapsed + 1))
    if [ "$elapsed" -ge "$MAX_WAIT" ]; then
      echo "❌ Server on port ${port} failed to start within ${MAX_WAIT}s"
      echo "   Log: /tmp/e2e-server-${port}.log"
      tail -20 "/tmp/e2e-server-${port}.log"
      exit 1
    fi
  done
done
echo "✅ All ${SHARD_COUNT} servers ready"

# ─── Step 8: Run shards in parallel ──────────────────────────
echo ""
echo "🧪 Running ${SHARD_COUNT} E2E shards in parallel..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
START_TIME=$(date +%s)

# Build common Playwright args
PW_COMMON_ARGS=()
if [ -n "$GREP_PATTERN" ]; then
  PW_COMMON_ARGS+=(--grep "$GREP_PATTERN")
fi
PW_COMMON_ARGS+=("${EXTRA_PW_ARGS[@]}")

for i in $(seq 1 "$SHARD_COUNT"); do
  port=$((BASE_PORT + i - 1))
  postgrest_port=$((POSTGREST_BASE_PORT + i - 1))

  E2E_PARALLEL_MODE=1 \
  E2E_SHARD_PORT="$port" \
  SHARD_INDEX="$i" \
  APP_ENV=test \
  NEXT_PUBLIC_ENABLE_MSW_MOCK=true \
  NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:${postgrest_port}" \
  NEXT_PUBLIC_SUPABASE_ANON_KEY="${LOCAL_SUPABASE_ANON_KEY}" \
  SUPABASE_SERVICE_ROLE_KEY="${LOCAL_SUPABASE_SERVICE_ROLE_KEY}" \
    pnpm exec playwright test \
      --shard="${i}/${SHARD_COUNT}" \
      "${PW_COMMON_ARGS[@]}" \
      > "/tmp/e2e-shard-${i}.log" 2>&1 &
  SHARD_PIDS+=($!)
done

# ─── Step 9: Wait for all shards (fail-fast: false) ──────────
SHARD_RESULTS=()
FAILED_SHARDS=()
PASSED_SHARDS=()

for i in $(seq 1 "$SHARD_COUNT"); do
  idx=$((i - 1))
  pid="${SHARD_PIDS[$idx]}"
  if wait "$pid" 2>/dev/null; then
    SHARD_RESULTS+=("pass")
    PASSED_SHARDS+=("$i")
  else
    SHARD_RESULTS+=("fail")
    FAILED_SHARDS+=("$i")
  fi
done

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

# ─── Step 10: Merge blob reports ───────────────────────────────
echo ""
echo "📊 Merging test reports..."
# Collect all blob report directories into a single flat directory for merging
MERGE_DIR=$(mktemp -d)
for dir in blob-report/shard-*/; do
  if [ -d "$dir" ]; then
    cp "$dir"* "$MERGE_DIR/" 2>/dev/null || true
  fi
done

if [ "$(ls -A "$MERGE_DIR" 2>/dev/null)" ]; then
  pnpm exec playwright merge-reports --reporter html "$MERGE_DIR" 2>/dev/null || true
  echo "✅ Report: playwright-report/index.html"
else
  echo "⚠️  No blob reports to merge"
fi
rm -rf "$MERGE_DIR"

# ─── Step 11: Print summary ──────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Results (${DURATION}s total)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

for i in $(seq 1 "$SHARD_COUNT"); do
  idx=$((i - 1))
  result="${SHARD_RESULTS[$idx]}"
  if [ "$result" = "pass" ]; then
    echo "  ✅ Shard ${i}/${SHARD_COUNT}"
  else
    echo "  ❌ Shard ${i}/${SHARD_COUNT} — see /tmp/e2e-shard-${i}.log"
  fi
done

echo ""
echo "  Passed: ${#PASSED_SHARDS[@]}/${SHARD_COUNT}"
if [ ${#FAILED_SHARDS[@]} -gt 0 ]; then
  echo "  Failed: ${#FAILED_SHARDS[@]} (shards: ${FAILED_SHARDS[*]})"
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Exit with failure if any shard failed
if [ ${#FAILED_SHARDS[@]} -gt 0 ]; then
  exit 1
fi
