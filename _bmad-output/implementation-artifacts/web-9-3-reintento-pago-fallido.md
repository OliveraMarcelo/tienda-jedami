# Story W9.3: Reintento de Pago Fallido — Web

Status: done

## Story

Como comprador cuyo pago fue rechazado,
quiero poder reintentar el pago desde "Mis Pedidos",
para no tener que crear un pedido nuevo cuando Mercado Pago falla.

## Acceptance Criteria

1. **Given** el comprador tiene un pedido en estado `rejected` o `pending` (sin haber pagado)
   **When** ve la lista en `OrdersView`
   **Then** aparece un botón "Reintentar pago" junto al estado del pedido

2. **Given** el comprador hace click en "Reintentar pago"
   **When** la llamada a `POST /payments/:orderId/retry` tiene éxito
   **Then** se redirige automáticamente al usuario a la URL de checkout de Mercado Pago

3. **Given** la llamada falla
   **When** ocurre el error
   **Then** se muestra el error del BFF sin redirigir

4. **Given** el admin está en `AdminPaymentsView`
   **When** ve un pedido `rejected` o `pending`
   **Then** también aparece el botón "Reintentar pago" para poder asistir al cliente

## Tasks / Subtasks

- [ ] Agregar `retryPayment(orderId)` en `src/api/payments.api.ts` → `POST /payments/:orderId/retry` (AC: 1)
  - Retorna `{ checkoutUrl: string }`
- [ ] Actualizar `OrdersView.vue`: mostrar botón "Reintentar pago" para pedidos `rejected` o `pending` (AC: 1, 2, 3)
  - Estado local: `retrying: number | null`, `retryError: string`
  - Al éxito: `window.location.href = checkoutUrl`
- [ ] Actualizar `AdminPaymentsView.vue`: mismo botón para pedidos en esos estados (AC: 4)

## Dev Notes

### Función API
```typescript
// payments.api.ts
export async function retryPayment(orderId: number): Promise<{ checkoutUrl: string }> {
  const res = await apiClient.post<{ data: { checkoutUrl: string } }>(`/payments/${orderId}/retry`)
  return res.data.data
}
```

### Lógica en el componente
```typescript
const retrying = ref<number | null>(null)
const retryError = ref<Record<number, string>>({})

async function handleRetry(orderId: number) {
  retrying.value = orderId
  retryError.value[orderId] = ''
  try {
    const { checkoutUrl } = await retryPayment(orderId)
    window.location.href = checkoutUrl
  } catch (e: any) {
    retryError.value[orderId] = e?.response?.data?.detail ?? 'Error al generar el link de pago'
  } finally {
    retrying.value = null
  }
}
```

### Template
```vue
<template v-if="['rejected', 'pending'].includes(order.status)">
  <button
    @click="handleRetry(order.id)"
    :disabled="retrying === order.id"
    class="text-xs font-semibold text-[var(--color-primary)] hover:opacity-80 disabled:opacity-40"
  >
    {{ retrying === order.id ? 'Generando link…' : 'Reintentar pago' }}
  </button>
  <p v-if="retryError[order.id]" class="text-xs text-red-500">{{ retryError[order.id] }}</p>
</template>
```

### Depende de
Story 9-4 (BFF reintento pago) debe estar done.

### Referencias
- [Source: jedami-web/src/views/OrdersView.vue]
- [Source: jedami-web/src/views/admin/AdminPaymentsView.vue]
- [Source: jedami-web/src/api/payments.api.ts o equivalente]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
