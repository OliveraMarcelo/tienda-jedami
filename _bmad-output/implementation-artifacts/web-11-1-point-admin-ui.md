# Story web-11.1: UI Admin — Panel de Pagos Point

Status: done

Depende de: `11-1-point-modelo-datos` (review), `11-2-point-iniciar-pago` (review), `11-3-point-webhook` (review), `11-4-point-confirmar-manual` (review)

## Contexto

El BFF expone:
- `GET /api/v1/pos/devices` — lista dispositivos
- `POST /api/v1/pos/devices/sync` — sincronizar con MP
- `PATCH /api/v1/pos/devices/:id` — activar/desactivar
- `POST /api/v1/pos/orders/:orderId/intent` → `{ intentId, deviceName, status: 'open' }`
- `GET /api/v1/pos/orders/:orderId/intent` → `{ intent: { mp_intent_id, status }, deviceName }`
- `DELETE /api/v1/pos/orders/:orderId/intent` → 204
- `PATCH /api/v1/pos/orders/:orderId/confirm` body `{ mpPaymentId? }` → `{ orderId, status: 'paid' }`
- `GET /api/v1/config` incluye `pointDevice: { id, name } | null`

Todos los endpoints POS requieren rol **admin**.

## Story

Como administrador,
quiero iniciar cobros Point y confirmar pagos manualmente desde el panel web,
para gestionar el flujo presencial sin salir del sistema.

## Acceptance Criteria

1. **Given** el admin abre `/admin/point`,
   **When** la vista carga,
   **Then** ve la lista de pedidos `pending` con botón "Cobrar con Point" y el nombre del dispositivo activo (o aviso si no hay ninguno).

2. **Given** hay un dispositivo activo y el admin hace clic en "Cobrar con Point" para un pedido,
   **When** el request a `POST /pos/orders/:orderId/intent` retorna 201,
   **Then** aparece el estado "Esperando pago en dispositivo…" y un botón "Cancelar cobro".

3. **Given** el cobro está en estado "open/on_terminal" y el admin hace clic en "Cancelar cobro",
   **When** el request a `DELETE /pos/orders/:orderId/intent` retorna 204,
   **Then** vuelve al estado inicial con el botón "Cobrar con Point".

4. **Given** el webhook llegó y el pedido cambió a `paid`,
   **When** el admin refresca o hace polling,
   **Then** el botón de ese pedido desaparece (pedido ya pagado).

5. **Given** el webhook no llegó y el admin hace clic en "Confirmar manualmente",
   **When** el modal aparece y el admin confirma (con o sin mpPaymentId),
   **Then** se llama a `PATCH /pos/orders/:orderId/confirm` y el pedido pasa a `paid` en la lista.

6. **Given** el admin abre la pestaña "Point" en `/admin/configuracion`,
   **When** la vista carga,
   **Then** ve la lista de dispositivos (nombre, modo, activo), un botón "Sincronizar" y toggles para activar/desactivar.

## Tasks / Subtasks

### Task 1 — API layer: `jedami-web/src/api/pos.api.ts` (nuevo)
- [x] `fetchPosDevices()`: `GET /pos/devices` → `PosDevice[]`
- [x] `syncPosDevices()`: `POST /pos/devices/sync` → `PosDevice[]`
- [x] `updatePosDevice(id, active)`: `PATCH /pos/devices/:id`
- [x] `createIntent(orderId)`: `POST /pos/orders/:orderId/intent` → `{ intentId, deviceName, status }`
- [x] `getIntent(orderId)`: `GET /pos/orders/:orderId/intent` → `{ intent, deviceName }`
- [x] `cancelIntent(orderId)`: `DELETE /pos/orders/:orderId/intent`
- [x] `confirmPointPayment(orderId, mpPaymentId?)`: `PATCH /pos/orders/:orderId/confirm`
- [x] Interfaces: `PosDevice`, `PosIntent`, `IntentState`

### Task 2 — Config: exponer `pointDevice` en store
- [x] Extender `AppConfig` en `config.api.ts`: agregar `pointDevice?: { id: number; name: string } | null`
- [x] Exponer `pointDevice` como computed en `useConfigStore`

### Task 3 — Vista `AdminPointView.vue` (nueva, ruta `/admin/point`)
- [x] Al cargar: fetch pedidos `pending` del admin (`GET /admin/payments?status=pending` o los datos del dashboard) — usar `fetchAdminPayments({ status: 'pending' })`
- [x] Para cada pedido pendiente, mostrar: ID, cliente, monto, botón acción
- [x] Si `configStore.pointDevice === null`: mostrar aviso "No hay dispositivo Point activo"
- [x] Estado local `intentStates: Record<orderId, IntentState>` para trackear intents en progreso
- [x] Botón "Cobrar con Point": llama `createIntent(orderId)` → cambia estado a `{ status: 'open', deviceName }`
- [x] En estado "open": mostrar "Esperando en dispositivo..." + botón "Cancelar" + botón "Confirmar manualmente"
- [x] "Cancelar": llama `cancelIntent(orderId)` → resetea estado
- [x] Botón "Verificar estado": llama `getIntent(orderId)` y actualiza el estado local
- [x] Modal "Confirmar manualmente": campo opcional `mpPaymentId` + botón confirmar → llama `confirmPointPayment(orderId, mpPaymentId?)` → si OK, elimina pedido de la lista (pasó a paid)
- [x] Manejo de errores: toast o mensaje inline para 422/409/502

