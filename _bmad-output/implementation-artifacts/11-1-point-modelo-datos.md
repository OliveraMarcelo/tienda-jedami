# Story 11.1: MP Point — Modelo de Datos y Configuración Base

Status: done

## Story

Como desarrollador,
quiero crear las tablas `pos_devices` y `pos_payment_intents`, extender los constraints de `payments.payment_method` y `branding.payment_gateway` con `mp_point`, y exponer los endpoints de gestión de dispositivos,
para que las stories 11-2, 11-3 y 11-4 puedan construir sobre una base de datos y configuración sólida.

## Acceptance Criteria

1. **Given** la migración aplicada,
   **When** se consulta la estructura de la DB,
   **Then** existen las tablas `pos_devices` y `pos_payment_intents` con sus constraints e índices.

2. **Given** la migración aplicada,
   **When** se intenta insertar `payment_method = 'mp_point'` en `payments`,
   **Then** la inserción es exitosa (no viola el CHECK).

3. **Given** la migración aplicada,
   **When** se intenta insertar `payment_gateway = 'mp_point'` en `branding`,
   **Then** la inserción es exitosa (no viola el CHECK).

4. **Given** el admin llama a `POST /api/v1/pos/devices/sync`,
   **When** la MP API devuelve dispositivos,
   **Then** se guardan/actualizan en `pos_devices` y se retorna la lista.

5. **Given** el admin llama a `GET /api/v1/pos/devices`,
   **When** hay dispositivos en DB,
   **Then** retorna la lista con `id, mp_device_id, name, operating_mode, active`.

6. **Given** el admin llama a `PATCH /api/v1/pos/devices/:id`,
   **When** envía `{ active: true/false }`,
   **Then** se actualiza el campo `active` del dispositivo.

7. **Given** se llama a `GET /api/v1/config`,
   **When** hay al menos un dispositivo activo en `pos_devices`,
   **Then** el response incluye `pointDevice: { id, name } | null`.

8. **Given** `MP_POINT_WEBHOOK_SECRET` está en `.env`,
   **When** se inicia el servidor,
   **Then** `ENV.MP_POINT_WEBHOOK_SECRET` está disponible (sin error de inicio).

## Tasks / Subtasks

### Task 1 — Migración SQL `041_mp_point.sql`
- [x] Crear tabla `pos_devices` con campos: `id, mp_device_id, name, operating_mode, active, created_at`
- [x] Crear tabla `pos_payment_intents` con campos: `id, device_id (FK), order_id (FK), mp_intent_id, status, mp_payment_id, created_at, updated_at`
- [x] Actualizar CHECK constraint de `branding.payment_gateway` para incluir `mp_point`
- [x] Actualizar CHECK constraint de `payments.payment_method` para incluir `mp_point`
- [x] Crear índices en `pos_devices(active)`, `pos_payment_intents(order_id)`, `pos_payment_intents(mp_intent_id)`, `pos_payment_intents(status)`

### Task 2 — Entidades y query files del módulo POS
- [x] Crear `jedami-bff/src/modules/pos/pos.entity.ts` con interfaces `PosDevice` y `PosPaymentIntent`
- [x] Crear query file `modules/pos/queries/find-devices.ts`
- [x] Crear query file `modules/pos/queries/find-device-by-id.ts`
- [x] Crear query file `modules/pos/queries/upsert-device.ts`
- [x] Crear query file `modules/pos/queries/find-intent-by-order-id.ts`
- [x] Crear query file `modules/pos/queries/find-intent-by-mp-id.ts`
- [x] Crear query file `modules/pos/queries/upsert-intent.ts`

### Task 3 — Variables de entorno
- [x] Agregar `MP_POINT_WEBHOOK_SECRET` a `jedami-bff/src/config/env.ts`
- [x] Agregar `MP_POINT_WEBHOOK_SECRET=` a `jedami-bff/.env.example` (si existe)

### Task 4 — Repositorio POS
- [x] Crear `jedami-bff/src/modules/pos/pos.repository.ts` con funciones: `findDevices`, `findDeviceById`, `upsertDevice`, `updateDevice`, `findIntentByOrderId`, `findIntentByMpId`, `upsertIntent`

### Task 5 — Servicio POS (solo sync/gestión de devices en esta story)
- [x] Crear `jedami-bff/src/modules/pos/pos.service.ts` con:
  - `syncDevices()` — llama `GET /point/integration-api/devices` en MP API y upsert en DB
  - `listDevices()` — retorna lista de pos_devices
  - `updateDevice(id, { active })` — actualiza active del device
  - `getActiveDevice()` — retorna el primer device activo o `null`

### Task 6 — Controlador y rutas POS
- [x] Crear `jedami-bff/src/modules/pos/pos.controller.ts` con handlers: `listDevicesHandler`, `syncDevicesHandler`, `updateDeviceHandler`
- [x] Crear `jedami-bff/src/routes/pos.routes.ts`:
  - `GET /api/v1/pos/devices` (requireRole admin)
  - `POST /api/v1/pos/devices/sync` (requireRole admin)
  - `PATCH /api/v1/pos/devices/:id` (requireRole admin)
- [x] Registrar `pos.routes.ts` en `jedami-bff/src/routes/index.ts`

### Task 7 — Extender `GET /config` con `pointDevice`
- [x] En `config.controller.ts → getConfig`: incluir `pointDevice: { id, name } | null` desde `pos.service.getActiveDevice()`
- [x] Invalidar cache cuando se actualice un device

