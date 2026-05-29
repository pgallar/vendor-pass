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
  docker exec "$DB_CONTAINER" psql -U postgres -d postgres -c \
    "GRANT ALL ON TABLE public.api_keys TO anon, authenticated, service_role;" >/dev/null
fi

# 0007 document lifecycle
if ! docker exec "$DB_CONTAINER" psql -U postgres -d postgres -tAc \
  "SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='documents' AND column_name='lifecycle_status'" | grep -q 1; then
  apply "$ROOT/supabase/migrations/0007_document_lifecycle.sql"
else
  echo "⊙ 0007_document_lifecycle.sql ya aplicada (columna lifecycle_status existe)"
fi

# 0008 document events
if ! docker exec "$DB_CONTAINER" psql -U postgres -d postgres -tAc \
  "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='document_events'" | grep -q 1; then
  apply "$ROOT/supabase/migrations/0008_document_events.sql"
else
  echo "⊙ 0008_document_events.sql ya aplicada (tabla document_events existe)"
fi

# 0009 vendor portal
if ! docker exec "$DB_CONTAINER" psql -U postgres -d postgres -tAc \
  "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='vendor_portal_invites'" | grep -q 1; then
  apply "$ROOT/supabase/migrations/0009_vendor_portal.sql"
else
  echo "⊙ 0009_vendor_portal.sql ya aplicada (tabla vendor_portal_invites existe)"
fi

# PostgREST cachea el schema al arrancar; recargar tras tablas nuevas.
docker exec "$DB_CONTAINER" psql -U postgres -d postgres -c "NOTIFY pgrst, 'reload schema';" >/dev/null 2>&1 || true

echo "Migraciones Docker aplicadas."