### Task 4 — Tab "Point" en `AdminConfigView.vue`
- [x] Agregar tab `'point'` al tipo `Tab`
- [x] Sección: lista de `PosDevice[]` con nombre, modo, activo/inactivo
- [x] Botón "Sincronizar dispositivos": llama `syncPosDevices()` → recarga lista
- [x] Toggle activo por device: llama `updatePosDevice(id, !device.active)` → actualiza lista y llama `configStore.refreshConfig()`
- [x] Feedback visual (loading + error inline)

### Task 5 — Router y nav
- [x] Nueva ruta `/admin/point` con nombre `adminPoint`, componente `AdminPointView.vue`, `meta: { requiresRole: ROLES.ADMIN }`
- [x] Agregar card en `AdminView.vue` con link a `/admin/point` (texto "Cobros Point", ícono 💳 o similar)

## Dev Notes

### API client: usar `apiClient` con token (el interceptor ya lo agrega)
Todos los endpoints de `/pos/...` requieren auth admin. El `apiClient` ya tiene el interceptor que agrega el Bearer token desde el store.

### Estado de intent por pedido
No usar un store global — usar `ref<Record<number, IntentState>>({})` local en la vista. `IntentState`:
```typescript
interface IntentState {
  loading: boolean
  status: string | null  // 'open' | 'on_terminal' | 'processing' | null
  deviceName: string
  intentId: string | null
  error: string
}
```

### Pedidos pending para cobro Point
Reutilizar `fetchAdminPayments` con filtro `status = 'pending'`. Mostrar solo los que tengan `total_amount > 0`. Los pedidos que pasan a `paid` se eliminan de la lista vía reactivo local (no reload completo).

### Sin polling automático
El diseño usa refresh manual ("Verificar estado") para no sobrecargar el BFF. El admin puede hacer polling manual haciendo click en "Verificar estado" cada vez que quiera.

### ConfigStore `pointDevice`
`GET /config` ya retorna `pointDevice: { id, name } | null`. Solo hay que exponerlo en el store como computed:
```typescript
const pointDevice = computed(() => config.value.pointDevice ?? null)
```

### Tab Point en AdminConfigView
Agregar a `Tab` el valor `'point'`. En la sección Point mostrar:
- Lista de dispositivos con nombre, modo (`PDV`/`STANDALONE`), badge activo/inactivo
- Toggle para cada device
- Botón "Sincronizar" que llama a la API MP y refresca

### Referencias
- [Source: jedami-web/src/api/admin.payments.api.ts] — patrón para API admin
- [Source: jedami-web/src/views/admin/AdminPaymentsView.vue] — patrón de vista admin con tabla
- [Source: jedami-web/src/views/admin/AdminConfigView.vue] — patrón de tabs + config
- [Source: jedami-web/src/stores/config.store.ts] — patrón de store config
- [BFF: jedami-bff/src/routes/pos.routes.ts] — endpoints disponibles

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Debug Log References

### Completion Notes List
- `pos.api.ts`: API completa con 7 funciones + interfaces `PosDevice`, `PosIntent`, `IntentState`
- `config.api.ts`: `AppConfig.pointDevice` agregado; `config.store.ts`: computed `pointDevice` expuesto
- `AdminPointView.vue`: lista pedidos pending, estado local por pedido, cobrar/verificar/cancelar/confirmar manual con modal
- `AdminConfigView.vue`: tab "Point POS" con lista de devices, sync y toggles activo/inactivo
- `router/index.ts`: ruta `/admin/point` con guard admin
- `AdminView.vue`: card "Cobros Point" en el panel principal
- ESLint: 11 errores pre-existentes en AdminConfigView.vue; nuevo código pasa sin errores (usa `AxiosError` typed casts)
- TypeScript: `vue-tsc --noEmit` sin errores

### File List
- `jedami-web/src/api/pos.api.ts` (nuevo)
- `jedami-web/src/api/config.api.ts` (modificado — `pointDevice` en `AppConfig`)
- `jedami-web/src/stores/config.store.ts` (modificado — computed `pointDevice`, init state)
- `jedami-web/src/views/admin/AdminPointView.vue` (nuevo)
- `jedami-web/src/views/admin/AdminConfigView.vue` (modificado — tab Point POS + funciones POS)
- `jedami-web/src/views/admin/AdminView.vue` (modificado — card "Cobros Point")
- `jedami-web/src/router/index.ts` (modificado — ruta `/admin/point`)
