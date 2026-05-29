#!/usr/bin/env bash
# Aplica migraciones SQL pendientes en el Postgres de docker compose (sin borrar datos).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB_CONTAINER="${DB_CONTAINER:-vendor-pass-db-1}"

if ! docker inspect "$DB_CONTAINER" >/dev/null 2>&1; then
  echo "Contenedor $DB_CONTAINER no encontrado. ¿Está corriendo docker compose up?"
  exit 1
fi

apply() {
  local file="$1"
  local name
  name="$(basename "$file")"
  echo "→ $name"
  docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 <"$file"
}

# 0005 profiles
if ! docker exec "$DB_CONTAINER" psql -U postgres -d postgres -tAc \
  "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='profiles'" | grep -q 1; then
  apply "$ROOT/supabase/migrations/0005_profiles.sql"
else
  echo "⊙ 0005_profiles.sql ya aplicada (tabla profiles existe)"
  docker exec "$DB_CONTAINER" psql -U postgres -d postgres -c \
    "GRANT ALL ON TABLE public.profiles TO anon, authenticated, service_role;" >/dev/null
fi

# 0006 api_keys
if ! docker exec "$DB_CONTAINER" psql -U postgres -d postgres -tAc \
  "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='api_keys'" | grep -q 1; then
  apply "$ROOT/supabase/migrations/0006_api_keys.sql"
else
  echo "⊙ 0006_api_keys.sql ya aplicada (tabla api_keys existe)"
fi

echo "Migraciones Docker aplicadas."
