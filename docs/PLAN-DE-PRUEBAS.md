# Plan de pruebas — Gestor de campañas

Lista para ir marcando. Abrí **http://localhost:5173**.

**Credenciales seed:** `admin@demo.com` / `admin1234`

Infra esperada en local:

| Servicio | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend | http://localhost:4000 |
| Health | http://localhost:4000/health |
| OpenWA Gateway | http://localhost:2785 |

---

## Cómo usar esta lista

Para cada caso: **qué hacés** → **qué tiene que pasar** → **si no pasa, está mal**.

Al final de cada sección hay casos que **deben fallar** a propósito, para chequear mensajes de error.

Marcá con `[x]` lo que ya probaste.

---

## A. Login y sesión

- [ ] **A1 — Login correcto**  
  Email `admin@demo.com`, pass `admin1234`.  
  **OK si:** entra a Bandeja, ves tu nombre arriba a la derecha, ícono WiFi verde (socket).

- [ ] **A2 — Logout**  
  Botón de salir.  
  **OK si:** vuelve a la pantalla de login.

- [ ] **A3 — Recarga con sesión**  
  Login → F5.  
  **OK si:** seguís logueado (no te pide login de nuevo).

- [ ] **A4 — Email HTML inválido**  
  Escribí `noesunemail` y submit.  
  **OK si:** el navegador bloquea (campo `type=email` required).

### Casos que deben fallar (A)

- [ ] **AF1** — Password incorrecta (`admin1234x`)  
  **Mensaje esperado:** texto rojo **Credenciales inválidas**

- [ ] **AF2** — Email válido que no existe (`nadie@demo.com`)  
  **Mensaje esperado:** **Credenciales inválidas**

- [ ] **AF3** — (Opcional, DevTools) `POST http://localhost:4000/auth/login` sin body  
  **Esperado:** **400** `{ "error": "Datos inválidos" }`

- [ ] **AF4** — `GET http://localhost:4000/conversations` sin token  
  **Esperado:** **401** `{ "error": "No autorizado" }`

- [ ] **AF5** — Header `Authorization: Bearer sarasa`  
  **Esperado:** **401** `{ "error": "Token inválido o expirado" }`

---

## B. Canales (multi-número)

Pestaña **Canales**.

- [ ] **B1 — Sesión default**  
  Entrá a Canales.  
  **OK si:** aparece al menos `gestor-campanas` (o el nombre de `OPENWA_GATEWAY_SESSION_NAME` en `.env`).

- [ ] **B2 — Agregar número**  
  Agregar número → `ventas` → Crear.  
  **OK si:** sale en la lista; estado “Desconectado” o “Esperando escaneo de QR”.

- [ ] **B3 — QR**  
  Esperá unos segundos (polling cada 3 s).  
  **OK si:** si hace falta QR, ves imagen y texto “Escaneá este QR…”.

- [ ] **B4 — Vincular**  
  Escaneá con un WhatsApp real.  
  **OK si:** pasa a **Conectado** (icono verde).

- [ ] **B5 — Segundo número**  
  Creá `soporte` y vinculá **otro** teléfono.  
  **OK si:** dos sesiones **Conectado** al mismo tiempo.

- [ ] **B6 — Eliminar**  
  Basurero → confirmar.  
  **OK si:** desaparece de la lista (el WhatsApp puede seguir vivo en el gateway hasta que lo cortes ahí).

### Casos que deben fallar (B)

- [ ] **BF1** — Crear sesión con el **mismo nombre** dos veces  
  **Mensaje esperado:** **Ya existe una sesión con ese nombre**

- [ ] **BF2** — Nombre con espacios o símbolos: `mi sesion!`  
  **Mensaje esperado:** **Datos inválidos** (solo letras, números, `-` y `_`)

- [ ] **BF3** — Nombre vacío y Crear  
  **Esperado:** no llama al API (no hace nada si está vacío)

- [ ] **BF4** — (DevTools) `DELETE /api/channels/sessions/no-existe` con token  
  **Esperado:** **404** `{ "error": "Sesión no encontrada" }`

---

## C. Bandeja unificada y rotación

Necesitás **al menos 2 números conectados** (B4 + B5) y 2 contactos distintos que te escriban.

- [ ] **C1 — Inbox unificado**  
  Desde el celular A escribí al número 1; desde celular B al número 2.  
  **OK si:** las dos conversaciones aparecen en **la misma** Bandeja.

- [ ] **C2 — Respuesta en vivo**  
  Abrí el chat y contestá.  
  **OK si:** el mensaje sale en WhatsApp; en la burbuja ves ticks (enviado/leído si el gateway manda ACK).

