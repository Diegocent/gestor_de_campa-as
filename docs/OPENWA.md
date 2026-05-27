# Integración OpenWA

Este proyecto soporta dos formas de conectar WhatsApp. **Recomendamos el modo `gateway`**, basado en [OpenWA](https://github.com/rmyndharis/OpenWA) (API Gateway self-hosted con dashboard).

## Docker Compose (recomendado)

Todo el stack en un solo comando desde la raíz del proyecto:

```bat
scripts\setup.bat
```

O: `npm run docker:setup`

El script crea `.env`, levanta Docker, **extrae la API key de OpenWA y la guarda en `.env`**, y reinicia el worker.

Guía completa: [`docs/DOCKER.md`](./DOCKER.md) — **enlaces de acceso** y **cómo ver el token (API key)**.

Servicios levantados:

| Contenedor | Rol |
|------------|-----|
| `gestor-campanas-app` | Next.js UI + API |
| `gestor-campanas-worker` | Procesador BullMQ → OpenWA |
| `gestor-openwa-api` | Gateway WhatsApp |
| `gestor-openwa-dashboard` | Panel QR / sesiones |
| `gestor-campanas-postgres` | Base de datos |
| `gestor-campanas-redis` | Cola de jobs |

### Enlaces rápidos (Docker)

| Qué | URL |
|-----|-----|
| Gestor de campañas | http://localhost:3000 |
| Dashboard OpenWA | http://localhost:2886 |
| API OpenWA | http://localhost:2785/api |
| Swagger | http://localhost:2785/api/docs |

**Token:** `npm run docker:sync-key` · Ver [`docs/DOCKER.md`](./DOCKER.md#cómo-ver-el-token-api-key-de-openwa)

---

## Modo manual (servicios por separado)

OpenWA corre como **servicio separado**. El worker de este proyecto solo consume su API HTTP; no embebe Chromium ni binarios pesados.

### Levantar OpenWA Gateway

**Opción A — Docker (recomendado)**

```bash
git clone https://github.com/rmyndharis/OpenWA.git
cd OpenWA
docker compose -f docker-compose.dev.yml up -d
```

**Opción B — Local**

```bash
git clone https://github.com/rmyndharis/OpenWA.git
cd OpenWA
npm install
npm run dev
```

### URLs (iguales en Docker y local)

| Servicio   | URL                              | Uso |
| ---------- | -------------------------------- | --- |
| Gestor     | http://localhost:3000            | App de campañas |
| Dashboard  | http://localhost:2886            | QR y sesión WhatsApp |
| API REST   | http://localhost:2785/api        | Gateway OpenWA |
| Swagger    | http://localhost:2785/api/docs   | Documentación interactiva |
| Health     | http://localhost:2785/api/health | Comprobar que OpenWA responde |

Ver también: [Cómo ver el token](#cómo-ver-el-token-api-key) y [`docs/DOCKER.md`](./DOCKER.md).

### Configurar este proyecto

En `.env`:

```env
OPENWA_MODE=gateway
OPENWA_GATEWAY_URL=http://localhost:2785
OPENWA_API_KEY=tu-api-key-del-dashboard
OPENWA_SESSION_ID=gestor-campanas
```

1. Obtené la API key (ver sección siguiente).
2. Iniciá el worker: `npm run worker` (local) o `docker compose up -d worker` (Docker).
3. Si la sesión requiere QR, escanealo en http://localhost:2886 o vía:
   `GET http://localhost:2785/api/sessions/{sessionId}/qr`

### Cómo ver el token (API key)

| Método | Comando / acción |
|--------|------------------|
| Automático | `npm run docker:sync-key` → escribe en `.env` y muestra la clave |
| Logs Docker | `docker compose logs openwa-api \| findstr owa_k1` |
| Archivo `.env` | `type .env \| findstr OPENWA_API_KEY` |
| Dashboard | http://localhost:2886 → API Keys / configuración |

Después de cambiar la clave: `docker compose restart worker`.

### Enviar mensaje (referencia API)

```bash
curl -X POST http://localhost:2785/api/sessions/gestor-campanas/messages/send-text \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{"chatId": "595981123456@c.us", "text": "Hola desde OpenWA"}'
```

---

## Modo alternativo: Embedded (`@open-wa/wa-automate`)

El worker lanza OpenWA directamente en el mismo proceso Node.js. Útil si no querés levantar el gateway aparte.

```env
OPENWA_MODE=embedded
OPENWA_SESSION_ID=gestor-campanas
OPENWA_HEADLESS=true
OPENWA_MULTI_DEVICE=true
```

> En Windows puede ser necesario `npm install --ignore-scripts` por el postinstall de `@open-wa/wa-automate`.

---

## Arquitectura con Gateway

```
┌─────────────────┐     REST      ┌──────────────────┐
│ Worker (BullMQ) │ ────────────► │ OpenWA Gateway   │
│ npm run worker  │               │ :2785 API        │
└────────┬────────┘               │ :2886 Dashboard  │
         │                        └────────┬─────────┘
         │ Redis                           │ whatsapp-web.js
         ▼                                   ▼
    ┌─────────┐                         WhatsApp Web
    │  Redis  │
    └─────────┘
```

El **rate limiting de 10 msgs / 5 min** lo aplica nuestro worker (BullMQ), independiente del rate limit configurable del gateway.

---

## Producción

| Componente              | Dónde correr                          |
| ----------------------- | ------------------------------------- |
| Next.js (UI + API)      | Vercel                                |
| Worker BullMQ           | VPS / Railway                         |
| OpenWA Gateway          | Mismo VPS o contenedor Docker dedicado |
| PostgreSQL              | Neon                                  |
| Redis                   | Upstash                               |

Perfil Docker producción de OpenWA:

```bash
docker compose --profile full up -d
```

---

## Referencias

- Repositorio: https://github.com/rmyndharis/OpenWA
- Documentación: `docs/` dentro del repo OpenWA
- API interactiva: http://localhost:2785/api/docs
