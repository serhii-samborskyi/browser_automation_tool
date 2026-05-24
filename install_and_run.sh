#!/usr/bin/env bash
set -euo pipefail

# Installs dependencies and starts the app on a static port.
# Usage:
#   ./install_and_run.sh --port 4300
#   ./install_and_run.sh 4300

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT_ARG=""

if [[ $# -gt 0 ]]; then
  case "$1" in
    --port)
      if [[ $# -lt 2 ]]; then
        echo "Usage: $0 [PORT | --port PORT]" >&2
        exit 1
      fi
      PORT_ARG="$2"
      ;;
    *)
      PORT_ARG="$1"
      ;;
  esac
fi

if [[ -z "${PORT_ARG}" ]]; then
  echo "Port is required. Example: $0 --port 4300" >&2
  exit 1
fi

if ! [[ "${PORT_ARG}" =~ ^[0-9]+$ ]] || (( PORT_ARG < 1 || PORT_ARG > 65535 )); then
  echo "Invalid port: ${PORT_ARG}. Expected 1-65535." >&2
  exit 1
fi

cd "${DIR}"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed. Install Node.js 20+ first." >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is not installed. Install npm first." >&2
  exit 1
fi

if command -v apt-get >/dev/null 2>&1; then
  SUDO=""
  if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
    if command -v sudo >/dev/null 2>&1; then
      SUDO="sudo"
    else
      echo "sudo is required for apt package install. Install sudo or run as root." >&2
      exit 1
    fi
  fi

  echo "[0/5] Installing system build dependencies (Ubuntu/Debian)..."
  ${SUDO} apt-get update
  ${SUDO} apt-get install -y build-essential make g++ python3 pkg-config xvfb
fi

echo "[1/5] Installing npm dependencies..."
npm install

echo "[2/5] Installing Playwright browsers (chromium, firefox)..."
npx playwright install chromium firefox || true

echo "[3/5] Fetching Camoufox binaries..."
npx camoufox-js fetch || true

echo "[4/5] Ensuring restart script is executable..."
chmod +x ./restart.sh

echo "[5/5] Starting app on static port ${PORT_ARG}..."
exec ./restart.sh --port "${PORT_ARG}"
