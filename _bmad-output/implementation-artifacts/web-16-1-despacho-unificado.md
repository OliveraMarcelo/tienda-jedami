# Story web-16.1: Despacho Unificado — WEB

Status: review

## Story

Como administrador,
quiero una vista de despacho unificada para todos los tipos de pedido (curva, cantidad y menor)
donde pueda asignar colores desde una tabla de stock visual,
marcar el pedido como despachado sin obligación de actualizar stock,
y actualizar el stock de cada ítem cuando tenga tiempo.

## Acceptance Criteria

1. **Given** el admin entra a `/admin/despacho`
   **Then** ve todos los pedidos `paid` (curva, cantidad y menor) pendientes de despacho

2. **Given** un pedido de tipo `curva` o `cantidad` con ítems sin color asignado
   **Then** cada ítem muestra una mini tabla con las variantes disponibles para ese talle:
   columnas: color (swatch + nombre) | stock | seleccionar (radio)
   **And** filas con stock = 0 aparecen deshabilitadas

3. **Given** un pedido de tipo `menor`
   **Then** cada ítem muestra la variante asignada (color swatch + nombre + talle) sin selector

4. **Given** el admin hace click en "Marcar despachado" en un pedido
   **Then** se llama `POST /admin/orders/:id/dispatch`
   **And** el pedido desaparece de la lista (o muestra badge "Despachado")
   **And** el stock NO se modifica

5. **Given** el admin seleccionó una variante en un ítem de curva/cantidad
   **When** hace click en "Guardar color" para ese ítem
   **Then** se llama `PATCH /admin/orders/:orderId/items/:itemId/fulfill` con `{ variantId, decrementStock: false }`
   **And** el color queda asignado visualmente (sin descontar stock)

6. **Given** el admin quiere actualizar el stock de un ítem
   **When** hace click en "Descontar stock" en ese ítem (visible si tiene variante asignada)
   **Then** se llama `PATCH /admin/orders/:orderId/items/:itemId/decrement-stock`
   **And** el botón se deshabilita con "Stock actualizado"

## Tasks / Subtasks

- [x] **`admin.fulfillment.api.ts`** — actualizar tipos y agregar funciones:
  - `PendingItem`: agregar `variantAssigned: boolean`, `assignedColor?: string`, `assignedHex?: string | null`
  - `PendingOrder`: agregar `purchaseType: string`
  - Modificar `fulfillItem(orderId, itemId, variantId, decrementStock = false)`
  - Agregar `dispatchOrder(orderId: number): Promise<void>`
  - Agregar `decrementItemStock(orderId: number, itemId: number): Promise<{ stockRemaining: number }>`

- [x] **`AdminFulfillmentView.vue`** — reescribir vista:
  - Título: "Despacho de pedidos" (no solo curva)
  - Badge de tipo de pedido por cada order card (curva/cantidad/menor)
  - Para ítems sin variante (curva/cantidad): mini tabla de stock con radio buttons
  - Para ítems con variante (menor): mostrar variante asignada con swatch
  - Botón "Marcar despachado" por pedido → llama `dispatchOrder` → elimina pedido de la lista
  - Botón "Guardar color" por ítem (solo curva/cantidad sin variante) → llama `fulfillItem(..., false)`
  - Botón "Descontar stock" por ítem (cuando tiene variante) → llama `decrementItemStock`
  - Estado local: `dispatched` set, `stockUpdated` set para UI feedback

## Dev Notes

### admin.fulfillment.api.ts — interfaces actualizadas

```typescript
export interface AvailableVariant {
  id: number
  color: string
  hexCode: string | null
  stock: number
}

export interface PendingItem {
  id: number
  sizeId: number
  size: string
  quantity: number
  unitPrice: number
  productId: number
  productName: string
  variantAssigned: boolean        // true = menor (ya tiene color)
  assignedVariantId?: number      // si variantAssigned = true
  assignedColor?: string
  assignedHex?: string | null
  availableVariants: AvailableVariant[]  // vacío si variantAssigned = true
}

export interface PendingOrder {
  id: number
  createdAt: string
  totalAmount: number
  customerEmail: string
  notes: string | null
  purchaseType: string
  items: PendingItem[]
}

export async function fulfillItem(
  orderId: number, itemId: number, variantId: number, decrementStock = false
): Promise<void> {
  await api.patch(`/admin/orders/${orderId}/items/${itemId}/fulfill`, { variantId, decrementStock })
}

export async function dispatchOrder(orderId: number): Promise<void> {
  await api.post(`/admin/orders/${orderId}/dispatch`)
}

export async function decrementItemStock(
  orderId: number, itemId: number
): Promise<{ stockRemaining: number }> {
  const res = await api.patch<{ data: { stockRemaining: number } }>(
    `/admin/orders/${orderId}/items/${itemId}/decrement-stock`
  )
  return res.data.data
}
```

