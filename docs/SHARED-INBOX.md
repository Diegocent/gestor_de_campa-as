# Bandeja Compartida / Mini-CRM — Arquitectura y Setup

Refactor del gestor de campañas hacia una **Shared Inbox** escalable, con
**Channel Adapter Pattern** para migrar a WhatsApp Cloud API sin reescribir la
lógica de negocio.

## Estructura del monorepo

```
.
├── packages/core      # Dominio + aplicación (Clean Architecture). Sin framework.
│   └── src/
│       ├── domain/channels/   # Contrato omnichannel (IChannelAdapter, IOmnichannelMessage/Ack)
│       ├── domain/inbox/      # Entidades: Agent, Contact, Conversation, StoredMessage
│       ├── domain/campaigns/  # Entidades de campaña + personalización ({nombre})
│       └── application/       # Puertos + casos de uso (ingest, ack, send, auth, campaña)
├── apps/server        # Backend Fastify + socket.io + BullMQ + adaptador OpenWA
│   └── src/
│       ├── channels/openwa/   # OpenWaAdapter (embedded, multiDevice) + mapper
│       ├── realtime/          # SocketGateway (WebSocket + RealtimePublisher)
│       ├── queue/             # DynamicRateLimitedWorker (reciclaje en caliente)
│       ├── campaigns/         # parser por streams + servicio crear + worker
│       ├── db/                # Drizzle schema + repos
│       ├── auth/              # bcrypt + JWT
│       └── main.ts            # bootstrap (API + WS + worker co-localizado)
└── apps/web           # Frontend Vite + React + Tailwind + shadcn/ui
    └── src/features/
        ├── realtime/   # SocketProvider (un único socket compartido)
        ├── inbox/      # useConversations, useMessages, useAgents,
        │               #   ConversationList (react-window), MessageThread
        │               #   (react-virtuoso), Composer, AssignMenu, ChatPanel
        └── channel/    # useChannelStatus + QrPanel (vinculación por QR)
```

### Flujo del Channel Adapter

```
WhatsApp ──(onMessage/onAck nativo)──▶ OpenWaAdapter ──(IOmnichannelMessage)──▶
   IngestInboundMessageUseCase ──▶ Repos (Postgres) ──▶ SocketGateway ──▶ Frontend
```

Para migrar a Cloud API solo se escribe `CloudApiAdapter` implementando
`IChannelAdapter`: el resto del sistema queda intacto.

## Requisitos

- Node.js 20+
- PostgreSQL 15+ (local) o Neon (producción)
- Redis 7+
- Chromium / dependencias de Puppeteer (las usa `@open-wa/wa-automate` embebido)

## Setup local

```bash
# 1) Instalar dependencias del workspace (incluye Chromium para OpenWA)
npm install

# 2) Configurar variables de entorno
cp apps/server/.env.example apps/server/.env
cp apps/web/.env.example apps/web/.env
#   → editá DATABASE_URL, REDIS_URL y los secretos JWT_*

# 3) Crear el esquema y datos iniciales (org + agente admin)
npm run db:push        # aplica el schema Drizzle a Postgres
npm run db:seed        # crea admin@demo.com / admin1234

# 4) Levantar los servicios (cada uno en su terminal)
npm run dev:server     # http://localhost:4000  (API + WebSocket + worker de campañas)
npm run dev:web        # http://localhost:5173  (frontend)
```

> El worker de BullMQ está **co-localizado** dentro del proceso del server,
> porque OpenWA embebido mantiene una única sesión de WhatsApp en ese proceso
> (es donde vive el socket de envío). El limitador de tasa dinámico y su
> reciclaje en caliente funcionan igual. Al migrar a Cloud API (envío stateless)
> se puede separar el worker a su propio proceso sin tocar la lógica.

### Postgres y Redis con Docker (rápido)

El repo incluye un `docker-compose.yml` con Postgres + Redis:

```bash
npm run infra:up      # levanta postgres + redis
npm run infra:down    # los detiene
```

## Escanear el QR de WhatsApp (OpenWA)

1. Iniciá `npm run dev:server`. El adaptador OpenWA arranca en segundo plano.
2. Ingresá al frontend (`http://localhost:5173`) con `admin@demo.com / admin1234`.
3. El frontend muestra el QR en pantalla automáticamente (pestaña Bandeja)
   mientras WhatsApp no esté vinculado. El backend también lo expone en
   `GET /channel/qr` (autenticado) y lo emite por WebSocket (`channel:state`).
4. Para verlo por API:
   ```bash
   curl -H "Authorization: Bearer <accessToken>" http://localhost:4000/channel/qr
   ```
   Escaneá el valor `qr` (data URL) desde WhatsApp → Dispositivos vinculados.
5. Con `OPENWA_HEADLESS=false` se abre el navegador y se ve el QR directamente.

## Limitador de tasa dinámico (sin reiniciar Node)

El worker arranca con el límite de la organización (o `RATE_LIMIT_MAX` /
`RATE_LIMIT_DURATION_MS` por defecto). Se cambia en caliente desde la UI
(pestaña Campañas → "Límite de envío", que hace `PATCH /settings/send-rate`) o
publicando directamente en el canal Redis `rate-limit:update`:

```bash
redis-cli PUBLISH rate-limit:update '{"max":3,"durationMs":300000}'
```

El worker cierra suavemente el proceso activo (`worker.close()`, espera el job en
curso) e instancia uno nuevo con el nuevo límite.

## Campañas masivas (importación por streams)

1. Pestaña **Campañas** → "Nueva campaña": título, mensaje (con `{nombre}` para
   personalizar), fecha opcional y archivo `.csv` o `.xlsx`.
2. El backend procesa el archivo **por streams** (`csv-parser` para CSV,
   `exceljs` WorkbookReader para XLSX), sin cargarlo entero en RAM.
3. Los destinatarios se insertan en **lotes** (Bulk Create) y cada envío se
   **encola en BullMQ**; el worker los procesa respetando el limitador de tasa.
4. La lista muestra el progreso en vivo (enviados / fallidos / total) y permite
   cancelar campañas en curso (quita los jobs pendientes de la cola).

Columnas reconocidas en el archivo: teléfono (`phone`, `telefono`, `celular`,
`numero`, `whatsapp`...) y nombre (`nombre`, `name`, `cliente`, `contacto`...).

## Roadmap

- **Fase 1 (hecho):** monorepo, contrato omnichannel + adaptador OpenWA, auth JWT,
  WebSockets, esquema de inbox, limitador dinámico con reciclaje de workers.
- **Fase 2 (hecho):** UI completa del inbox — hilo de mensajes virtualizado
  (react-virtuoso) con auto-scroll y acuses de recibo, composer de envío,
  asignación de agentes en vivo, reordenamiento dinámico del sidebar y
  vinculación por QR en pantalla.
- **Fase 3 (hecho):** campañas masivas con importación de Excel/CSV vía Streams,
  inserción por lotes y encolado en BullMQ usando el limitador dinámico, con UI
  de creación/seguimiento y ajuste del ritmo de envío en caliente.

> El Next.js legacy fue **eliminado**: toda su funcionalidad vive ahora en el
> monorepo (`apps/` + `packages/`).
