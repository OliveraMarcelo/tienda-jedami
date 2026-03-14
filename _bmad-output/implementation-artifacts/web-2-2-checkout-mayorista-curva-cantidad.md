# Story W2.2: Checkout Mayorista — CurvaCalculator y Compra por Cantidad

Status: review

## Story

Como comprador mayorista autenticado,
quiero elegir el tipo de compra (curva o cantidad) y ver el resumen calculado antes de confirmar,
para que pueda hacer pedidos mayoristas con precisión y eficiencia.

**Depende de:** BFF Stories 2.2 + 2.3 + 2.4 done (crear pedido + agregar items curva/cantidad)

## Acceptance Criteria

1. **Given** el mayorista está en el detalle de un producto en modo wholesale
   **When** ve las opciones de compra
   **Then** ve dos tabs/botones: "Comprar por curva" y "Comprar por cantidad"

2. **Given** el mayorista selecciona "Comprar por curva" e ingresa N=3
   **When** el `CurvaCalculator` calcula
   **Then** muestra en tiempo real: talle S: 3uds, talle M: 3uds, ... total X uds, total $Y

3. **Given** una variante no tiene stock suficiente para N curvas
   **When** el CurvaCalculator la evalúa
   **Then** esa variante aparece en rojo con texto "Sin stock suficiente (disponibles: X)"

4. **Given** el mayorista selecciona "Comprar por cantidad" e ingresa N=50
   **When** el stock total del producto ≥ 50
   **Then** muestra: "Se distribuirán 50 unidades entre las variantes disponibles" con estimación de distribución

5. **Given** el mayorista hace click en "Agregar al pedido"
   **When** el request al BFF es exitoso
   **Then** aparece un Toast "✓ Agregado al pedido" y el botón muestra "Ver pedido" como acción siguiente

6. **Given** el BFF retorna 422 (stock insuficiente)
   **When** se muestra el error
   **Then** el mensaje inline muestra `detail` del RFC 7807 con la variante específica que falló

## Tasks / Subtasks

- [ ] Task 1 — Crear `src/api/orders.api.ts` (AC: #5, #6)
  - [ ] `createOrder(purchaseType)`: POST `/orders` con `{ purchaseType: 'curva' | 'cantidad' }`
  - [ ] `addItemCurva(orderId, productId, curves)`: POST `/orders/:orderId/items` con `{ productId, curves: N }`
  - [ ] `addItemCantidad(orderId, productId, quantity)`: POST `/orders/:orderId/items` con `{ productId, quantity: N }`

- [ ] Task 2 — Crear `src/stores/orders.store.ts` (AC: #5)
  - [ ] Estado: `currentOrder`, `loading`, `error`
  - [ ] Acción `startWholesaleOrder(purchaseType)`: crea pedido y guarda en state
  - [ ] Acción `addItem(orderId, dto)`: agrega ítem al pedido actual

- [ ] Task 3 — Crear `CurvaCalculator.vue` (AC: #2, #3)
  - [ ] Props: `product: ProductWithVariants`, `mode: 'retail' | 'wholesale'`
  - [ ] Input numérico "Número de curvas" con `@input` reactivo
  - [ ] Tabla resultado: talle | cantidad | precio unitario | subtotal
  - [ ] Filas en rojo si `stock.quantity < N` con mensaje "Sin stock suficiente (disponibles: X)"
  - [ ] Totales: "X unidades · $Y total"
  - [ ] CTA "Agregar al pedido" deshabilitado si N=0 o hay variantes sin stock suficiente
  - [ ] Es el **componente de deleite** del mayorista — debe sentirse polido y responsivo

- [ ] Task 4 — Actualizar `ProductView.vue` para mayoristas (AC: #1, #4, #5, #6)
  - [ ] Si `authStore.isWholesale`: mostrar tabs "Por curva" / "Por cantidad" con `CurvaCalculator`
  - [ ] Tab "Por cantidad": input simple con validación contra stock total del producto
  - [ ] Toast con shadcn-vue `useToast()` al agregar exitosamente
  - [ ] Error inline (no Dialog) para errores 422

## Dev Notes

### Endpoints del BFF a consumir

```
POST /api/v1/orders
  Headers: Authorization: Bearer {token}  (wholesale)
  Body: { "purchaseType": "curva" | "cantidad" }
  Response 201: { data: { id, customerId, purchaseType, status, createdAt } }

POST /api/v1/orders/:orderId/items  (curva)
  Body: { "productId": 1, "curves": 3 }
  Response 200: { data: { orderId, items: [...], totalAmount } }
  Error 422: { type, title, status: 422, detail: "Variante talle M sin stock suficiente (disponibles: 1)" }

POST /api/v1/orders/:orderId/items  (cantidad)
  Body: { "productId": 1, "quantity": 50 }
  Response 200: { data: { orderId, items: [...], totalAmount } }
  Error 422: { type, title, status: 422, detail: "Stock insuficiente. Disponible: 35 unidades" }
```

### CurvaCalculator — lógica de cálculo

```typescript
// El CurvaCalculator calcula en el CLIENTE sin llamar al API — solo valida contra los datos del producto
const calculateCurva = (product: ProductWithVariants, curves: number) => {
  return product.variants.map(variant => ({
    size: variant.size,
    color: variant.color,
    requested: curves,
    available: variant.stock.quantity,
    hasStock: variant.stock.quantity >= curves,
    subtotal: curves * variant.retailPrice,
  }))
}
// La validación REAL de stock la hace el BFF al confirmar — el frontend es optimista pero informativo
```

### References

- BFF stories 2.2, 2.3, 2.4: [Source: _bmad-output/planning-artifacts/epics.md#Story 2.2], [#Story 2.3], [#Story 2.4]
- UX Design Spec — CurvaCalculator component: [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Custom Components]
- UX Design Spec — J1 (mayorista por curva): [Source: _bmad-output/planning-artifacts/ux-design-specification.md#User Journey Flows]
- UX Design Spec — Feedback patterns (Toast, error inline): [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Feedback Patterns]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Task 1: `orders.api.ts` con createOrder, addItemCurva, addItemCantidad, fetchOrders, fetchOrder.
- Task 2: `orders.store.ts` con Pinia composition API: startWholesaleOrder, addItem, loadOrders, loadOrder.
- Task 3: `CurvaCalculator.vue` con tabla reactiva, filas rojas para variantes sin stock, totales y botón CTA deshabilitado si hay insuficiencia.
- Task 4: ProductView.vue refactorizado con tabs "Por curva" / "Por cantidad" visibles solo para isWholesale. Toast inline de éxito con auto-dismiss. Error inline RFC 7807.

### File List

- `jedami-web/src/api/orders.api.ts` (NUEVO)
- `jedami-web/src/stores/orders.store.ts` (NUEVO)
- `jedami-web/src/components/features/catalog/CurvaCalculator.vue` (NUEVO)
- `jedami-web/src/views/ProductView.vue` (MODIFICADO — tabs wholesale)
