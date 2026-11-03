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
# On the Free plan the project's direct database host has an IPv6 address only,
# and a Mac on a network without IPv6 cannot reach it (the run of 2026-11-03
# timed out). The script links its own working directory to the project once:
# a linked CLI connects through the session pooler, which answers on IPv4.
#
# Usage:
#   bash scripts/backup-production-db.sh
#   GITBOX_BACKUP_DIR=/path GITBOX_BACKUP_KEEP=14 bash scripts/backup-production-db.sh
#
set -euo pipefail

PROJECT_REF=zfcwvzazzzsefbkztsyp
BACKUP_ROOT="${GITBOX_BACKUP_DIR:-$HOME/gitbox-backups/supabase-prod}"
KEEP="${GITBOX_BACKUP_KEEP:-30}"

partial=""

# On a failed run: drops the unfinished dump, so no empty .partial directory is
# left behind, and shows a macOS notification, so the failure is noticed
# without reading the log.
on_exit() {
  local status=$?
  if [ "$status" -ne 0 ]; then
    if [ -n "$partial" ]; then rm -rf "$partial"; fi
    echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) backup failed (exit $status)"
    osascript -e 'display notification "Production DB backup failed. See backup.log." with title "GitBox backup"' >/dev/null 2>&1 || true
  fi
}
trap on_exit EXIT

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

# The CLI keeps its link in supabase/.temp/ of the working directory. The pooler
# address arrives with the link; without it the CLI dials the IPv6-only host.
cd "$BACKUP_ROOT/.cli"
mkdir -p supabase
if [ ! -s supabase/.temp/pooler-url ] || [ "$(cat supabase/.temp/project-ref 2>/dev/null)" != "$PROJECT_REF" ]; then
  supabase link --project-ref "$PROJECT_REF"
fi
supabase db dump --linked -f "$partial/schema.sql"
supabase db dump --linked --data-only --use-copy -f "$partial/data.sql"
supabase db dump --linked --role-only -f "$partial/roles.sql"

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
