#!/bin/sh
# Cron diario: recalcula status y sincroniza Postgres → Arkiv Braga.
set -e

echo "⏳ Esperando API (gateway)..."
until node -e "
  fetch('http://gateway/rest/v1/vendors?select=id')
    .then(r => process.exit(r.ok ? 0 : 1))
    .catch(() => process.exit(1));
" 2>/dev/null; do
  sleep 2
done
echo "✓ API lista"

if [ ! -d node_modules/tsx ]; then
  echo "📦 Instalando dependencias npm..."
  npm install
fi

if ! command -v cron >/dev/null 2>&1; then
  echo "📦 Instalando cron..."
  apt-get update -qq
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq cron >/dev/null
fi

SCHEDULE="${ARKIV_SYNC_CRON:-0 5 * * *}"
LOG=/var/log/arkiv-sync.log
touch "$LOG"

# crontab: entorno mínimo + sync (UTC)
{
  echo "SHELL=/bin/sh"
  echo "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
  echo "$SCHEDULE cd /app && node --env-file=.env.docker ./node_modules/.bin/tsx scripts/sync-arkiv-status.ts && node --env-file=.env.docker ./node_modules/.bin/tsx scripts/send-expiration-emails.ts >> $LOG 2>&1"
} | crontab -

echo "📅 Cron Arkiv activo (UTC): $SCHEDULE"
echo "   Log: $LOG"

if [ "${ARKIV_SYNC_ON_START:-false}" = "true" ]; then
  echo "🔄 Sync al arrancar..."
  node --env-file=.env.docker ./node_modules/.bin/tsx scripts/sync-arkiv-status.ts || true
  node --env-file=.env.docker ./node_modules/.bin/tsx scripts/send-expiration-emails.ts || true
fi

exec cron -f
