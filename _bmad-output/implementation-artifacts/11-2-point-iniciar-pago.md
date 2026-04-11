# Story 11.2: MP Point — Iniciar Cobro en Dispositivo

Status: done

## Story

Como administrador,
quiero enviar una orden de cobro al dispositivo Point físico desde el panel,
para que el cliente pueda pagar con tarjeta/celular en el local.

## Acceptance Criteria

1. **Given** un pedido `pending` con `total_amount > 0` y un device activo en DB,
   **When** el admin llama a `POST /api/v1/pos/orders/:orderId/intent`,
   **Then** se crea un intent en MP, se guarda en `pos_payment_intents`, se crea registro en `payments` con `payment_method = 'mp_point'`, y retorna `{ intentId, deviceName, status: 'open' }`.

2. **Given** no hay ningún dispositivo activo en `pos_devices`,
   **When** se llama al endpoint,
   **Then** retorna 422 "No hay dispositivo Point activo configurado".

3. **Given** el pedido ya está `paid`,
   **When** se intenta iniciar,
   **Then** retorna 409 "Pedido ya pagado".

4. **Given** la API de MP falla (device offline, timeout),
   **When** se llama al endpoint,
   **Then** retorna 502 con mensaje claro; el pedido queda `pending` sin modificar.

5. **Given** ya existe un intent `open` o `on_terminal` para el pedido,
   **When** se intenta crear otro intent,
   **Then** retorna 409 "Ya hay un cobro en progreso para este pedido".

6. **Given** hay un intent activo para el pedido,
   **When** el admin llama a `GET /api/v1/pos/orders/:orderId/intent`,
   **Then** retorna el estado actual del intent (`status`, `mpIntentId`, `deviceName`).

7. **Given** hay un intent `open` o `on_terminal` para el pedido,
   **When** el admin llama a `DELETE /api/v1/pos/orders/:orderId/intent`,
   **Then** se cancela en MP y el intent queda en `cancelled`.

## Tasks / Subtasks

### Task 1 — Extender `pos.service.ts`: `createIntent`
- [x] Validar que el pedido exista, esté `pending` y `total_amount > 0`
- [x] Obtener device activo (`getActiveDevice()`); si no hay → AppError 422
- [x] Verificar que no haya intent activo (status `open` o `on_terminal`) para el pedido → AppError 409
- [x] Llamar `POST /point/integration-api/devices/{deviceId}/payment-intents` con `amount` en centavos, `X-Idempotency-Key: jedami-order-{orderId}-{Date.now()}`
- [x] Si MP responde error → AppError 502
- [x] `upsertIntent(deviceId, orderId, mpIntentId, 'open')`
- [x] Crear registro en `payments`: `INSERT ... (order_id, payment_method, status) VALUES (..., 'mp_point', 'pending')` solo si no existe payment previo para el pedido
- [x] Retornar `{ intentId, deviceName, status: 'open' }`

### Task 2 — Extender `pos.service.ts`: `getIntent` y `cancelIntent`
- [x] `getIntent(orderId)`: encuentra el último intent, retorna status + deviceName o AppError 404 si no existe
- [x] `cancelIntent(orderId)`: valida que haya intent activo; llama `DELETE /point/integration-api/devices/{deviceId}/payment-intents`; actualiza status a `cancelled`

### Task 3 — Controlador: nuevos handlers
- [x] `createIntentHandler`: `POST /pos/orders/:orderId/intent`
- [x] `getIntentHandler`: `GET /pos/orders/:orderId/intent`
- [x] `cancelIntentHandler`: `DELETE /pos/orders/:orderId/intent`

### Task 4 — Rutas POS: agregar endpoints de intent
- [x] Agregar las 3 rutas en `pos.routes.ts` (todas requireRole admin)

### Task 5 — Tests de integración
- [x] `POST /pos/orders/:orderId/intent` retorna 422 si no hay device activo
- [x] `POST /pos/orders/:orderId/intent` retorna 409 si pedido ya pagado
- [x] `POST /pos/orders/:orderId/intent` retorna 409 si ya hay intent activo
- [x] `GET /pos/orders/:orderId/intent` retorna 404 si no hay intent
- [x] `DELETE /pos/orders/:orderId/intent` retorna 404 si no hay intent activo

## Dev Notes

### Llamada a MP API (fetch directo, sin SDK)
```typescript
const response = await fetch(
  `https://api.mercadopago.com/point/integration-api/devices/${device.mp_device_id}/payment-intents`,
  {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ENV.MP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': `jedami-order-${orderId}-${Date.now()}`,
    },
    body: JSON.stringify({
      amount: Math.round(Number(order.total_amount) * 100),
      description: `Pedido Jedami #${orderId}`,
      payment: { installments: 1, type: 'credit_card' },
      additional_info: {
        external_reference: String(orderId),
        print_on_terminal: true,
      },
    }),
  },
);
```

### MP Point no tiene sandbox real
Para tests de integración NO llamar a la API real de MP. Los tests que requieren la llamada a MP se testean con un device inexistente → 422 o con pedido ya paid → 409. El happy path real se prueba en producción.

### Cancelación de intent vía MP API
```typescript
DELETE https://api.mercadopago.com/point/integration-api/devices/{deviceId}/payment-intents
Authorization: Bearer {MP_ACCESS_TOKEN}
```
MP responde 200 si había intent activo, 400/404 si no había. En ambos casos marcar el intent como `cancelled` localmente.

### Intents activos
Statuses considerados "activos" (no terminales): `open`, `on_terminal`, `processing`
Statuses terminales: `processed`, `abandoned`, `cancelled`, `error`

### Referencias
- [Spec: specs/01_mercadopago_point_pos.md]
- [Source: jedami-bff/src/modules/pos/pos.service.ts] — base de story 11-1
- [Source: jedami-bff/src/modules/pos/pos.repository.ts]
- [Source: jedami-bff/src/routes/pos.routes.ts]

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Debug Log References
- `cancelIntent`: si MP falla el DELETE se loguea warning pero el intent se marca `cancelled` localmente de todas formas (resiliente)

### Completion Notes List
- `createIntent`: valida pedido → device activo → no intent duplicado → llama MP → guarda en pos_payment_intents + payments
- `getIntent` + `cancelIntent` implementados
- 3 nuevas rutas en pos.routes.ts: `POST/GET/DELETE /pos/orders/:orderId/intent`
- 9 tests de integración pasando (9/9)

### File List
- `jedami-bff/src/modules/pos/pos.service.ts` (modificado — createIntent, getIntent, cancelIntent)
- `jedami-bff/src/modules/pos/pos.controller.ts` (modificado — createIntentHandler, getIntentHandler, cancelIntentHandler)
- `jedami-bff/src/routes/pos.routes.ts` (modificado — 3 nuevas rutas de intent)
- `jedami-bff/src/__tests__/pos-intent.test.ts` (nuevo — 9 tests)
