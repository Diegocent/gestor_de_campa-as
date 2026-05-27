#!/bin/sh
set -e

echo "[migrate] Esperando PostgreSQL..."
until node -e "
const net = require('net');
const s = net.createConnection(5432, 'postgres');
s.on('connect', () => { s.end(); process.exit(0); });
s.on('error', () => process.exit(1));
" 2>/dev/null; do
  sleep 2
done

echo "[migrate] Aplicando esquema..."
npm run db:push

echo "[migrate] Seed organización por defecto..."
npm run db:seed

echo "[migrate] Listo."