### Mini tabla de stock (template)

Para un ítem de curva/cantidad sin variante asignada:

```vue
<table class="w-full text-xs mt-2">
  <thead>
    <tr class="text-gray-500 border-b border-gray-100">
      <th class="text-left py-1 font-medium">Color</th>
      <th class="text-right py-1 font-medium">Stock</th>
      <th class="py-1"></th>
    </tr>
  </thead>
  <tbody>
    <tr v-for="v in item.availableVariants" :key="v.id"
        :class="v.stock === 0 ? 'opacity-40' : ''"
        class="border-b border-gray-50">
      <td class="py-1.5 flex items-center gap-2">
        <span class="w-4 h-4 rounded-full border border-gray-200 inline-block"
              :style="{ backgroundColor: v.hexCode ?? '#ccc' }"></span>
        {{ v.color }}
      </td>
      <td class="text-right py-1.5 text-gray-600">{{ v.stock }}</td>
      <td class="py-1.5 pl-2">
        <input type="radio"
               :value="v.id"
               v-model="selections[item.id]"
               :disabled="v.stock === 0"
               class="accent-[#E91E8C]" />
      </td>
    </tr>
  </tbody>
</table>
```

### Botones de acción por ítem

```vue
<!-- Guardar color (curva/cantidad, con variante seleccionada) -->
<button
  v-if="!item.variantAssigned && selections[item.id]"
  @click="doAssignVariant(order, item)"
  :disabled="assigning === item.id"
  class="h-8 px-3 rounded-lg bg-[#E91E8C] text-white text-xs font-semibold ..."
>
  {{ assigning === item.id ? 'Guardando…' : 'Guardar color' }}
</button>

<!-- Descontar stock (cualquier ítem con variante asignada) -->
<button
  v-if="(item.variantAssigned || assigned.has(item.id)) && !stockUpdated.has(item.id)"
  @click="doDecrementStock(order, item)"
  :disabled="decrementingStock === item.id"
  class="h-8 px-3 rounded-lg border border-gray-300 text-xs text-gray-600 ..."
>
  {{ decrementingStock === item.id ? 'Actualizando…' : 'Descontar stock' }}
</button>
<span v-if="stockUpdated.has(item.id)" class="text-xs text-green-600">✓ Stock actualizado</span>
```

### Botón despachar por pedido

```vue
<!-- Fuera del loop de ítems, en la cabecera del pedido -->
<button
  v-if="!dispatched.has(order.id)"
  @click="doDispatch(order)"
  :disabled="dispatching === order.id"
  class="h-9 px-4 rounded-lg bg-gray-800 text-white text-sm font-semibold ..."
>
  {{ dispatching === order.id ? 'Despachando…' : 'Marcar despachado' }}
</button>
<span v-else class="text-sm text-green-600 font-semibold">✓ Despachado</span>
```

### Estado local

```typescript
const selections = ref<Record<number, number | null>>({})    // itemId → variantId
const assigning = ref<number | null>(null)                   // itemId
const assigned = ref<Set<number>>(new Set())                 // itemIds con variante guardada
const dispatching = ref<number | null>(null)                 // orderId
const dispatched = ref<Set<number>>(new Set())               // orderIds despachados
const decrementingStock = ref<number | null>(null)           // itemId
const stockUpdated = ref<Set<number>>(new Set())             // itemIds con stock decrementado
```

### Badge de tipo de pedido

```vue
<span class="text-xs font-semibold px-2 py-0.5 rounded-full"
      :class="{
        'bg-purple-100 text-purple-700': order.purchaseType === 'curva',
        'bg-blue-100 text-blue-700':    order.purchaseType === 'cantidad',
        'bg-gray-100 text-gray-600':    order.purchaseType === 'menor',
      }">
  {{ order.purchaseType === 'curva' ? 'Curva' : order.purchaseType === 'cantidad' ? 'Cantidad' : 'Menor' }}
</span>
```

### Depende de
- Story 16-1 (BFF) — despacho unificado

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Completion Notes
`admin.fulfillment.api.ts` reescrito con nuevas interfaces (`variantAssigned`, `assignedColor/Hex`, `purchaseType`) y funciones `dispatchOrder`, `decrementItemStock`, `fulfillItem` actualizado con `decrementStock`. `AdminFulfillmentView.vue` reescrito: badge de tipo (curva/cantidad/menor), tabla de stock con radio buttons por talle para curva/cantidad, vista de variante asignada para menor, botón "Marcar despachado" por pedido (sin stock), botón "Guardar color" por ítem, botón "Descontar stock" opcional. TypeScript compila sin errores.

### File List
- jedami-web/src/api/admin.fulfillment.api.ts
- jedami-web/src/views/admin/AdminFulfillmentView.vue
