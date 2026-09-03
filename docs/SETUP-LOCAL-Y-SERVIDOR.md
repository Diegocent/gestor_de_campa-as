# Levantar el proyecto (Local y Servidor)

Guía práctica para levantar el monorepo `gestor-de-campanas` y conectarlo con el **OpenWA Gateway** (Docker), con:
- PostgreSQL + Redis (Docker)
- Backend (Fastify + Socket.IO + BullMQ)
- Frontend (Vite + React)
- Migraciones/seed (Drizzle)

---

## Requisitos

### En local
- Node.js (20+ recomendado)
- npm
- Docker Desktop corriendo

### En servidor
- Docker Engine + Docker Compose
- Node.js (si correrás backend/frontend “en host”)
- PostgreSQL accesible (local vía Docker o externo gestionado)
- Redis accesible (local vía Docker o externo)

---

## Levantar TODO localmente (Docker + backend + frontend)

Desde la raíz del proyecto `gestor-campañas`:

1. **Instalar dependencias (monorepo)**
   ```bash
   npm install
   ```

2. **Configurar variables de entorno**
   ```bash
   cp apps/server/.env.example apps/server/.env
   cp apps/web/.env.example apps/web/.env
   ```

   En `apps/server/.env` completá al menos:
   - `DATABASE_URL` (Postgres)
   - `JWT_ACCESS_SECRET` y `JWT_REFRESH_SECRET`
   - `OPENWA_GATEWAY_API_KEY` (debe coincidir con el `API_MASTER_KEY` del contenedor OpenWA)
   - `OPENWA_GATEWAY_WEBHOOK_URL` (en local, por defecto funciona con `host.docker.internal`)

3. **Levantar infraestructura**
   ```bash
   npm run infra:up
   ```
   Esto levanta:
   - `postgres` (DB)
   - `redis` (colas)
   - `openwa` (gateway en `http://localhost:2785`, con dashboard + API)

4. **Aplicar schema y seed**
   ```bash
   npm run db:push
   npm run db:seed
   ```
   El seed crea el admin:
   - `admin@demo.com`
   - `admin1234`

5. **Levantar backend**
   En una terminal:
   ```bash
   npm run dev:server
   ```
   Backend en: `http://localhost:4000`

6. **Levantar frontend**
   En otra terminal:
   ```bash
   npm run dev:web
   ```
   Frontend en: `http://localhost:5173`

---

## Probar que el canal OpenWA Gateway está OK

Desde el host:
```bash
curl http://localhost:2785/api/health
```

Si responde `{ "status": "ok" ... }`, el gateway está saludable.

En tu UI, en la pestaña correspondiente a QR, el sistema debería mostrar un QR cuando la sesión no esté vinculada.

---

## Levantar en un servidor (Docker + backend/frontend)

La idea recomendada es:
- usar Docker en el servidor para `postgres` + `redis` + `openwa`
- correr el backend/frontend con Node en el mismo servidor (para evitar armar más contenedores)

### 1) Preparar el proyecto en el servidor
```bash
git clone <tu-repo>
cd gestor-campañas
npm install
```

### 2) Configurar `.env`
```bash
cp apps/server/.env.example apps/server/.env
cp apps/web/.env.example apps/web/.env
```

En `apps/server/.env` revisá especialmente:
- `DATABASE_URL`: apuntar al Postgres real del servidor
- `REDIS_URL`: apuntar al Redis real del servidor
- `JWT_ACCESS_SECRET` y `JWT_REFRESH_SECRET`
- `OPENWA_GATEWAY_API_KEY`: debe coincidir con `API_MASTER_KEY` del contenedor OpenWA
- `OPENWA_GATEWAY_WEBHOOK_URL`: **tiene que ser una URL accesible desde el contenedor OpenWA hacia el backend**

Ejemplo si backend corre en el host del servidor (mismo puerto 4000):
- `OPENWA_GATEWAY_WEBHOOK_URL=http://<IP_SERVIDOR_PUBLICA_O_PRIVADA>:4000/webhooks/openwa`

> Importante: en producción NO sirve `localhost` dentro de Docker. Debe ser una ruta que OpenWA pueda resolver/alcanzar.

En `apps/web/.env` revisá:
- `VITE_SOCKET_URL=http://<IP_SERVIDOR>:4000` (o la URL correcta para tu entorno)
- CORS (`CORS_ORIGIN`) según tu dominio.

### 3) Levantar infraestructura (Docker)
```bash
npm run infra:up
```

Si en tu servidor OpenWA no puede llegar al webhook (por SSRF allowlist), ajustá en `docker-compose.yml`:
- `SSRF_ALLOWED_HOSTS` (allowlist del host destino para webhooks)

`host.docker.internal` es confiable principalmente en Docker Desktop; en servidores Linux puede no funcionar.

### 4) Migrar schema y seed
```bash
npm run db:push
npm run db:seed
```

### 5) Levantar backend y frontend

Backend (en modo producción recomendado):
```bash
npm run build -w @gestor/server
npm run start -w @gestor/server
```

Frontend:
```bash
npm run build -w @gestor/web
```

Para servir el frontend build en servidor, lo normal es usar Nginx u otro servidor estático. Si querés hacerlo “rápido”, podés también usar:
```bash
npm run preview -w @gestor/web
```

## Opción A: todo en Docker Compose (prod completo)

Si preferís que backend + frontend también corran como contenedores, podés usar:

1) `docker-compose.prod.yml` (incluye `postgres`, `redis`, `openwa`, `server` y `web/nginx`)

2) Ajustá (si hace falta) `apps/server/.env` y especialmente `CORS_ORIGIN` para que coincida con tu dominio.

3) Levantá:
```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Endpoints:
- Web: `http://<TU_DOMINIO>` (nginx)
- API/WS: por el mismo host (nginx proxiea hacia el backend)
- OpenWA dashboard/API: `http://<IP>:2785` (o el puerto que publiques en el compose)

---

## Variables clave (resumen)

- `apps/server/.env`
  - `OPENWA_GATEWAY_URL` (por defecto: `http://localhost:2785`)
  - `OPENWA_GATEWAY_API_KEY` (debe coincidir)
  - `OPENWA_GATEWAY_WEBHOOK_URL` (URL alcanzable desde el contenedor OpenWA)
  - `DATABASE_URL`, `REDIS_URL`, secretos JWT

- `docker-compose.yml`
  - `openwa.API_MASTER_KEY` (debe coincidir con `OPENWA_GATEWAY_API_KEY`)
  - `openwa.SSRF_ALLOWED_HOSTS` si en servidor hay bloqueo por SSRF

---

## Notas finales

- El backend levanta el worker de campañas co-localizado (en el mismo proceso de Node).
- Las sesiones de WhatsApp quedan persistidas en el volumen `openwadata` del contenedor OpenWA.
- Si cambias rutas/puertos para producción, revisá especialmente `OPENWA_GATEWAY_WEBHOOK_URL` y CORS.

