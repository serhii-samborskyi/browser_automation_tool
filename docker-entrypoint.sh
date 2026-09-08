#!/usr/bin/env sh
set -eu

APP_USER=node
APP_GROUP=node

ensure_owned_dir() {
  directory="$1"
  mkdir -p "$directory"

  # Avoid recursively scanning persistent browser profiles on every restart.
  if [ "$(stat -c '%u:%g' "$directory")" != "$(id -u "$APP_USER"):$(id -g "$APP_GROUP")" ]; then
    chown -R "$APP_USER:$APP_GROUP" "$directory"
  fi
}

seed_missing_scripts() {
  source_dir="/app/scripts-default"
  target_dir="/app/scripts"

  [ -d "$source_dir" ] || return 0
  for script in "$source_dir"/*.js; do
    [ -f "$script" ] || continue
    target="$target_dir/$(basename "$script")"
    [ -e "$target" ] || cp "$script" "$target"
  done
}

seed_camoufox_cache() {
  cache_dir="$HOME/.cache/camoufox"
  template_dir="/opt/camoufox-cache-default"

  mkdir -p "$cache_dir"
  if [ -d "$template_dir" ] && [ -z "$(find "$cache_dir" -mindepth 1 -print -quit)" ]; then
    cp -a "$template_dir"/. "$cache_dir"/
  fi
}

ensure_owned_dir /app/data
ensure_owned_dir /app/profile
ensure_owned_dir /app/scripts
seed_missing_scripts
seed_camoufox_cache
ensure_owned_dir "$HOME/.cache/camoufox"

if [ -n "${DATABASE_URL:-}" ]; then
  echo "Applying Prisma migrations..."
  gosu "$APP_USER" npx prisma migrate deploy
fi

exec gosu "$APP_USER" "$@"
