# Docker — Stack completo

Guía para levantar **todos los servicios juntos** con Docker Compose: PostgreSQL, Redis, OpenWA Gateway, Dashboard, Next.js y Worker.

## Inicio rápido

```bash
cp .env.docker.example .env
npm run docker:up
```

Ver logs:

```bash
npm run docker:logs
```

Detener todo:

```bash
npm run docker:down
```

> La **primera build** puede tardar 10–20 minutos: clona [OpenWA](https://github.com/rmyndharis/OpenWA) desde GitHub, instala Chromium y compila Next.js.

---

## Servicios y puertos

| Contenedor | Puerto (host) | URL / acceso | Rol |
|------------|---------------|--------------|-----|
| `gestor-campanas-app` | 3000 | http://localhost:3000 | UI + API Next.js |
| `gestor-openwa-dashboard` | 2886 | http://localhost:2886 | Panel QR / sesiones WhatsApp |
| `gestor-openwa-api` | 2785 | http://localhost:2785/api | Gateway REST OpenWA |
| `gestor-campanas-postgres` | 3069 | `localhost:3069` | PostgreSQL del gestor |
| `gestor-campanas-redis` | 6379 | `localhost:6379` | Cola BullMQ |
| `gestor-campanas-worker` | — | (sin puerto expuesto) | Procesa jobs y envía vía OpenWA |
| `gestor-campanas-migrate` | — | (one-shot, se detiene solo) | Aplica esquema DB + seed |

Swagger OpenWA: http://localhost:2785/api/docs

---

## Enlaces de acceso

Usá estos enlaces **desde el navegador de la misma PC** donde corre Docker:

| Qué | URL | Para qué sirve |
|-----|-----|----------------|
| **Gestor de campañas** | http://localhost:3000 | Programar envíos, importar Excel, ver campañas |
| **OpenWA Dashboard** | http://localhost:2886 | Ver sesión WhatsApp, escanear QR, estado de conexión |
| **OpenWA API (base)** | http://localhost:2785/api | Endpoint REST que usa el worker |
| **OpenWA Swagger** | http://localhost:2785/api/docs | Probar la API manualmente |
| **Health OpenWA** | http://localhost:2785/api/health | Verificar que el gateway responde |

> PostgreSQL (`localhost:3069`) y Redis (`localhost:6379`) son para herramientas técnicas; no hace falta abrirlos en el navegador para usar el gestor.

### Orden recomendado la primera vez

1. http://localhost:2785/api/health → debe responder OK.
2. http://localhost:2886 → conectar WhatsApp (QR).
3. http://localhost:3000 → crear la primera campaña.

---

## Cómo ver el token (API key de OpenWA)

OpenWA **genera su propia clave** al arrancar (formato `owa_k1_...`). El worker la necesita en `.env` como `OPENWA_API_KEY`.

### Opción 1 — Automática (recomendada)

Durante `scripts\setup.bat` o con:

```bat
npm run docker:sync-key
docker compose restart worker
```

El script lee los logs, muestra la clave en pantalla y la guarda en `.env`.

### Opción 2 — Ver en los logs de Docker

**Windows (CMD / PowerShell):**

```bat
docker compose logs openwa-api | findstr owa_k1
```

**PowerShell (solo la clave):**

```powershell
docker compose logs openwa-api 2>&1 | Select-String -Pattern "owa_k1_[a-f0-9]{64}"
```

Copiá la línea que empieza con `owa_k1_` y pegala en `.env`:

```env
OPENWA_API_KEY=owa_k1_tu_clave_aqui
```

Luego reiniciá el worker:

```bat
docker compose restart worker
```

### Opción 3 — Ver la clave ya guardada en `.env`

**Windows:**

```bat
type .env | findstr OPENWA_API_KEY
```

**PowerShell:**

```powershell
Get-Content .env | Select-String OPENWA_API_KEY
```

### Opción 4 — Dashboard OpenWA

1. Abrí http://localhost:2886
2. Entrá a la sección de **API Keys** o configuración del gateway (según versión del dashboard).
3. Copiá la clave y verificá que coincida con la de `.env`.

> Si el dashboard muestra “API key inválida”, casi siempre es porque `.env` tiene una clave vieja. Usá `npm run docker:sync-key` y reiniciá el worker.

### Cuándo volver a sincronizar el token

- Primera instalación en una PC nueva
- Después de `scripts\reset-openwa-session.bat` o borrar el volumen `openwa_data`
- Si el worker falla con error de autenticación contra OpenWA

---

## Orden de arranque

```mermaid
flowchart TD
  PG[postgres] --> M[migrate]
  R[redis] --> A[app]
  M --> A
  M --> W[worker]
  R --> W
  OWA[openwa-api] --> D[openwa-dashboard]
  OWA --> W
```

1. **postgres** y **redis** arrancan y pasan healthcheck.
2. **migrate** ejecuta `db:push` + `db:seed` y termina.
3. **app** y **worker** arrancan cuando migrate terminó OK.
4. **openwa-api** debe estar healthy antes de que **worker** procese envíos.
5. **openwa-dashboard** depende de openwa-api.

---

## Variables de entorno (`.env`)

Copiá desde `.env.docker.example`. La **API key** se obtiene con los métodos de la sección [Cómo ver el token](#cómo-ver-el-token-api-key-de-openwa) (más abajo en este documento).

Ejemplo en `.env`:

```env
OPENWA_API_KEY=owa_k1_9d85c8772d5eba818f77978635d3dbc6a80a5a5bd573033b8d5cce0d42190ca3
OPENWA_SESSION_ID=gestor-campanas
VITE_API_URL=http://localhost:2785
```

> OpenWA **genera su propia clave** al primer arranque. La variable `gestor-openwa-dev-key` del ejemplo anterior **no funciona** — no es la clave real del gateway.

### Variables internas (automáticas en Compose)

No hace falta definirlas en `.env`; Compose las inyecta:

| Variable | Valor en Docker |
|----------|-----------------|
| `DATABASE_URL` | `postgresql://campanas:campanas_secret@postgres:5432/gestor_campanas` |
| `REDIS_URL` | `redis://redis:6379` |
| `OPENWA_MODE` | `gateway` |
| `OPENWA_GATEWAY_URL` | `http://openwa-api:2785` (red interna) |

> Cambiá `OPENWA_API_KEY` en producción. Debe coincidir en OpenWA (`API_MASTER_KEY`) y en el worker.

---

## Primer uso de WhatsApp

1. Esperá a que todos los contenedores estén `healthy` / `running`:
   ```bash
   docker compose ps
   ```
2. Abrí http://localhost:2886 (dashboard OpenWA).
3. Creá o iniciá la sesión `gestor-campanas` (o el valor de `OPENWA_SESSION_ID`).
4. Escaneá el código QR con WhatsApp.
5. Abrí http://localhost:3000 y programá una campaña de prueba.

---

## Comandos npm

| Comando | Descripción |
|---------|-------------|
| `npm run docker:up` | `docker compose up -d --build` — construye y levanta todo |
| `npm run docker:down` | Detiene y elimina contenedores (conserva volúmenes) |
| `npm run docker:logs` | Logs en tiempo real de todos los servicios |
| `npm run docker:infra` | Solo `postgres` + `redis` (dev local sin containerizar la app) |

### Comandos Docker útiles

```bash
# Reconstruir un servicio
docker compose build app
docker compose up -d app

# Logs de un servicio
docker compose logs -f worker

# Ver estado
docker compose ps
```

---

## Archivos Docker del proyecto

```
docker-compose.yml              # Orquestación del stack completo
Dockerfile                      # Targets: app (Next.js) | worker (cola)
.env.docker.example             # Variables para Docker
docker/
├── openwa/
│   ├── Dockerfile.api          # Build OpenWA API (clone GitHub)
│   ├── Dockerfile.dashboard    # Build dashboard OpenWA
│   └── nginx.dashboard.conf    # Proxy /api hacia openwa-api
└── scripts/
    ├── migrate.sh              # Espera Postgres + db:push + db:seed
    └── wait-openwa.sh          # Espera health OpenWA + inicia worker
```

Volúmenes persistentes:

| Volumen | Contenido |
|---------|-----------|
| `postgres_data` | Datos del gestor (campañas, mensajes) |
| `redis_data` | Jobs BullMQ |
| `openwa_data` | Sesión WhatsApp + media OpenWA |

---

## Solo infraestructura (desarrollo híbrido)

Si preferís correr Next.js y el worker **en tu máquina** pero Postgres/Redis en Docker:

```bash
npm run docker:infra
cp .env.example .env          # URLs con localhost:3069 y localhost:6379
npm run db:push && npm run db:seed
npm run dev                   # terminal 1
npm run worker                # terminal 2 (+ OpenWA aparte)
```

Ver también [`docs/OPENWA.md`](./OPENWA.md) para levantar OpenWA manualmente.

---

## Solución de problemas

### La build de OpenWA falla o tarda mucho

- Requiere conexión a internet (clone de GitHub).
- Reintenta: `docker compose build openwa-api --no-cache`

### El worker no envía mensajes

1. Verificá OpenWA: http://localhost:2785/api/health
2. Revisá logs: `docker compose logs -f worker openwa-api`
3. Confirmá que la sesión WhatsApp esté conectada en el dashboard.

### `migrate` falló

```bash
docker compose logs migrate
docker compose run --rm migrate sh docker/scripts/migrate.sh
```

### Cambié código y no se refleja

```bash
docker compose up -d --build app worker
```

---

## Producción

Para producción no uses tal cual el compose de desarrollo. Separá:

| Componente | Recomendación |
|------------|---------------|
| Next.js | Vercel |
| PostgreSQL | Neon |
| Redis | Upstash |
| Worker + OpenWA | VPS con `docker compose` o servicios dedicados |

Cambiá contraseñas, `OPENWA_API_KEY` y restringí puertos expuestos (no publiques 6379/3069 a internet).
