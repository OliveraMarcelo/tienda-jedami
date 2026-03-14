# Story W2.3: Mis Pedidos — Vista Mayorista

Status: review

## Story

Como comprador mayorista autenticado,
quiero ver el historial de mis pedidos con su estado y detalle,
para que pueda hacer seguimiento de mis compras.

**Depende de:** BFF Story 2.5 done (consulta de pedidos del comprador mayorista)

## Acceptance Criteria

1. **Given** el mayorista está autenticado
   **When** accede a `/pedidos`
   **Then** ve la lista de sus pedidos ordenada por fecha descendente, con: `status` (badge), `purchaseType` (Curva/Cantidad), `totalAmount` y `createdAt`

2. **Given** el mayorista tiene pedidos en distintos estados
   **When** ve la lista
   **Then** cada pedido muestra un badge de estado con colores:
   - `pending` → gris/amarillo "Pendiente de pago"
   - `paid` → verde "Pagado"
   - `rejected` → rojo "Rechazado"

3. **Given** el mayorista hace click en un pedido de la lista
   **When** entra al detalle `/pedidos/:orderId`
   **Then** ve todos los items con: talle + color (variante), cantidad, unitPrice y subtotal
   **And** ve el total del pedido y un CTA "Pagar ahora" si el status es `pending`

4. **Given** el mayorista no tiene pedidos
   **When** accede a `/pedidos`
   **Then** ve un estado vacío con texto "Todavía no tenés pedidos" y un CTA "Ver catálogo"

5. **Given** el mayorista está en `/pedidos` con status `pending`
   **When** el sistema carga la página
   **Then** el CTA "Pagar ahora" lleva a `/pedidos/:orderId` donde puede iniciar el pago (Story W3.1)

## Tasks / Subtasks

- [ ] Task 1 — Crear `src/api/orders.api.ts` (si no existe de W2.2) (AC: #1, #3)
  - [ ] `fetchOrders()`: GET `/orders` → `{ data: [...], meta: { total } }`
  - [ ] `fetchOrder(orderId)`: GET `/orders/:orderId` → `{ data: { id, purchaseType, status, totalAmount, createdAt, items: [...] } }`
  - [ ] Tipos: `Order`, `OrderItem`, `OrderStatus`

- [ ] Task 2 — Extender `src/stores/orders.store.ts` (AC: #1, #4)
  - [ ] Estado: `orders: Order[]`, `currentOrder: Order | null`, `loading`, `error`
  - [ ] Acción `fetchOrders()`: carga la lista y guarda en state
  - [ ] Acción `fetchOrder(orderId)`: carga el detalle y guarda en `currentOrder`

- [ ] Task 3 — Crear `src/views/OrdersView.vue` (AC: #1, #2, #4)
  - [ ] Lista de pedidos con `OrderCard` por item
  - [ ] Badge de status con color semántico (shadcn-vue `Badge` component)
  - [ ] `purchaseType` label: "Por curva" / "Por cantidad"
  - [ ] Estado vacío con ilustración + CTA
  - [ ] Loading skeleton mientras carga
  - [ ] Ruta `/pedidos` con `meta: { requiresAuth: true }`

- [ ] Task 4 — Crear `src/views/OrderDetailView.vue` (AC: #3, #5)
  - [ ] Header con datos del pedido: fecha, status badge, purchaseType, totalAmount
  - [ ] Tabla de items: variante (talle + color), cantidad, unitPrice, subtotal
  - [ ] Total final destacado
  - [ ] CTA "Pagar ahora" visible solo si `status === 'pending'`
  - [ ] Ruta `/pedidos/:orderId` con `meta: { requiresAuth: true }`

- [ ] Task 5 — Agregar rutas en el router (AC: #1, #3)
  - [ ] `/pedidos` → `OrdersView` con guard `requiresAuth`
  - [ ] `/pedidos/:orderId` → `OrderDetailView` con guard `requiresAuth`
  - [ ] Link "Mis pedidos" en el header/navegación principal (visible si autenticado)

## Dev Notes

### Endpoints del BFF a consumir

```
GET /api/v1/orders
  Headers: Authorization: Bearer {token}  (wholesale)
  Response 200: { data: [{ id, purchaseType, status, totalAmount, createdAt }], meta: { total } }

GET /api/v1/orders/:orderId
  Headers: Authorization: Bearer {token}  (wholesale)
  Response 200: {
    data: {
      id, purchaseType, status, totalAmount, createdAt,
      items: [{ variantId, size, color, quantity, unitPrice }]
    }
  }
  Error 403: el pedido pertenece a otro usuario
  Error 404: pedido no encontrado
```

### Modelo TypeScript

```typescript
// src/api/orders.api.ts

export type OrderStatus = 'pending' | 'paid' | 'rejected'
export type PurchaseType = 'curva' | 'cantidad'

export interface OrderItem {
  variantId: number
  size: string
  color: string
  quantity: number
  unitPrice: number
}

export interface Order {
  id: number
  purchaseType: PurchaseType
  status: OrderStatus
  totalAmount: number
  createdAt: string
  items?: OrderItem[]
}
```

### Badge de status

```typescript
// colores para shadcn-vue Badge variant
const statusConfig = {
  pending:  { label: 'Pendiente de pago', variant: 'secondary' },
  paid:     { label: 'Pagado',            variant: 'default' },   // verde
  rejected: { label: 'Rechazado',         variant: 'destructive' },
}
```

### Navigation

- Desde `OrdersView` → click en pedido → `router.push('/pedidos/' + order.id)`
- Desde `OrderDetailView` → CTA "Pagar ahora" → link a flujo de pago (W3.1)
- Desde estado vacío → CTA "Ver catálogo" → `router.push('/catalogo')`

### References

- BFF story 2.5: [Source: _bmad-output/implementation-artifacts/sprint-status.yaml]
- W2.2 (orders.api.ts + orders.store.ts): [Source: _bmad-output/implementation-artifacts/web-2-2-checkout-mayorista-curva-cantidad.md]
- W3.1 (flujo de pago): [Source: _bmad-output/implementation-artifacts/web-3-1-boton-pago-y-confirmacion.md]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Task 1: orders.api.ts ya incluía fetchOrders/fetchOrder de W2.2.
- Task 2: orders.store.ts ya incluía loadOrders/loadOrder de W2.2.
- Task 3: OrdersView.vue implementada con badges de status, purchaseType labels, estado vacío con CTA, skeleton loading.
- Task 4: OrderDetailView.vue con tabla de items, total destacado y botón "Pagar ahora" condicional.
- Task 5: Router actualizado con /pedidos/:orderId y /perfil.

### File List

- `jedami-web/src/views/OrdersView.vue` (MODIFICADO — implementación completa desde placeholder)
- `jedami-web/src/views/OrderDetailView.vue` (NUEVO)
- `jedami-web/src/router/index.ts` (MODIFICADO — rutas /pedidos/:orderId y /perfil)
