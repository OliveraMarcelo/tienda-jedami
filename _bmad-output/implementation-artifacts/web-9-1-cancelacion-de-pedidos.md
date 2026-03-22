# Story W9.1: Cancelación de Pedidos — Web

Status: done

## Story

Como comprador o administrador,
quiero poder cancelar un pedido pendiente desde la interfaz web,
para no tener que contactar al negocio para liberar un pedido abandonado.

## Acceptance Criteria

1. **Given** el comprador está en `Mis Pedidos` y tiene un pedido en estado `pending`
   **When** ve el pedido
   **Then** aparece un botón "Cancelar pedido" junto al estado

2. **Given** el comprador hace click en "Cancelar pedido"
   **When** se muestra la confirmación
   **Then** aparece un diálogo o mensaje inline `"¿Estás seguro? Esta acción no se puede deshacer."` con botones Confirmar / No, volver

3. **Given** el comprador confirma la cancelación
   **When** se llama `PATCH /orders/:id/cancel`
   **Then** el pedido pasa a estado `cancelled` en la lista sin recargar la página
   **And** el botón desaparece

4. **Given** el admin está en `Pagos` y ve un pedido `pending`
   **When** lo cancela
   **Then** el mismo flujo aplica desde `AdminPaymentsView.vue`

5. **Given** la cancelación falla (error de red u otro)
   **When** se intenta confirmar
   **Then** se muestra el mensaje de error del BFF sin cerrar el diálogo

## Tasks / Subtasks

- [ ] Agregar `cancelOrder(orderId)` en `src/api/orders.api.ts` → `PATCH /orders/:id/cancel` (AC: 1)
- [ ] Actualizar `OrdersView.vue`: mostrar botón "Cancelar" para pedidos en `pending` (AC: 1, 2, 3)
  - [ ] Estado local `cancelling: number | null` y `cancelError: string`
  - [ ] Confirmación inline (sin modal externo — usar `confirm()` del navegador o un div inline)
  - [ ] Al confirmar: llamar `cancelOrder`, actualizar el pedido en la lista local
- [ ] Actualizar `AdminPaymentsView.vue`: agregar botón "Cancelar" para pagos/pedidos en estado `pending` (AC: 4)
  - [ ] Mismo patrón que OrdersView
- [ ] Agregar label `cancelled` en los mapas de colores/etiquetas de estado (AC: 3)

## Dev Notes

### Función API
```typescript
// src/api/orders.api.ts
export async function cancelOrder(orderId: number): Promise<void> {
  await apiClient.patch(`/orders/${orderId}/cancel`)
}
```

### Patrón de confirmación inline (sin dependencias extra)
```vue
<!-- OrdersView.vue -->
<div v-if="order.status === 'pending'" class="flex flex-col gap-1">
  <button
    v-if="confirmingCancel !== order.id"
    @click="confirmingCancel = order.id"
    class="text-xs text-red-500 hover:text-red-700 font-medium"
  >Cancelar pedido</button>

  <template v-else>
    <p class="text-xs text-gray-600">¿Estás seguro?</p>
    <div class="flex gap-2">
      <button @click="doCancel(order.id)" class="text-xs text-red-600 font-semibold">Sí, cancelar</button>
      <button @click="confirmingCancel = null" class="text-xs text-gray-500">No, volver</button>
    </div>
    <p v-if="cancelError" class="text-xs text-red-500">{{ cancelError }}</p>
  </template>
</div>
```

```typescript
const confirmingCancel = ref<number | null>(null)
const cancelError = ref('')

async function doCancel(orderId: number) {
  cancelError.value = ''
  try {
    await cancelOrder(orderId)
    // Actualizar en lista local
    const order = orders.value.find(o => o.id === orderId)
    if (order) order.status = 'cancelled'
    confirmingCancel.value = null
  } catch (e: any) {
    cancelError.value = e?.response?.data?.detail ?? 'Error al cancelar'
  }
}
```

### Estado `cancelled` en colores y labels
```typescript
// Agregar en los mapas existentes:
const statusColors = {
  ...
  cancelled: 'bg-gray-50 text-gray-500 border-gray-200',
}
const statusLabels = {
  ...
  cancelled: 'Cancelado',
}
```

### Depende de
Story 9-2 (BFF cancelación) debe estar done.

### Referencias
- [Source: jedami-web/src/views/OrdersView.vue]
- [Source: jedami-web/src/views/admin/AdminPaymentsView.vue]
- [Source: jedami-web/src/api/orders.api.ts o equivalente]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
