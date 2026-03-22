# Story 9.4: Reintento de Pago Fallido — BFF

Status: done

## Story

Como comprador cuyo pago fue rechazado,
quiero poder generar un nuevo link de pago para mi pedido,
para completar la compra sin tener que crear un nuevo pedido.

## Acceptance Criteria

1. **Given** un pedido está en estado `pending` o `rejected`
   **When** el dueño del pedido llama `POST /payments/:orderId/retry`
   **Then** el BFF genera una nueva preferencia de pago en Mercado Pago
   **And** retorna `{ checkoutUrl }` con la nueva URL de pago

2. **Given** un pedido está en estado `paid` o `cancelled`
   **When** se intenta reintentar el pago
   **Then** el BFF retorna 422 con `{ detail: "No se puede reintentar: el pedido está en estado [estado]" }`

3. **Given** el pedido no pertenece al usuario autenticado
   **When** un usuario no-admin intenta el reintento
   **Then** el BFF retorna 403

4. **Given** un admin reintenta el pago de cualquier pedido
   **When** llama al endpoint
   **Then** la operación se permite sin restricción de ownership

## Tasks / Subtasks

- [ ] Crear handler `retryPaymentHandler` en `modules/payments/payments.controller.ts` (AC: 1, 2, 3, 4)
  - Verificar ownership (igual que cancelación)
  - Verificar que el estado sea `pending` o `rejected`
  - Llamar al servicio de MP para crear nueva preferencia (reutilizar lógica existente del checkout)
  - Retornar `{ data: { checkoutUrl } }`
- [ ] Crear función de servicio `retryPayment(orderId, customerId, isAdmin)` en `payments.service.ts` (AC: 1, 2, 3)
- [ ] Registrar `POST /payments/:orderId/retry` en `routes/payments.routes.ts` con `authMiddleware` (AC: 1)

## Dev Notes

### Reutilizar lógica de checkout existente
La función existente `POST /payments/:orderId/checkout` ya genera una preferencia de MP. `retryPayment` debe reutilizar esa lógica (o llamar al mismo servicio) sin duplicar código.

```typescript
// payments.service.ts — diferencia de checkout vs retry
// checkout: solo funciona si status = 'pending' por primera vez
// retry:    funciona si status = 'pending' O 'rejected'
```

### Response shape
```json
{
  "data": {
    "checkoutUrl": "https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=..."
  }
}
```

### Ruta
```typescript
router.post('/:orderId/retry', authMiddleware, retryPaymentHandler)
```

### Resolver customer_id
Ver patrón existente en payments.controller.ts — req.user.id → customers WHERE user_id = req.user.id.

### Referencias
- [Source: jedami-bff/src/modules/payments/payments.controller.ts]
- [Source: jedami-bff/src/modules/payments/payments.service.ts]
- [Source: jedami-bff/src/routes/payments.routes.ts]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