- [ ] **C3 — Stickiness (mismo número)**  
  En un chat ya abierto, mandá varios mensajes.  
  **OK si:** **siempre** sale desde el mismo número que ya estaba usando esa conversación.

- [ ] **C4 — Rotación en chats nuevos**  
  Dos contactos **nuevos** (nunca hablaste) escriben, o iniciás campañas a dos destinos nuevos.  
  **OK si:** se alternan sesiones cuando aplica.  
  *Nota:* el inbound queda atado a la sesión que **recibió** el mensaje. La rotación round-robin aplica sobre todo a envíos nuevos vía `getNextForNewConversation` (campañas / default).

- [ ] **C5 — Contador no leídos**  
  Mensaje inbound con otro chat seleccionado.  
  **OK si:** sube `unread`; al abrir y marcar leído baja a 0.

- [ ] **C6 — Asignar agente**  
  Menú de asignación en el chat.  
  **OK si:** el agente queda asignado; si hay otra pestaña abierta, se actualiza por socket.

### Casos que deben fallar (C)

- [ ] **CF1** — Enviar mensaje **vacío** (solo espacios)  
  El compositor no debería enviar. Si forzás API `POST .../messages` con `{ "text": "" }` → **400** `{ "error": "Mensaje inválido" }`

- [ ] **CF2** — `POST /conversations/uuid-inventado/messages` con `{ "text": "hola" }`  
  **Esperado:** **400** `{ "error": "Conversación no encontrada" }`

- [ ] **CF3** — WhatsApp **desconectado** y respondés igual  
  Error en UI o **400** con texto del adapter (ej. sesión no inicializada). Anotá el texto real: si es técnico, hay que mejorarlo.

- [ ] **CF4** — Cambiar estado de conversación (ver también sección D)  
  Si el API falla, hoy el menú **no muestra error** (catch silencioso): eso es un bug de UX a chequear.

---

## D. Estado de conversación

- [ ] **D1 — Ciclo de estados**  
  Abierta → Pendiente → Resuelta → Pospuesta → Abierta.  
  **OK si:** cada click cambia el badge (verde / amarillo / gris / violeta).

- [ ] **D2 — Mismo estado**  
  Click en el estado actual.  
  **OK si:** cierra el menú, no pega al servidor.

### Casos que deben fallar (D)

- [ ] **DF1** — `PATCH /conversations/:id/status` body `{ "status": "cerrada" }`  
  **Esperado:** **400** `{ "error": "Estado inválido" }`

---

## E. Plantillas y campañas

Pestaña **Campañas**. CSV mínimo:

```csv
phone,name
595981234567,Ana
595987654321,Luis
```

Usá números reales que tengan WhatsApp y el prefijo **595** (Paraguay está hardcodeado en `phone.ts`).

- [ ] **E1 — Sin plantillas**  
  Primera vez.  
  **OK si:** texto **Sin plantillas guardadas.**

- [ ] **E2 — Guardar plantilla**  
  Escribí un mensaje → “Guardar mensaje como plantilla” → nombre `Promo`.  
  **OK si:** no hay error rojo; recargá Campañas: el selector muestra `Promo`.

- [ ] **E3 — Usar plantilla**  
  Elegí `Promo` en el select.  
  **OK si:** el textarea se llena con el body.

- [ ] **E4 — Personalización**  
  Mensaje `Hola {nombre}, oferta` + CSV con columna `name`.  
  **OK si:** en WhatsApp llega `Hola Ana, oferta`.

- [ ] **E5 — Crear campaña**  
  Título + mensaje + CSV + Crear y encolar.  
  **OK si:** aparece en la lista; contadores sent/failed se mueven.

- [ ] **E6 — Programar**  
  Fecha/hora futura.  
  **OK si:** queda `scheduled` / no envía al instante (según delay de la cola).

- [ ] **E7 — Cancelar**  
  Campaña en curso → Cancelar.  
  **OK si:** deja de encolar; pendientes cancelados.

- [ ] **E8 — Rate limit**  
  Límite 2 mensajes / 5 min, campaña de 5 destinos.  
  **OK si:** los envíos se espacian; “Guardado ✓” al guardar el límite.

### Casos que deben fallar (E)

- [ ] **EF1** — Crear campaña **sin archivo**  
  **Mensaje esperado:** **Subí un archivo .csv o .xlsx**

- [ ] **EF2** — Título vacío (required HTML)  
  **Esperado:** el browser no deja submit.

