#!/bin/sh
set -e

echo "[worker] Esperando OpenWA Gateway..."
until node -e "
fetch('${OPENWA_GATEWAY_URL}/api/health')
  .then(r => process.exit(r.ok ? 0 : 1))
  .catch(() => process.exit(1));
" 2>/dev/null; do
  sleep 3
done

echo "[worker] OpenWA disponible. Iniciando worker..."
exec npm run worker
