#!/bin/sh
set -e

echo "⏳ Esperando API (gateway)..."
until node -e "
  fetch('http://gateway/rest/v1/vendors?select=id')
    .then(r => process.exit(r.ok ? 0 : 1))
    .catch(() => process.exit(1));
" 2>/dev/null; do
  sleep 1
done
echo "✓ API lista"

echo "📦 Sincronizando dependencias npm..."
npm install

echo "🔄 Backfill Arkiv (memoria si no hay credenciales)..."
npm run backfill || true

echo "🚀 Iniciando Next.js en http://localhost:3000"
exec npm run dev -- --hostname 0.0.0.0
