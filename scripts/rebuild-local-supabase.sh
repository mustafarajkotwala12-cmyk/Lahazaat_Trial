#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SUPABASE_BIN="$ROOT_DIR/node_modules/.bin/supabase"

usage() {
  cat <<'EOF'
Rebuild the local Supabase stack for this project.

Usage:
  bash ./scripts/rebuild-local-supabase.sh [--keep-volumes]

Options:
  --keep-volumes  Restart and reset the stack without deleting Docker volumes first.
  --help          Show this help message.
EOF
}

if [[ ! -x "$SUPABASE_BIN" ]]; then
  echo "Supabase CLI not found at $SUPABASE_BIN. Run npm install first." >&2
  exit 1
fi

delete_volumes=true

case "${1:-}" in
  "")
    ;;
  --keep-volumes)
    delete_volumes=false
    ;;
  --help)
    usage
    exit 0
    ;;
  *)
    echo "Unknown argument: ${1}" >&2
    usage >&2
    exit 1
    ;;
esac

cd "$ROOT_DIR"

if [[ "$delete_volumes" == true ]]; then
  echo "Stopping local Supabase stack and deleting Docker volumes..."
  if ! "$SUPABASE_BIN" stop --no-backup --yes; then
    echo "No existing local stack was stopped. Continuing with a fresh start..."
  fi
else
  echo "Keeping existing Docker volumes and restarting/resetting the stack..."
fi

echo "Starting local Supabase stack..."
"$SUPABASE_BIN" start --yes

echo "Resetting local database from migrations and seed data..."
"$SUPABASE_BIN" db reset --yes

echo "Current local Supabase status:"
"$SUPABASE_BIN" status
