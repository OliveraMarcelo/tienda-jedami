# Story 11.3: MP Point — Webhook Automático

Status: done

## Story

Como sistema,
quiero recibir la notificación de MP cuando el pago Point sea aprobado o rechazado,
para actualizar automáticamente el pedido sin intervención del admin.

## Acceptance Criteria

1. **Given** MP envía `POST /payments/webhook` con `action: 'point_integration_wh'` y `data.id: '<intentId>'`,
   **When** el handler procesa el evento,
   **Then** consulta el estado del intent en MP API, actualiza `pos_payment_intents.status` y el payment correspondiente.

2. **Given** el pago Point es aprobado,
   **When** llega el webhook,
   **Then** `orders.status = 'paid'`, `payments.status = 'approved'`, `payments.paid_at = NOW()`.

3. **Given** el pago Point es rechazado,
   **When** llega el webhook,
   **Then** `payments.status = 'rejected'`, `orders.status` queda `pending`.

4. **Given** el mismo webhook llega dos veces (retry de MP),
   **When** se procesa el segundo,
   **Then** responde 200 sin duplicar operaciones (idempotencia).

5. **Given** el `data.id` del webhook no corresponde a ningún intent en DB,
   **When** se procesa,
   **Then** responde 200 (sin error) y loguea warning.

## Tasks / Subtasks

### Task 1 — Extender `processWebhook` en `payments.service.ts`
- [x] Detectar `action === 'point_integration_wh'` y delegar a `posService.processPointWebhook(data.id)`
- [x] El resto del flujo existente no cambia

### Task 2 — Implementar `processPointWebhook` en `pos.service.ts`
- [x] Buscar intent por `mp_intent_id` en DB; si no existe → log warn + return (idempotencia)
- [x] Consultar estado real del intent en MP: `GET /point/integration-api/payment-intents/{intentId}`
- [x] Extraer `status` y `payment.id` del response de MP
- [x] Actualizar `pos_payment_intents.status` + `mp_payment_id` si corresponde
- [x] Si aprobado (`status === 'finished'` y `payment.id` presente):
  - Upsert en `payments`: `status = 'approved'`, `paid_at = NOW()`, `mp_payment_id`
  - `UPDATE orders SET status = 'paid' WHERE id = $orderId AND status != 'paid'`
- [x] Si rechazado (`status === 'abandoned'` o `status === 'error'`):
  - `UPDATE payments SET status = 'rejected'`
- [x] Idempotencia: si `payments.status` ya es `approved` o `rejected` → return sin re-procesar

### Task 3 — Tests de integración
- [x] Webhook con `action: 'point_integration_wh'` e intent inexistente en DB → 200 sin error
- [x] Webhook con intent en DB pero sin payment_id en MP (still open) → 200, sin cambiar orden
- [x] Idempotencia: webhook duplicado cuando ya está `approved` → 200 sin cambios

## Dev Notes

### MP API — consultar estado del intent
```typescript
GET https://api.mercadopago.com/point/integration-api/payment-intents/{intentId}
Authorization: Bearer MP_ACCESS_TOKEN
```
Response shape:
```json
{
  "id": "...",
  "status": "finished" | "open" | "on_terminal" | "processing" | "abandoned" | "cancelled" | "error",
  "payment": { "id": 12345678, "type": "credit_card" }
}
```
`status === 'finished'` con `payment.id` → aprobado
`status === 'abandoned' | 'error'` → rechazado

### Idempotencia en webhook
El webhook puede llegar múltiples veces (reintentos de MP). Verificar siempre:
1. `pos_payment_intents.status` ≠ terminal antes de procesar
2. `payments.status` ≠ `approved | rejected` antes de actualizar

### Mismo endpoint de webhook
El webhook de Point usa el mismo `POST /api/v1/payments/webhook` que el checkout online.
La diferencia está en el campo `action`:
- Checkout online: `action === 'payment.updated' | 'payment.created'`
- Point: `action === 'point_integration_wh'`

### Referencias
- [Spec: specs/01_mercadopago_point_pos.md]
- [Source: jedami-bff/src/modules/payments/payments.service.ts] — processWebhook existente
- [Source: jedami-bff/src/modules/pos/pos.service.ts] — módulo POS

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Debug Log References

### Completion Notes List
- `processPointWebhook`: busca intent → chequea idempotencia en payments → consulta MP API → actualiza pos_payment_intents + payments + orders
- Rama `point_integration_wh` agregada en `payments.service.ts` antes del guard `payment.updated/created`
- `vitest.config.ts`: agregado `fileParallelism: false` para evitar interferencia entre tests de integración con DB compartida
- 3 tests de integración pasando (3/3)

### File List
- `jedami-bff/src/modules/payments/payments.service.ts` (modificado — import processPointWebhook + rama point_integration_wh)
- `jedami-bff/src/modules/pos/pos.service.ts` (modificado — processPointWebhook implementado)
- `jedami-bff/src/__tests__/pos-webhook.test.ts` (nuevo — 3 tests)
- `jedami-bff/vitest.config.ts` (modificado — fileParallelism: false)
