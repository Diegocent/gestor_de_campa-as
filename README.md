# Bandeja Compartida / Mini-CRM de WhatsApp

Sistema de **bandeja de entrada compartida** (Shared Inbox) y **campañas masivas**
sobre WhatsApp, construido con el **Channel Adapter Pattern** para poder migrar de
`@open-wa/wa-automate` a la WhatsApp Cloud API sin reescribir la lógica de negocio.

## Stack

- **Monorepo** con npm workspaces.
- **`packages/core`** — dominio + aplicación (Clean Architecture, sin framework).
- **`apps/server`** — Node + Fastify + socket.io + BullMQ + adaptador OpenWA + Drizzle.
- **`apps/web`** — React + Vite + TypeScript + Tailwind + shadcn/ui.
- **Datos:** PostgreSQL (local / Neon) · **Cola:** Redis + BullMQ.

## Características

- Bandeja compartida multi-agente con login JWT.
- Tiempo real por WebSockets: reordenamiento dinámico del sidebar y acuses de recibo.
- Listas virtualizadas (`react-window` y `react-virtuoso`) para historiales masivos.
- Campañas masivas con importación de Excel/CSV por **streams** e inserción por lotes.
- Limitador de tasa **dinámico** con reciclaje de workers en caliente.
- Channel Adapter Pattern: un contrato omnichannel desacopla la app del proveedor.

## Inicio rápido

```bash
npm install
cp apps/server/.env.example apps/server/.env   # completá DATABASE_URL + secretos JWT
cp apps/web/.env.example apps/web/.env

npm run infra:up        # postgres + redis vía Docker (opcional)
npm run db:push         # aplica el schema
npm run db:seed         # crea admin@demo.com / admin1234

npm run dev:server      # http://localhost:4000  (API + WebSocket + worker)
npm run dev:web         # http://localhost:5173
```

La guía completa de arquitectura, setup y escaneo de QR está en
[`docs/SHARED-INBOX.md`](docs/SHARED-INBOX.md).