### Task 8 — Tests de integración
- [x] Crear `jedami-bff/src/__tests__/pos-devices.test.ts` con:
  - `GET /pos/devices` retorna 200 con lista (puede ser vacía)
  - `PATCH /pos/devices/:id` actualiza `active` correctamente
  - `GET /pos/devices` retorna 401 sin token admin

## Dev Notes

### Numeración de migración
La última migración es `040_payment_gateway_rules.sql`. La nueva es `041_mp_point.sql`.

### Estado actual de constraints
- `payments.payment_method` CHECK actual: `IN ('mercadopago', 'bank_transfer')` — agregar `'mp_point'`
- `branding.payment_gateway` CHECK actual: `IN ('checkout_pro', 'checkout_api', 'bank_transfer')` — agregar `'mp_point'`

### Llamada a MP API para sync de devices
```typescript
// La Point Integration API no tiene cliente nativo en el SDK mercadopago@^2.x
// Usar fetch directo:
const response = await fetch(
  'https://api.mercadopago.com/point/integration-api/devices',
  {
    headers: {
      Authorization: `Bearer ${ENV.MP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
  },
);
const data = await response.json();
// data.devices: Array<{ id: string, operating_mode: string, ... }>
```

### Manejo de ambientes
MP Point API no tiene sandbox real. El sync de devices fallará en test si el ACCESS_TOKEN no es de producción. Para tests de integración, mockear la llamada a MP API o skipear el test de sync.

### Estructura del módulo POS
```
jedami-bff/src/modules/pos/
  pos.entity.ts        ← interfaces PosDevice, PosPaymentIntent
  pos.repository.ts    ← queries SQL
  pos.service.ts       ← lógica de negocio
  pos.controller.ts    ← handlers HTTP
  queries/
    find-devices.ts
    find-device-by-id.ts
    upsert-device.ts
    find-intent-by-order-id.ts
    find-intent-by-mp-id.ts
    upsert-intent.ts
```

### `pos_payment_intents` — status lifecycle
```
open → on_terminal → processing → processed
                               → abandoned
                   → cancelled
                   → error
```
`processed` no implica approved/rejected — el `mp_payment_id` en el registro indica el resultado real.

### Punto importante: `POST /pos/devices/sync` en test sin MP real
En tests de integración, si MP_ACCESS_TOKEN es de test, la sync puede retornar 200 vacío o 403.
El test debe verificar el comportamiento del endpoint ante respuesta no-200 de MP (retorna error 502).

### Referencias
- [Spec: specs/01_mercadopago_point_pos.md] — diseño técnico completo
- [Source: jedami-bff/src/database/migrations/035_bank_transfer.sql] — payment_method existente
- [Source: jedami-bff/src/modules/config/config.controller.ts] — getConfig existente
- [Source: jedami-bff/src/routes/index.ts] — registro de rutas
- [Source: jedami-bff/src/config/env.ts] — variables de entorno

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Debug Log References
- `requireAuth` no existe en `auth.middleware.ts` → corregido a `authMiddleware`. `ROLES` importado de `lib/constants.js` (no `modules/auth/roles.js`)
- Migración aplicada vía `psql` directo (no hay runner de migraciones automático)

### Completion Notes List
- Migración `041_mp_point.sql`: tablas `pos_devices` + `pos_payment_intents`, constraints actualizados en `branding.payment_gateway` y `payments.payment_method`
- Módulo POS completo: entity, 6 query files, repository, service (sync/list/update/getActive), controller, routes
- `GET /config` ahora incluye `pointDevice: { id, name } | null` consultando `pos_devices WHERE active = TRUE`
- Cache invalidado en `updateDevice()` (pos.service)
- `ENV.MP_POINT_WEBHOOK_SECRET` agregado a `config/env.ts`
- 9 tests de integración pasando (9/9)

### File List
- `jedami-bff/src/database/migrations/041_mp_point.sql` (nuevo)
- `jedami-bff/src/modules/pos/pos.entity.ts` (nuevo)
- `jedami-bff/src/modules/pos/pos.repository.ts` (nuevo)
- `jedami-bff/src/modules/pos/pos.service.ts` (nuevo)
- `jedami-bff/src/modules/pos/pos.controller.ts` (nuevo)
- `jedami-bff/src/modules/pos/queries/find-devices.ts` (nuevo)
- `jedami-bff/src/modules/pos/queries/find-device-by-id.ts` (nuevo)
- `jedami-bff/src/modules/pos/queries/upsert-device.ts` (nuevo)
- `jedami-bff/src/modules/pos/queries/find-intent-by-order-id.ts` (nuevo)
- `jedami-bff/src/modules/pos/queries/find-intent-by-mp-id.ts` (nuevo)
- `jedami-bff/src/modules/pos/queries/upsert-intent.ts` (nuevo)
- `jedami-bff/src/routes/pos.routes.ts` (nuevo)
- `jedami-bff/src/routes/index.ts` (modificado — registrar pos.routes)
- `jedami-bff/src/config/env.ts` (modificado — MP_POINT_WEBHOOK_SECRET)
- `jedami-bff/src/modules/config/config.controller.ts` (modificado — pointDevice en getConfig)
- `jedami-bff/src/__tests__/pos-devices.test.ts` (nuevo — 9 tests)
