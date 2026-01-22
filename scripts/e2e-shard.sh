#!/bin/bash
#
# E2E Shard Test Runner
# Runs 8 parallel Next.js containers and executes Playwright tests in shards
#
# Usage:
#   ./scripts/e2e-shard.sh              # Full run (build + test + cleanup)
#   ./scripts/e2e-shard.sh --no-build   # Skip Docker build (use existing images)
#   ./scripts/e2e-shard.sh --keep-containers  # Keep containers running for debugging
#

set -e

# Configuration
TOTAL_SHARDS=8
BASE_PORT=3008
COMPOSE_FILE="docker-compose.e2e.yml"
TIMEOUT=120

# Parse arguments
NO_BUILD=false
KEEP_CONTAINERS=false
for arg in "$@"; do
  case $arg in
    --no-build)
      NO_BUILD=true
      shift
      ;;
    --keep-containers)
      KEEP_CONTAINERS=true
      shift
      ;;
  esac
done

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

# Cleanup function - always runs on exit
cleanup() {
  if [ "$KEEP_CONTAINERS" = true ]; then
    log_warn "Keeping containers running (--keep-containers flag)"
    log_info "To stop manually: docker compose -f $COMPOSE_FILE down"
  else
    log_info "Stopping containers..."
    docker compose -f "$COMPOSE_FILE" down --remove-orphans 2>/dev/null || true
  fi
}

# Set trap to ensure cleanup on exit
trap cleanup EXIT INT TERM

# Step 1: Clean previous artifacts
log_info "Cleaning previous artifacts..."
rm -rf blob-report playwright-report test-results
rm -rf coverage-e2e-shard-*

# Step 2: Build Docker images (unless --no-build)
if [ "$NO_BUILD" = true ]; then
  log_info "Skipping Docker build (--no-build flag)"
else
  log_info "Building Docker images (parallel with BuildKit)..."
  # DOCKER_BUILDKIT=1 enables parallel layer builds
  # --parallel builds all services concurrently
  DOCKER_BUILDKIT=1 docker compose -f "$COMPOSE_FILE" build --parallel
fi

# Step 3: Start containers
log_info "Starting $TOTAL_SHARDS containers..."
docker compose -f "$COMPOSE_FILE" up -d

# Step 4: Wait for all containers to be healthy
log_info "Waiting for containers to be healthy (timeout: ${TIMEOUT}s)..."
ELAPSED=0
while [ $ELAPSED -lt $TIMEOUT ]; do
  HEALTHY_COUNT=0
  for i in $(seq 1 $TOTAL_SHARDS); do
    PORT=$((BASE_PORT + i - 1))
    if curl -s -o /dev/null -w '' "http://localhost:$PORT" 2>/dev/null; then
      HEALTHY_COUNT=$((HEALTHY_COUNT + 1))
    fi
  done

  if [ $HEALTHY_COUNT -eq $TOTAL_SHARDS ]; then
    log_success "All $TOTAL_SHARDS containers are healthy!"
    break
  fi

  echo -ne "\r  $HEALTHY_COUNT/$TOTAL_SHARDS containers healthy..."
  sleep 2
  ELAPSED=$((ELAPSED + 2))
done

echo "" # New line after progress

if [ $HEALTHY_COUNT -ne $TOTAL_SHARDS ]; then
  log_error "Timeout: Only $HEALTHY_COUNT/$TOTAL_SHARDS containers became healthy"
  log_info "Container status:"
  docker compose -f "$COMPOSE_FILE" ps
  exit 1
fi

# Step 5: Run Playwright tests in parallel shards
log_info "Running Playwright tests with $TOTAL_SHARDS shards..."

PIDS=()

for i in $(seq 1 $TOTAL_SHARDS); do
  PORT=$((BASE_PORT + i - 1))
  log_info "Starting shard $i/$TOTAL_SHARDS on port $PORT..."

  PLAYWRIGHT_TEST_BASE_URL="http://localhost:$PORT" \
  SHARD_INDEX="$i" \
  pnpm playwright test --shard="$i/$TOTAL_SHARDS" &

  PIDS+=($!)
done

# Wait for all shards and collect exit codes
# Temporarily disable set -e to capture all exit codes
set +e
FAILED_SHARDS=0
for i in $(seq 0 $((TOTAL_SHARDS - 1))); do
  SHARD_NUM=$((i + 1))
  PID=${PIDS[$i]}
  wait "$PID"
  EXIT_CODE=$?
  if [ $EXIT_CODE -ne 0 ]; then
    log_error "Shard $SHARD_NUM (PID $PID) failed with exit code $EXIT_CODE"
    FAILED_SHARDS=$((FAILED_SHARDS + 1))
  else
    log_success "Shard $SHARD_NUM completed successfully"
  fi
done
set -e
if [ $FAILED_SHARDS -gt 0 ]; then
  log_error "$FAILED_SHARDS shard(s) failed"
else
  log_success "All shards completed successfully!"
fi

# Step 6: Merge blob reports
log_info "Merging blob reports..."
if [ -d "blob-report" ]; then
  pnpm playwright merge-reports --reporter=html blob-report
  log_success "HTML report generated: playwright-report/index.html"
else
  log_warn "No blob-report directory found, skipping merge"
fi

# Step 7: Merge coverage reports
log_info "Merging coverage reports..."
COVERAGE_DIRS=$(find . -maxdepth 1 -type d -name "coverage-e2e-shard-*" | sort)
if [ -n "$COVERAGE_DIRS" ]; then
  # Create merged coverage directory
  mkdir -p coverage-e2e/coverage

  # Simple merge: copy the first shard's summary as base, note about manual merge
  FIRST_SHARD=$(echo "$COVERAGE_DIRS" | head -1)
  if [ -f "$FIRST_SHARD/coverage-summary.json" ]; then
    # For now, just copy the first shard's summary
    # A proper merge would require a Node.js script to combine JSON files
    cp "$FIRST_SHARD/coverage-summary.json" coverage-e2e/coverage/coverage-summary.json
    log_success "Coverage summary available: coverage-e2e/coverage/coverage-summary.json"
    log_warn "Note: Full coverage merge requires manual combination of shard data"
  fi
else
  log_warn "No coverage directories found"
fi

# Final summary
echo ""
echo "=================================="
if [ $FAILED_SHARDS -gt 0 ]; then
  log_error "E2E Tests: $FAILED_SHARDS shard(s) failed"
  echo "=================================="
  exit 1
else
  log_success "E2E Tests: All shards passed!"
  echo "=================================="
  echo ""
  log_info "Reports:"
  echo "  - HTML Report: playwright-report/index.html"
  echo "  - Coverage: coverage-e2e/coverage/coverage-summary.json"
fi