- [ ] **EF3** — Guardar plantilla con nombre vacío  
  **Esperado:** no llama al API.

- [ ] **EF4** — (DevTools) `POST /templates` `{ "name": "", "body": "x" }`  
  **Esperado:** **400** `{ "error": "Datos inválidos" }`

- [ ] **EF5** — `PUT /templates/uuid-falso` con name+body válidos  
  **Esperado:** **404** `{ "error": "Plantilla no encontrada" }`

- [ ] **EF6** — `GET /campaigns/uuid-falso`  
  **Esperado:** **404** `{ "error": "Campaña no encontrada" }`

- [ ] **EF7** — Rate: `maxMessages: 0` o `durationMinutes: 0`  
  **Esperado API:** **400** `{ "error": "Datos inválidos" }`  
  La UI **no muestra** ese error (anotá si “Guardado ✓” miente).

- [ ] **EF8** — CSV sin columna de teléfono reconocible  
  **Esperado:** campaña con 0 destinatarios o fallo al crear → **No se pudo crear la campaña**

---

## F. Agentes (solo admin)

- [ ] **F1 — Tab visible**  
  Login admin.  
  **OK si:** ves pestaña **Agentes**.

- [ ] **F2 — Crear agente**  
  Email `agente@demo.com`, nombre, pass ≥ 6, rol Agente.  
  **OK si:** aparece en la lista con badge `agent`.

- [ ] **F3 — Login del nuevo**  
  Logout → `agente@demo.com` / la pass.  
  **OK si:** entra; **no** ves pestaña Agentes.

- [ ] **F4 — Desactivar**  
  Admin → Desactivar ese agente.  
  **OK si:** badge **inactivo**, fila más opaca.

- [ ] **F5 — Login inactivo**  
  Intentá entrar con el agente desactivado.  
  **OK si:** falla login (**Credenciales inválidas**) si el use-case rechaza inactivos.  
  *Si entra igual, es un bug a reportar.*

- [ ] **F6 — Reactivar**  
  Activar de nuevo.  
  **OK si:** puede volver a entrar.

### Casos que deben fallar (F)

- [ ] **FF1** — Crear agente con email ya usado (`admin@demo.com`)  
  **Mensaje esperado:** **Ya existe un agente con ese email**

- [ ] **FF2** — Email inválido `hola`  
  **Mensaje esperado:** **Datos inválidos** (si el form no valida HTML primero)

- [ ] **FF3** — Contraseña de 5 caracteres  
  **Mensaje esperado:** **Datos inválidos**

- [ ] **FF4** — Nombre vacío  
  **Mensaje esperado:** **Datos inválidos**

- [ ] **FF5** — Logueado como **agente** (no admin): `POST /agents` con token  
  **Esperado:** **403** `{ "error": "Acceso denegado: solo admins" }`

- [ ] **FF6** — Agente A cambia password de agente B: `PUT /agents/{idB}/password`  
  **Esperado:** **403** `{ "error": "Acceso denegado" }`

- [ ] **FF7** — `PATCH /agents/uuid-falso` `{ "isActive": false }`  
  **Esperado:** **404** `{ "error": "Agente no encontrado" }`

---

## G. Tiempo real y salud

- [ ] **G1 — Health**  
  `http://localhost:4000/health`  
  **OK si:** `{ "status": "ok" }`

- [ ] **G2 — Dos ventanas**  
  Misma cuenta, dos browsers.  
  **OK si:** mensaje inbound aparece en las dos.

- [ ] **G3 — OpenWA**  
  `http://localhost:2785`  
  **OK si:** dashboard del gateway; sesiones coinciden con Canales.

---

## Orden sugerido (una tarde)

1. A1–A3 + AF1
2. B1–B4 + BF1–BF2
3. C1–C3 + D1
4. F2–F3 + FF1 + FF5
5. E2–E5 + EF1
6. B5 + C4 (multi-número)
7. E8 (ritmo de campaña)

---

## Qué anotar si “falla el control de errores”

Hoy hay huecos de UX (el API sí responde bien, la UI a veces no):

- Estado de conversación: error **silencioso**
- Rate limit: no muestra **Datos inválidos**
- Plantilla: al guardar no refresca el selector hasta recargar
- Varios 400 genéricos: **Datos inválidos** (no dicen *qué* campo)

Si en un caso de la columna “debe fallar” **no ves el texto** esperado, marcalo como **error de mensaje / UI**, no como fallo de negocio.

Cuando termines, pasá qué ítems fallaron para corregirlos en ese orden.
