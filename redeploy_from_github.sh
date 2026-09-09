#!/usr/bin/env bash
set -euo pipefail

# Safely update from origin/main, apply forward migrations, and restart full mode.

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="${DIR}/data"
LOCAL_ENV_FILE="${LOCAL_ENV_FILE:-${DATA_DIR}/local.env}"
PORT_ARGS=()

usage() {
  cat <<EOF
Usage: $0 [--port PORT]

Pulls origin/main with a fast-forward only update, runs npm ci, downloads the
current Chromium/Camoufox binaries, applies prisma migrate deploy, then restarts
the application in full mode. Refuses when tracked local files are modified.
EOF
}

playwright_platform_override() {
  local version arch
  [[ -r /etc/os-release ]] || return 0
  # shellcheck disable=SC1091
  source /etc/os-release
  version="${VERSION_ID:-}"
  arch="$(dpkg --print-architecture)"
  if [[ "${ID:-}" == "ubuntu" && "${version%%.*}" -ge 26 && "${arch}" == "amd64" ]]; then
    echo "ubuntu24.04-x64"
  fi
}

load_local_database_url() {
  local database_url
  [[ -n "${DATABASE_URL:-}" || ! -f "${LOCAL_ENV_FILE}" ]] && return 0
  database_url="$(sed -n -E 's/^DATABASE_URL=(.*)$/\1/p' "${LOCAL_ENV_FILE}" | tail -n1)"
  [[ -n "${database_url}" ]] && export DATABASE_URL="${database_url}"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --port)
      [[ $# -ge 2 && "$2" =~ ^[0-9]+$ ]] || { usage >&2; exit 1; }
      PORT_ARGS=(--port "$2")
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

cd "${DIR}"
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Tracked local changes found. Commit or stash them before redeploying." >&2
  exit 1
fi

echo "[1/5] Pulling origin/main..."
git pull --ff-only origin main

echo "[2/5] Installing locked npm dependencies..."
npm ci

PLAYWRIGHT_PLATFORM_OVERRIDE="$(playwright_platform_override)"
echo "[3/5] Updating browser binaries..."
if [[ -n "${PLAYWRIGHT_PLATFORM_OVERRIDE}" ]]; then
  PLAYWRIGHT_HOST_PLATFORM_OVERRIDE="${PLAYWRIGHT_PLATFORM_OVERRIDE}" npx playwright install chromium
else
  npx playwright install chromium
fi
npx camoufox-js fetch

load_local_database_url
if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is missing. Run ./install_local_postgres.sh before using full mode." >&2
  exit 1
fi

echo "[4/5] Applying forward PostgreSQL migrations..."
npx prisma migrate deploy

echo "[5/5] Restarting full mode..."
exec ./restart.sh --full "${PORT_ARGS[@]}"
