# Story 11.4: MP Point — Confirmación Manual de Pago

Status: done

## Story

Como administrador,
quiero poder confirmar manualmente un pago Point cuando el webhook no llegó,
para no dejar al cliente esperando mientras se resuelve la notificación automática.

## Acceptance Criteria

1. **Given** pedido `pending` con pago realizado en el dispositivo pero sin webhook,
   **When** admin llama `PATCH /api/v1/pos/orders/:orderId/confirm` sin body (modo confianza),
   **Then** pedido pasa a `paid`, `payments.status = 'approved'`, `payments.paid_at = NOW()`.

2. **Given** admin confirma con `mpPaymentId` válido en MP y `status = 'approved'`,
   **When** se llama al endpoint,
   **Then** sistema verifica contra MP API, actualiza status y retorna `{ orderId, status: 'paid' }`.

3. **Given** `mpPaymentId` provisto pero en MP está `rejected` o no existe,
   **When** admin intenta confirmar,
   **Then** retorna 422 "El pago no está aprobado en Mercado Pago".

4. **Given** pedido ya `paid`,
   **When** se llama al endpoint,
   **Then** retorna 409 "Pedido ya pagado".

5. **Given** pedido no existe,
   **When** se llama al endpoint,
   **Then** retorna 404.

## Tasks / Subtasks

### Task 1 — Implementar `confirmPointPayment` en `pos.service.ts`
- [x] Buscar pedido; si no existe → AppError 404
- [x] Si `order.status === 'paid'` → AppError 409
- [x] Si `mpPaymentId` provisto: `GET https://api.mercadopago.com/v1/payments/{mpPaymentId}` → verificar `status === 'approved'` → si no, AppError 422
- [x] Transacción: `UPDATE orders SET status = 'paid'` + upsert payments (`status = 'approved'`, `paid_at = NOW()`, `mp_payment_id`)
- [x] Si hay intent activo para el pedido → `updateIntentStatus` a `'processed'`
- [x] Log evento `[POS] Pago confirmado manualmente`

### Task 2 — Handler y ruta
- [x] `confirmPointPaymentHandler` en `pos.controller.ts`
- [x] `PATCH /pos/orders/:orderId/confirm` en `pos.routes.ts`

### Task 3 — Tests de integración
- [x] Confirmación ciega (sin mpPaymentId): pedido pending → 200, status paid
- [x] Pedido ya paid → 409
- [x] Pedido no existe → 404

## Dev Notes

### Verificación de pago en MP API
```typescript
GET https://api.mercadopago.com/v1/payments/{mpPaymentId}
Authorization: Bearer MP_ACCESS_TOKEN
```
Response: `{ id, status: 'approved' | 'rejected' | ... }`
Verificar `status === 'approved'`. Si MP retorna error o status no es approved → AppError 422.

### Upsert payments
Si ya existe un payment `mp_point` para el pedido → UPDATE; si no → INSERT.

### Intent activo
Si `findIntentByOrderId(orderId)` retorna intent con status activo → marcarlo `processed`.

### Referencias
- [Spec: specs/01_mercadopago_point_pos.md]
- [Source: jedami-bff/src/modules/pos/pos.service.ts]
- [Source: jedami-bff/src/modules/pos/pos.controller.ts]
- [Source: jedami-bff/src/routes/pos.routes.ts]

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Debug Log References

### Completion Notes List
- `confirmPointPayment`: valida pedido → verifica pago en MP si hay mpPaymentId → upsert payments → mark order paid → marca intent como processed
- `PATCH /pos/orders/:orderId/confirm` — consistente con resto de rutas POS de Epic 11
- 5 tests de integración pasando (5/5)

### File List
- `jedami-bff/src/modules/pos/pos.service.ts` (modificado — confirmPointPayment)
- `jedami-bff/src/modules/pos/pos.controller.ts` (modificado — confirmPointPaymentHandler)
- `jedami-bff/src/routes/pos.routes.ts` (modificado — PATCH /pos/orders/:orderId/confirm)
- `jedami-bff/src/__tests__/pos-confirm.test.ts` (nuevo — 5 tests)
