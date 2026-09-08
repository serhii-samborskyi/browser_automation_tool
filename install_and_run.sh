#!/usr/bin/env bash
set -euo pipefail

# Bootstrap Browser API Factory on Ubuntu/Debian and start it on a fixed port.
# Local mode needs no PostgreSQL and leaves database-backed platform features off.
# Usage:
#   ./install_and_run.sh --local --port 4300
#   ./install_and_run.sh --full --port 4300
#   ./install_and_run.sh 4300

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="4300"
MODE="local"
INSTALL_CHROME="1"
SUDO=()

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

usage() {
  cat <<EOF
Usage: $0 [--local|--full] [--port PORT] [--without-chrome]

  --local           Run scripts and the MCP service without PostgreSQL (default).
  --full            Enable PostgreSQL-backed API Builder features when DATABASE_URL is set.
  --port PORT       Static port to use (default: 4300).
  --without-chrome  Skip Google Chrome; Chromium and Camoufox are still installed.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --local)
      MODE="local"
      shift
      ;;
    --full)
      MODE="full"
      shift
      ;;
    --port)
      [[ $# -ge 2 ]] || { usage >&2; exit 1; }
      PORT="$2"
      shift 2
      ;;
    --without-chrome)
      INSTALL_CHROME="0"
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      if [[ "$1" =~ ^[0-9]+$ ]]; then
        PORT="$1"
        shift
      else
        echo "Unknown argument: $1" >&2
        usage >&2
        exit 1
      fi
      ;;
  esac
done

if ! [[ "${PORT}" =~ ^[0-9]+$ ]] || (( PORT < 1 || PORT > 65535 )); then
  echo "Invalid port: ${PORT}. Expected 1-65535." >&2
  exit 1
fi

if [[ "$(uname -s)" != "Linux" ]] || ! command -v apt-get >/dev/null 2>&1; then
  echo "This bootstrap currently supports Ubuntu/Debian. Install Node.js 22+, npm, Playwright browsers, and Camoufox manually." >&2
  exit 1
fi

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  if command -v sudo >/dev/null 2>&1; then
    SUDO=(sudo)
  else
    echo "sudo is required to install Ubuntu packages. Install sudo or run as root." >&2
    exit 1
  fi
fi

cd "${DIR}"

echo "[1/7] Installing Ubuntu system dependencies..."
"${SUDO[@]}" apt-get update
"${SUDO[@]}" apt-get install -y \
  ca-certificates curl gnupg git lsof \
  build-essential make g++ python3 pkg-config xvfb

NODE_MAJOR=0
if command -v node >/dev/null 2>&1; then
  NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
fi

if (( NODE_MAJOR < 22 )); then
  echo "[2/7] Installing Node.js 22..."
  if (( ${#SUDO[@]} )); then
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  else
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  fi
  "${SUDO[@]}" apt-get install -y nodejs
else
  echo "[2/7] Node.js $(node --version) is already installed."
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm was not installed with Node.js." >&2
  exit 1
fi

echo "[3/7] Installing npm dependencies..."
if [[ -f package-lock.json ]]; then
  npm ci
else
  npm install
fi

PLAYWRIGHT_PLATFORM_OVERRIDE="$(playwright_platform_override)"
if [[ -n "${PLAYWRIGHT_PLATFORM_OVERRIDE}" ]]; then
  echo "Ubuntu ${VERSION_ID} is newer than this Playwright release; using ${PLAYWRIGHT_PLATFORM_OVERRIDE} compatibility downloads."
fi

echo "[4/7] Installing Playwright Chromium operating-system dependencies..."
if [[ -n "${PLAYWRIGHT_PLATFORM_OVERRIDE}" ]]; then
  "${SUDO[@]}" env "PATH=${PATH}" "PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=${PLAYWRIGHT_PLATFORM_OVERRIDE}" npx playwright install-deps chromium
else
  "${SUDO[@]}" env "PATH=${PATH}" npx playwright install-deps chromium
fi

echo "[5/7] Downloading Playwright browsers and Camoufox..."
if [[ -n "${PLAYWRIGHT_PLATFORM_OVERRIDE}" ]]; then
  PLAYWRIGHT_HOST_PLATFORM_OVERRIDE="${PLAYWRIGHT_PLATFORM_OVERRIDE}" npx playwright install chromium
else
  npx playwright install chromium
fi
npx camoufox-js fetch

if [[ "${INSTALL_CHROME}" == "1" ]] && [[ "$(dpkg --print-architecture)" == "amd64" ]] && ! command -v google-chrome >/dev/null 2>&1; then
  echo "[6/7] Installing Google Chrome..."
  CHROME_DEB="$(mktemp --suffix=.deb)"
  trap 'rm -f "${CHROME_DEB:-}"' EXIT
  curl -fsSL -o "${CHROME_DEB}" https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
  "${SUDO[@]}" apt-get install -y "${CHROME_DEB}"
  rm -f "${CHROME_DEB}"
  trap - EXIT
else
  echo "[6/7] Google Chrome already installed or skipped."
fi

echo "[7/7] Starting Browser API Factory in ${MODE} mode on port ${PORT}..."
chmod +x ./restart.sh
if [[ "${MODE}" == "local" ]]; then
  exec ./restart.sh --local --port "${PORT}"
fi

exec ./restart.sh --full --port "${PORT}"
