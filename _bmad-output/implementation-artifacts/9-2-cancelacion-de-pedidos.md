# Story 9.2: Cancelación de Pedidos — BFF

Status: done

## Story

Como comprador o administrador,
quiero poder cancelar un pedido en estado `pending`,
para liberar el stock reservado cuando el comprador no va a completar la compra.

## Acceptance Criteria

1. **Given** un pedido está en estado `pending`
   **When** el dueño del pedido o un admin llama `PATCH /orders/:id/cancel`
   **Then** el pedido cambia a estado `cancelled`
   **And** el stock de cada variante del pedido se restaura (suma la cantidad de vuelta)
   **And** todo ocurre en una transacción atómica

2. **Given** un pedido está en estado `paid`, `rejected` o `cancelled`
   **When** se intenta cancelar
   **Then** el BFF retorna 422 con `{ detail: "Solo se pueden cancelar pedidos en estado pending" }`

3. **Given** el pedido no pertenece al usuario autenticado
   **When** un usuario no-admin intenta cancelarlo
   **Then** el BFF retorna 403

4. **Given** el admin cancela cualquier pedido `pending`
   **When** llama al endpoint con rol admin
   **Then** la operación se permite sin importar de quién es el pedido

## Tasks / Subtasks

- [ ] Crear query `modules/orders/queries/cancel-order.ts`: UPDATE status + RETURNING (AC: 1)
- [ ] Crear función de servicio `cancelOrder(orderId, userId, isAdmin)` en `orders.service.ts` (AC: 1, 2, 3)
  - Obtener el pedido: si no existe → 404
  - Verificar ownership: si `order.customer_id` no corresponde al user Y no es admin → 403
  - Verificar estado: si no es `pending` → 422
  - En transacción: restaurar stock por cada `order_item`, luego UPDATE `orders.status = 'cancelled'`
- [ ] Crear handler `cancelOrderHandler` en `orders.controller.ts` (AC: 1, 2, 3, 4)
- [ ] Registrar `PATCH /orders/:id/cancel` en `routes/orders.routes.ts` con `authMiddleware` (AC: 1)

## Dev Notes

### Query de cancelación
```typescript
// cancel-order.ts
export const CANCEL_ORDER = `
  UPDATE orders
  SET status = 'cancelled', updated_at = NOW()
  WHERE id = $1 AND status = 'pending'
  RETURNING id, status, customer_id
`
```

### Lógica transaccional para restaurar stock
```typescript
const client = await pool.connect()
try {
  await client.query('BEGIN')
  // 1. Verificar que el pedido existe y está pending
  const orderRes = await client.query('SELECT * FROM orders WHERE id = $1', [orderId])
  if (!orderRes.rows[0]) throw new AppError(404, ...)
  if (orderRes.rows[0].status !== 'pending') throw new AppError(422, ...)
  // 2. Ownership check
  if (!isAdmin && orderRes.rows[0].customer_id !== customerId) throw new AppError(403, ...)
  // 3. Restaurar stock
  const items = await client.query('SELECT variant_id, quantity FROM order_items WHERE order_id = $1', [orderId])
  for (const item of items.rows) {
    await client.query(
      'UPDATE stock SET quantity = quantity + $1 WHERE variant_id = $2',
      [item.quantity, item.variant_id]
    )
  }
  // 4. Cambiar estado
  await client.query(CANCEL_ORDER, [orderId])
  await client.query('COMMIT')
} catch (err) {
  await client.query('ROLLBACK')
  throw err
} finally {
  client.release()
}
```

### Resolver customer_id del usuario autenticado
```typescript
// Desde req.user.id → buscar customers WHERE user_id = req.user.id
// Ver patrón en orders.controller.ts existente
```

### Ruta
```typescript
router.patch('/:id/cancel', authMiddleware, cancelOrderHandler)
```

### Invalidar caché
```typescript
await cacheDel(`order:${orderId}`) // si existe caché de pedidos individuales
```

### Referencias
- [Source: jedami-bff/src/modules/orders/orders.service.ts]
- [Source: jedami-bff/src/modules/orders/orders.controller.ts]
- [Source: jedami-bff/src/routes/orders.routes.ts]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
