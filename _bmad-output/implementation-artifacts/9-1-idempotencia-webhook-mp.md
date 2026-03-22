# Story 9.1: Idempotencia del Webhook de Mercado Pago — BFF

Status: done

## Story

Como sistema de pagos,
quiero que el webhook de Mercado Pago sea idempotente,
para que si MP envía la misma notificación dos veces no se genere un estado inconsistente ni se ejecuten efectos secundarios duplicados.

## Acceptance Criteria

1. **Given** MP envía la misma notificación `payment.updated` dos veces con el mismo `external_payment_id`
   **When** el webhook la procesa la segunda vez
   **Then** el sistema detecta que el pago ya fue registrado y retorna 200 sin modificar el pedido ni insertar un segundo registro en `payments`

2. **Given** un pago nuevo llega con un `external_payment_id` nunca visto
   **When** el webhook lo procesa
   **Then** el comportamiento es idéntico al actual: se inserta en `payments` y se actualiza `orders.status`

3. **Given** un pedido ya está en estado `paid`
   **When** llega un webhook duplicado con `approved`
   **Then** el `UPDATE orders SET status` no se ejecuta (la query usa `WHERE status != 'paid'`)

## Tasks / Subtasks

- [x] Migración: agregar constraint `UNIQUE` en `payments.external_payment_id` si no existe (AC: 1)
  - Verificar si la columna ya tiene el constraint; si no: `ALTER TABLE payments ADD CONSTRAINT payments_external_payment_id_key UNIQUE (external_payment_id)`
- [x] En el handler del webhook (`payments.controller.ts` o equivalente): antes de INSERT en `payments`, verificar si `external_payment_id` ya existe (AC: 1)
  - Si existe → retornar 200 sin procesar
- [x] Actualizar la query de UPDATE de `orders.status` para incluir `WHERE id = $1 AND status != 'paid'` (AC: 3)
- [x] Crear migración `023_payments_unique_external_id.sql` (AC: 1)

## Dev Notes

### Dónde vive la lógica del webhook
```
jedami-bff/src/modules/payments/ (o auth/payments)
```
Buscar el handler que procesa `POST /payments/webhook`.

### Patrón de deduplicación recomendado
```typescript
// Antes de insertar el pago:
const existing = await pool.query(
  'SELECT id FROM payments WHERE external_payment_id = $1',
  [externalPaymentId]
)
if (existing.rows.length > 0) {
  res.status(200).json({ ok: true, duplicate: true })
  return
}
```

### UPDATE idempotente de orders
```sql
UPDATE orders
SET status = $2, updated_at = NOW()
WHERE id = $1 AND status != 'paid'
```
Si el pedido ya está `paid`, `rowCount` será 0 — sin error, sin efecto.

### Migración
```sql
-- 023_payments_unique_external_id.sql
ALTER TABLE payments
  ADD CONSTRAINT payments_external_payment_id_key
  UNIQUE (external_payment_id);
```
Si `external_payment_id` puede ser NULL (pagos pendientes sin ID de MP), hacer el constraint condicional:
```sql
CREATE UNIQUE INDEX payments_external_payment_id_unique
  ON payments (external_payment_id)
  WHERE external_payment_id IS NOT NULL;
```

### Referencias
- [Source: jedami-bff/src/modules/payments/ o ruta equivalente]
- [Source: jedami-bff/src/database/migrations/] — patrón de migraciones

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Debug Log References
N/A

### Completion Notes List
- Deduplicación implementada en `payments.service.ts`: early return si `payment.status` ya es `approved` o `rejected`
- Guardas idempotentes en ambas queries UPDATE orders: `AND status != 'paid'` (para approved y rejected)
- Migración usa UNIQUE INDEX parcial (`WHERE mp_payment_id IS NOT NULL`) — compatible con filas pendientes sin ID de MP

### File List
- jedami-bff/src/database/migrations/023_payments_unique_external_id.sql (new)
- jedami-bff/src/modules/payments/payments.service.ts (modified)
