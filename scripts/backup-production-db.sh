#!/usr/bin/env bash
#
# Production Database Backup (runs on the owner's Mac)
#
# Production runs on the Supabase Free plan, which keeps no backups. A launchd
# job runs this once a day (see "Backup Strategy" in CLAUDE.md). It writes the
# schema, the data (the auth schema included) and the roles of the production
# project into one dated directory and keeps the newest 30.
#
# Needs the Supabase CLI signed in (`supabase login`) and a Docker engine: the
# CLI runs pg_dump in a container. OrbStack is started when no engine answers.
# The dumps hold user data and auth tokens, so they stay outside the repository
# and outside synced folders, readable by the owner only.
#
# Usage:
#   bash scripts/backup-production-db.sh
#   GITBOX_BACKUP_DIR=/path GITBOX_BACKUP_KEEP=14 bash scripts/backup-production-db.sh
#
set -euo pipefail

PROJECT_REF=zfcwvzazzzsefbkztsyp
BACKUP_ROOT="${GITBOX_BACKUP_DIR:-$HOME/gitbox-backups/supabase-prod}"
KEEP="${GITBOX_BACKUP_KEEP:-30}"

# Shows a macOS notification, so a failed run is noticed without reading the log.
notify_failure() {
  osascript -e 'display notification "Production DB backup failed. See backup.log." with title "GitBox backup"' >/dev/null 2>&1 || true
}
trap notify_failure ERR

umask 077
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) backup started"
mkdir -p "$BACKUP_ROOT/daily" "$BACKUP_ROOT/.cli"

if ! docker info >/dev/null 2>&1; then
  open -ga OrbStack 2>/dev/null || open -ga Docker
  for _ in $(seq 1 60); do
    docker info >/dev/null 2>&1 && break
    sleep 2
  done
  docker info >/dev/null
fi

target="$BACKUP_ROOT/daily/$(date +%Y-%m-%d)"
partial="$target.partial"
rm -rf "$partial"
mkdir -p "$partial"

# The CLI writes a supabase/ folder into the working directory.
cd "$BACKUP_ROOT/.cli"
supabase db dump --project-ref "$PROJECT_REF" -f "$partial/schema.sql"
supabase db dump --project-ref "$PROJECT_REF" --data-only --use-copy -f "$partial/data.sql"
supabase db dump --project-ref "$PROJECT_REF" --role-only -f "$partial/roles.sql"

# A dump without the app's tables failed, whatever the CLI's exit code said.
grep -q '^COPY "public"."board"' "$partial/data.sql"
grep -q '^COPY "auth"."users"' "$partial/data.sql"

gzip -9 "$partial"/*.sql
rm -rf "$target"
mv "$partial" "$target"

find "$BACKUP_ROOT/daily" -mindepth 1 -maxdepth 1 -type d -name '????-??-??' |
  sort -r |
  tail -n +"$((KEEP + 1))" |
  while read -r old; do rm -rf "$old"; done

echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) backed up to $target"
