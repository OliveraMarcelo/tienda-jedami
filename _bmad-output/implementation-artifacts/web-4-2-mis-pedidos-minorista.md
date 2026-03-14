# Story W4.2: Mis Pedidos — Vista Minorista

Status: ready-for-dev

## Story

Como comprador minorista autenticado,
quiero ver mis pedidos con su estado de pago y el detalle de cada compra,
para que pueda hacer seguimiento de mis compras minoristas.

**Depende de:** BFF Story 4.2 done (consulta de pedidos del comprador minorista)

## Acceptance Criteria

1. **Given** el minorista está autenticado y accede a `/pedidos`
   **When** la página carga
   **Then** ve la lista de sus pedidos con: `status` (badge), `totalAmount`, `createdAt` y cantidad de items

2. **Given** el minorista tiene pedidos en distintos estados
   **When** ve la lista
   **Then** los badges muestran:
   - `pending` → amarillo "Pendiente de pago" con CTA "Pagar ahora"
   - `paid` → verde "Pagado"
   - `rejected` → rojo "Rechazado" con CTA "Reintentar pago"

3. **Given** el minorista hace click en un pedido
   **When** entra al detalle `/pedidos/:orderId`
   **Then** ve los items con variante (talle + color), cantidad, unitPrice y subtotal
   **And** ve el total del pedido
   **And** si el status es `pending`, ve el botón "Pagar con Mercado Pago"

4. **Given** el minorista no tiene pedidos
   **When** accede a `/pedidos`
   **Then** ve el estado vacío "Todavía no hiciste ninguna compra" con CTA "Explorar catálogo"

## Tasks / Subtasks

- [ ] Task 1 — Verificar/reusar `src/api/orders.api.ts` (AC: #1, #3)
  - [ ] Los endpoints `GET /orders` y `GET /orders/:orderId` son los mismos que los mayoristas usan en W2.3
  - [ ] La respuesta del BFF incluye todos los pedidos del usuario autenticado (minorista o mayorista)
  - [ ] NO crear un archivo duplicado — reusar el de W2.3 si ya existe
  - [ ] Verificar que el tipo `Order` no incluya `purchaseType` como campo requerido (los pedidos minoristas no tienen este campo)

- [ ] Task 2 — Verificar/reusar `src/stores/orders.store.ts` (AC: #1, #4)
  - [ ] Las acciones `fetchOrders()` y `fetchOrder(orderId)` ya existen de W2.3
  - [ ] NO duplicar el store — reusar directamente

- [ ] Task 3 — Actualizar `OrdersView.vue` para soportar pedidos minoristas (AC: #1, #2, #4)
  - [ ] La vista `/pedidos` es compartida entre mayoristas y minoristas
  - [ ] Para minoristas: NO mostrar la columna `purchaseType` (no existe en pedidos minoristas)
  - [ ] Mostrar CTA "Pagar ahora" inline en la card si `status === 'pending'`
  - [ ] Mostrar CTA "Reintentar pago" si `status === 'rejected'`
  - [ ] El estado vacío usa el texto genérico que aplica a ambos tipos de comprador

- [ ] Task 4 — Verificar `OrderDetailView.vue` para compatibilidad minorista (AC: #3)
  - [ ] La vista de detalle es compartida — verificar que funciona con la estructura de pedido minorista
  - [ ] Pedidos minoristas: items con `variantId, size, color, quantity, unitPrice` (mismo formato)
  - [ ] NO mostrar `purchaseType` si no está presente en el pedido
  - [ ] El botón "Pagar con Mercado Pago" (de W3.1) aplica igual para minoristas

## Dev Notes

### Endpoints del BFF a consumir

Los mismos endpoints de W2.3 (BFF story 4.2 usa la misma ruta `GET /orders`):

```
GET /api/v1/orders
  Headers: Authorization: Bearer {token}  (retail)
  Response 200: { data: [{ id, status, totalAmount, createdAt }], meta: { total } }
  Nota: pedidos minoristas NO incluyen purchaseType

GET /api/v1/orders/:orderId
  Headers: Authorization: Bearer {token}  (retail)
  Response 200: {
    data: {
      id, status, totalAmount, createdAt,
      items: [{ variantId, size, color, quantity, unitPrice }]
    }
  }
```

### Diferencias entre vista mayorista y minorista

| Campo | Mayorista (W2.3) | Minorista (W4.2) |
|---|---|---|
| `purchaseType` | Sí (curva/cantidad) | No (no aplica) |
| Items | Por variante (curva) o por producto (cantidad) | Siempre por variante |
| CTA extra | — | "Pagar ahora" prominente |

### Actualización del tipo Order

```typescript
// src/api/orders.api.ts — actualizar tipo Order para hacerlo flexible
export interface Order {
  id: number
  purchaseType?: PurchaseType  // opcional — solo mayoristas lo tienen
  status: OrderStatus
  totalAmount: number
  createdAt: string
  items?: OrderItem[]
}
```

### Reutilización de componentes

Esta story es principalmente de **verificación y ajuste menor** — los componentes principales ya existen:
- `OrdersView.vue` → ajustar para ocultar `purchaseType` cuando no está presente
- `OrderDetailView.vue` → ya debe funcionar con pedidos minoristas (misma estructura de items)
- `OrderCard` (subcomponente) → mostrar CTAs condicionales según status

Si los componentes de W2.3 ya están bien construidos con TypeScript opcional, esta story puede ser muy pequeña.

### References

- BFF story 4.2: [Source: _bmad-output/planning-artifacts/epics.md#Story 4.2]
- W2.3 (OrdersView, OrderDetailView): [Source: _bmad-output/implementation-artifacts/web-2-3-mis-pedidos-mayorista.md]
- W3.1 (botón de pago): [Source: _bmad-output/implementation-artifacts/web-3-1-boton-pago-y-confirmacion.md]
- W4.1 (flujo de compra minorista): [Source: _bmad-output/implementation-artifacts/web-4-1-compra-minorista-y-soft-gate.md]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

### File List
