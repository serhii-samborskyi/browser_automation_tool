#!/usr/bin/env bash
set -euo pipefail

# Restart the automation runner by freeing the configured port then running npm start.
# Modes:
# - --local: scripts, manual runs, and MCP without PostgreSQL.
# - --full: PostgreSQL-backed API Builder, proxy pools, and managed profiles.
# Port priority:
# 1) CLI arg: ./restart.sh 4300 OR ./restart.sh --port 4300
# 2) PORT env var
# 3) config.ini port
# 4) random free port persisted to config.ini

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CFG_FILE="${DIR}/config.ini"
RUN_DIR="${DIR}/data"
PID_FILE="${RUN_DIR}/server.pid"
LOG_FILE="${RUN_DIR}/server.log"
PORT_FROM_ARG=""
PORT="${PORT:-}"
FORCE_XVFB="${FORCE_XVFB:-0}"
DAEMON_MODE="${DAEMON_MODE:-1}"
LOCAL_MODE="${LOCAL_MODE:-0}"

read_port_from_config() {
  [[ -f "${CFG_FILE}" ]] || return 0
  grep -E '^port[[:space:]]*=' "${CFG_FILE}" | tail -n1 | sed -E 's/[^0-9]*([0-9]+).*/\1/' || true
}

is_port_in_use() {
  local p="$1"
  lsof -ti tcp:"${p}" >/dev/null 2>&1
}

is_valid_port() {
  local p="$1"
  [[ "${p}" =~ ^[0-9]+$ ]] && (( p >= 1 && p <= 65535 ))
}

pick_random_free_port() {
  local tries=200
  local p
  while (( tries > 0 )); do
    p=$(( (RANDOM % 35000) + 20000 ))
    if ! is_port_in_use "${p}"; then
      echo "${p}"
      return 0
    fi
    tries=$((tries - 1))
  done
  return 1
}

persist_port_to_config() {
  local p="$1"
  if [[ -f "${CFG_FILE}" ]] && grep -qE '^port[[:space:]]*=' "${CFG_FILE}"; then
    sed -E -i.bak "s/^port[[:space:]]*=.*/port=${p}/" "${CFG_FILE}"
    rm -f "${CFG_FILE}.bak"
  else
    {
      [[ -f "${CFG_FILE}" ]] && cat "${CFG_FILE}"
      echo "port=${p}"
    } > "${CFG_FILE}.tmp"
    mv "${CFG_FILE}.tmp" "${CFG_FILE}"
  fi
}

# Parse CLI args
while [[ $# -gt 0 ]]; do
  case "$1" in
    --port)
      if [[ $# -lt 2 ]]; then
        echo "Usage: $0 [PORT | --port PORT] [--local|--full] [--xvfb] [--daemon|--foreground]" >&2
        exit 1
      fi
      PORT_FROM_ARG="$2"
      shift 2
      ;;
    --xvfb)
      FORCE_XVFB="1"
      shift
      ;;
    --no-xvfb)
      FORCE_XVFB="0"
      shift
      ;;
    --local)
      LOCAL_MODE="1"
      shift
      ;;
    --full)
      LOCAL_MODE="0"
      shift
      ;;
    --daemon)
      DAEMON_MODE="1"
      shift
      ;;
    --foreground)
      DAEMON_MODE="0"
      shift
      ;;
    *)
      PORT_FROM_ARG="$1"
      shift
      ;;
  esac
done

if [[ -n "${PORT_FROM_ARG}" ]]; then
  if ! is_valid_port "${PORT_FROM_ARG}"; then
    echo "Invalid port: ${PORT_FROM_ARG}. Expected 1-65535." >&2
    exit 1
  fi
  PORT="${PORT_FROM_ARG}"
  persist_port_to_config "${PORT}"
  echo "Using CLI port: ${PORT}"
fi

if [[ -z "${PORT}" ]]; then
  cfg_port="$(read_port_from_config)"
  if [[ -n "${cfg_port}" ]]; then
    PORT="${cfg_port}"
  else
    PORT="$(pick_random_free_port)"
    persist_port_to_config "${PORT}"
    echo "No port configured. Picked random static port: ${PORT}"
  fi
fi

# Final fallback (very unlikely)
PORT="${PORT:-4000}"

echo "Stopping any process on port ${PORT}..."
if is_port_in_use "${PORT}"; then
  lsof -ti tcp:"${PORT}" | xargs kill -9 || true
  sleep 1
else
  echo "No process found on ${PORT}"
fi

echo "Starting server on port ${PORT}..."
cd "${DIR}"
mkdir -p "${RUN_DIR}"

START_CMD=(env PORT="${PORT}" LOCAL_MODE="${LOCAL_MODE}" npm start)
if [[ "${LOCAL_MODE}" == "1" || "${LOCAL_MODE}" == "true" || "${LOCAL_MODE}" == "TRUE" ]]; then
  echo "Local mode enabled: PostgreSQL-backed API Builder features are disabled."
fi
if [[ "$(uname -s)" == "Linux" && ( "${FORCE_XVFB}" == "1" || -z "${DISPLAY:-}" ) ]]; then
  if command -v xvfb-run >/dev/null 2>&1; then
    START_CMD=(xvfb-run -a -s "-screen 0 1920x1080x24 -ac +extension RANDR" "${START_CMD[@]}")
    echo "Starting with xvfb-run..."
  else
    echo "No DISPLAY detected and xvfb-run is missing." >&2
    echo "Install it with: sudo apt-get update && sudo apt-get install -y xvfb" >&2
    exit 1
  fi
fi

if [[ "${DAEMON_MODE}" == "1" ]]; then
  : > "${LOG_FILE}"
  nohup "${START_CMD[@]}" >> "${LOG_FILE}" 2>&1 &
  APP_PID="$!"
  echo "${APP_PID}" > "${PID_FILE}"
  sleep 1
  echo "Server started in background."
  echo "PID: ${APP_PID}"
  echo "Log: ${LOG_FILE}"
  echo "URL: http://localhost:${PORT}"
  exit 0
fi

exec "${START_CMD[@]}"
