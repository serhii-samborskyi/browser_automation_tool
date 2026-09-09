#!/usr/bin/env bash
set -euo pipefail

# Install and configure a local PostgreSQL database for Browser API Factory.
# The generated DATABASE_URL is stored in data/local.env with mode 600.

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="${DIR}/data"
LOCAL_ENV_FILE="${DATA_DIR}/local.env"
DB_NAME="browser_api"
DB_USER="browser_api"
DB_PASSWORD=""
APP_PORT="4300"
SUDO=()

usage() {
  cat <<EOF
Usage: $0 [--app-port PORT] [--database NAME] [--user NAME] [--password PASSWORD]

Installs PostgreSQL, creates the local database and role, writes data/local.env,
applies Prisma migrations, and starts the application in full mode.

Passwords must be at least 12 URL-safe characters: A-Z a-z 0-9 . _ ~ -
EOF
}

is_identifier() {
  [[ "$1" =~ ^[A-Za-z_][A-Za-z0-9_]{0,62}$ ]]
}

is_valid_app_port() {
  [[ "$1" =~ ^[0-9]+$ ]] && (( $1 >= 1 && $1 <= 65535 ))
}

read_database_url() {
  [[ -f "${LOCAL_ENV_FILE}" ]] || return 0
  sed -n -E 's/^DATABASE_URL=(.*)$/\1/p' "${LOCAL_ENV_FILE}" | tail -n1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --app-port)
      [[ $# -ge 2 ]] || { usage >&2; exit 1; }
      APP_PORT="$2"
      shift 2
      ;;
    --database)
      [[ $# -ge 2 ]] || { usage >&2; exit 1; }
      DB_NAME="$2"
      shift 2
      ;;
    --user)
      [[ $# -ge 2 ]] || { usage >&2; exit 1; }
      DB_USER="$2"
      shift 2
      ;;
    --password)
      [[ $# -ge 2 ]] || { usage >&2; exit 1; }
      DB_PASSWORD="$2"
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

if ! is_identifier "${DB_NAME}" || ! is_identifier "${DB_USER}"; then
  echo "Database and user names must contain only letters, numbers, and underscores." >&2
  exit 1
fi
if ! is_valid_app_port "${APP_PORT}"; then
  echo "Invalid app port: ${APP_PORT}. Expected 1-65535." >&2
  exit 1
fi
if [[ -n "${DB_PASSWORD}" && ! "${DB_PASSWORD}" =~ ^[A-Za-z0-9._~-]{12,}$ ]]; then
  echo "Password must be at least 12 URL-safe characters." >&2
  exit 1
fi
if [[ "$(uname -s)" != "Linux" ]] || ! command -v apt-get >/dev/null 2>&1; then
  echo "This bootstrap currently supports Ubuntu/Debian." >&2
  exit 1
fi
if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  if command -v sudo >/dev/null 2>&1; then
    SUDO=(sudo)
  else
    echo "sudo is required to install PostgreSQL. Install sudo or run as root." >&2
    exit 1
  fi
fi

as_postgres() {
  if (( ${#SUDO[@]} )); then
    sudo -u postgres "$@"
  else
    runuser -u postgres -- "$@"
  fi
}

cd "${DIR}"
mkdir -p "${DATA_DIR}"
EXISTING_DATABASE_URL="$(read_database_url)"

echo "[1/4] Installing and starting PostgreSQL..."
"${SUDO[@]}" apt-get update
"${SUDO[@]}" apt-get install -y postgresql postgresql-contrib
"${SUDO[@]}" systemctl enable --now postgresql

for _ in $(seq 1 30); do
  if pg_isready -q -h 127.0.0.1 -p 5432; then
    break
  fi
  sleep 1
done
if ! pg_isready -q -h 127.0.0.1 -p 5432; then
  echo "PostgreSQL did not become ready on 127.0.0.1:5432." >&2
  exit 1
fi

if [[ -n "${EXISTING_DATABASE_URL}" && -z "${DB_PASSWORD}" ]]; then
  echo "[2/4] Using existing database configuration from ${LOCAL_ENV_FILE}."
  export DATABASE_URL="${EXISTING_DATABASE_URL}"
else
  if [[ -z "${DB_PASSWORD}" ]]; then
    DB_PASSWORD="$(node -e 'console.log(require("crypto").randomBytes(24).toString("hex"))')"
  fi
  echo "[2/4] Creating or updating local database role and database..."
  if ! as_postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname = '${DB_USER}'" | grep -q 1; then
    as_postgres psql -v ON_ERROR_STOP=1 -c "CREATE ROLE \"${DB_USER}\" LOGIN PASSWORD '${DB_PASSWORD}';"
  else
    as_postgres psql -v ON_ERROR_STOP=1 -c "ALTER ROLE \"${DB_USER}\" LOGIN PASSWORD '${DB_PASSWORD}';"
  fi
  if ! as_postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname = '${DB_NAME}'" | grep -q 1; then
    as_postgres createdb --owner="${DB_USER}" "${DB_NAME}"
  fi
  DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@127.0.0.1:5432/${DB_NAME}?schema=public"
  umask 077
  printf '%s\n' "DATABASE_URL=${DATABASE_URL}" > "${LOCAL_ENV_FILE}"
  chmod 600 "${LOCAL_ENV_FILE}"
  export DATABASE_URL
fi

echo "[3/4] Applying Prisma migrations..."
npx prisma migrate deploy

echo "[4/4] Starting full mode on port ${APP_PORT}..."
exec ./restart.sh --full --port "${APP_PORT}"
