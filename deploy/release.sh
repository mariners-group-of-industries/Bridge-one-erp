#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Activates an uploaded release on the VPS. The deploy workflow uploads this
# file to $APP_DIR/shared/release.sh and runs it as the deploy user:
#   bash /var/www/bridgeone/shared/release.sh <release-id>
#
#   1. unpacks $APP_DIR/incoming/<id>.tgz into $APP_DIR/releases/<id>
#   2. points $APP_DIR/current at it (atomic symlink swap)
#   3. restarts the PM2 app and waits for /api/health
#   4. on failure: points `current` back at the previous release and restarts it
#   5. keeps the newest $KEEP_RELEASES releases
#
# Manual rollback:  bash /var/www/bridgeone/shared/release.sh --rollback
# (or re-run the Deploy workflow for an older commit).
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/bridgeone}"
KEEP_RELEASES="${KEEP_RELEASES:-5}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/api/health}"
ECOSYSTEM="$APP_DIR/shared/ecosystem.config.cjs"

log() { echo "[release] $*"; }

restart_app() {
  # startOrRestart re-reads the ecosystem file, so it also works on the very first deploy.
  APP_DIR="$APP_DIR" pm2 startOrRestart "$ECOSYSTEM" --update-env >/dev/null
  pm2 save >/dev/null
}

healthy() {
  for _ in $(seq 1 30); do
    if curl -fsS --max-time 5 "$HEALTH_URL" >/dev/null 2>&1; then return 0; fi
    sleep 2
  done
  return 1
}

switch_to() {
  ln -sfn "$1" "$APP_DIR/current.next"
  mv -Tf "$APP_DIR/current.next" "$APP_DIR/current"
}

if [[ "${1:-}" == "--rollback" ]]; then
  current="$(readlink -f "$APP_DIR/current")"
  previous="$(ls -1dt "$APP_DIR"/releases/*/ | sed 's:/$::' | grep -vxF "$current" | head -n 1 || true)"
  [[ -n "$previous" ]] || { log "no previous release to roll back to"; exit 1; }
  log "rolling back to $(basename "$previous")"
  switch_to "$previous"
  restart_app
  healthy && log "rollback OK" || { log "rollback release is not healthy either"; exit 1; }
  exit 0
fi

RELEASE_ID="${1:?usage: release.sh <release-id> | --rollback}"
ARCHIVE="$APP_DIR/incoming/$RELEASE_ID.tgz"
TARGET="$APP_DIR/releases/$RELEASE_ID"
[[ -f "$ARCHIVE" ]] || { log "missing $ARCHIVE"; exit 1; }
[[ -f "$APP_DIR/shared/.env" ]] || { log "missing $APP_DIR/shared/.env (see deploy/README.md)"; exit 1; }

log "unpacking $RELEASE_ID"
rm -rf "$TARGET"
mkdir -p "$TARGET"
tar -xzf "$ARCHIVE" -C "$TARGET"
rm -f "$ARCHIVE"
[[ -f "$TARGET/server.js" ]] || { log "archive has no server.js"; exit 1; }

# The ecosystem file ships with each release; keep the shared copy current.
cp "$TARGET/ecosystem.config.cjs" "$ECOSYSTEM"

previous="$(readlink -f "$APP_DIR/current" 2>/dev/null || true)"
switch_to "$TARGET"
log "restarting"
restart_app

if healthy; then
  log "release $RELEASE_ID is live"
else
  log "health check failed: recent logs:"
  pm2 logs bridgeone --lines 40 --nostream || true
  if [[ -n "$previous" && -d "$previous" && "$previous" != "$TARGET" ]]; then
    log "rolling back to $(basename "$previous")"
    switch_to "$previous"
    restart_app
    healthy && log "previous release restored" || log "previous release is not healthy either"
  fi
  exit 1
fi

# Prune old releases (never the live one).
live="$(readlink -f "$APP_DIR/current")"
ls -1dt "$APP_DIR"/releases/*/ | sed 's:/$::' | grep -vxF "$live" | tail -n +"$KEEP_RELEASES" | xargs -r rm -rf
