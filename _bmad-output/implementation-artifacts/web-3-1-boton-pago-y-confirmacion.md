# Story W3.1: Botón de Pago y Confirmación — Mercado Pago

Status: ready-for-dev

## Story

Como comprador (mayorista o minorista) autenticado,
quiero pagar mi pedido con Mercado Pago desde la interfaz web,
para que pueda completar mi compra y recibir la confirmación del estado final.

**Depende de:** BFF Stories 3.1 + 3.2 done (checkout MP + webhook processing)

## Acceptance Criteria

1. **Given** el comprador tiene un pedido en estado `pending` con `totalAmount > 0`
   **When** hace click en "Pagar con Mercado Pago" en `/pedidos/:orderId`
   **Then** se llama `POST /api/v1/payments/:orderId/checkout` y el browser es redirigido a la `checkoutUrl` retornada por MP

2. **Given** el botón de pago está en estado de carga
   **When** el request al BFF está en proceso
   **Then** el botón muestra un spinner inline y está deshabilitado (evitar doble click)

3. **Given** Mercado Pago redirige de vuelta con `?status=approved`
   **When** el usuario llega a `/pedidos/:orderId/confirmacion`
   **Then** ve el estado del pedido como "Pagado ✓", el total confirmado, y un CTA "Seguir comprando" que lleva a `/catalogo`

4. **Given** Mercado Pago redirige con `?status=rejected`
   **When** el usuario llega a la página de confirmación
   **Then** ve un estado "Pago rechazado" con opciones:
   - "Reintentar pago" → inicia un nuevo checkout para el mismo pedido
   - "Ver mis pedidos" → navega a `/pedidos`

5. **Given** Mercado Pago redirige con `?status=pending`
   **When** el usuario llega a la página de confirmación
   **Then** ve el estado "En proceso" con texto informativo "Tu pago está siendo procesado. Te notificaremos cuando se confirme."

6. **Given** el BFF retorna 422 (pedido sin monto) o 409 (ya pagado)
   **When** se intenta iniciar el checkout
   **Then** se muestra un Toast de error con el `detail` del RFC 7807 (no redirigir a MP)

## Tasks / Subtasks

- [ ] Task 1 — Crear `src/api/payments.api.ts` (AC: #1, #6)
  - [ ] `initiateCheckout(orderId)`: POST `/payments/:orderId/checkout` → `{ data: { orderId, checkoutUrl, paymentId } }`
  - [ ] Manejo de errores 422 y 409 (re-throw como AppError con el RFC 7807 detail)

- [ ] Task 2 — Crear `src/stores/payments.store.ts` (AC: #1, #2)
  - [ ] Estado: `loading`, `error`, `checkoutUrl`
  - [ ] Acción `initiateCheckout(orderId)`: llama API → en caso de éxito redirige a `checkoutUrl`

- [ ] Task 3 — Actualizar `OrderDetailView.vue` con CTA de pago (AC: #1, #2, #6)
  - [ ] Botón "Pagar con Mercado Pago" visible solo si `status === 'pending'` y `totalAmount > 0`
  - [ ] Al hacer click: llama `paymentsStore.initiateCheckout(orderId)`
  - [ ] Estado de carga: spinner inline en el botón, deshabilitado
  - [ ] Error handling: Toast con el detail del error si falla

- [ ] Task 4 — Crear `src/views/PaymentConfirmationView.vue` (AC: #3, #4, #5)
  - [ ] Lee query param `?status=approved|rejected|pending` de la URL de retorno de MP
  - [ ] También lee `?orderId` o lo toma de los params de ruta
  - [ ] Llama `ordersStore.fetchOrder(orderId)` para obtener el estado real del pedido
  - [ ] Renderiza el estado correcto según `status` del query param + estado del pedido
  - [ ] Estado `approved`: checkmark verde, resumen del pedido, CTA "Seguir comprando"
  - [ ] Estado `rejected`: ícono de error, dos opciones (reintentar / ver pedidos)
  - [ ] Estado `pending`: ícono reloj, texto informativo
  - [ ] Ruta: `/pedidos/:orderId/confirmacion`

- [ ] Task 5 — Agregar ruta en el router (AC: #3, #4)
  - [ ] `/pedidos/:orderId/confirmacion` → `PaymentConfirmationView` con `meta: { requiresAuth: true }`

## Dev Notes

### Endpoints del BFF a consumir

```
POST /api/v1/payments/:orderId/checkout
  Headers: Authorization: Bearer {token}
  Response 200: { data: { orderId, checkoutUrl, paymentId } }
  Error 422: { type, title, status: 422, detail: "El pedido no tiene monto para pagar" }
  Error 409: { type, title, status: 409, detail: "El pedido ya fue pagado" }
  Error 403: el pedido no pertenece al usuario autenticado
```

### URL de retorno de Mercado Pago

Mercado Pago redirige a la `back_url` configurada en el BFF. El BFF debe configurar:
```
back_url: {
  success: `${FRONTEND_URL}/pedidos/{orderId}/confirmacion?status=approved`,
  failure: `${FRONTEND_URL}/pedidos/{orderId}/confirmacion?status=rejected`,
  pending: `${FRONTEND_URL}/pedidos/{orderId}/confirmacion?status=pending`,
}
```

El frontend lee el query param `status` para determinar qué mostrar. También hace un `GET /orders/:orderId` para obtener el estado real (por si el webhook ya procesó la notificación).

### Lógica de la página de confirmación

```typescript
// PaymentConfirmationView.vue
const route = useRoute()
const orderId = route.params.orderId
const mpStatus = route.query.status as 'approved' | 'rejected' | 'pending'

onMounted(async () => {
  // Obtener estado real del pedido desde el BFF
  await ordersStore.fetchOrder(Number(orderId))
})

// El estado visual se basa en mpStatus (respuesta inmediata de MP)
// Si el pedido ya está en 'paid' por el webhook, mostrar como aprobado aunque MP diga pending
const displayStatus = computed(() => {
  if (ordersStore.currentOrder?.status === 'paid') return 'approved'
  return mpStatus
})
```

### Reintentar pago

El botón "Reintentar pago" en estado `rejected` debe:
1. Llamar nuevamente a `paymentsStore.initiateCheckout(orderId)`
2. El BFF genera una nueva orden en MP para el mismo pedido
3. Redirigir a la nueva `checkoutUrl`

### References

- BFF stories 3.1 + 3.2: [Source: _bmad-output/planning-artifacts/epics.md#Story 3.1]
- W2.3 (OrderDetailView con CTA): [Source: _bmad-output/implementation-artifacts/web-2-3-mis-pedidos-mayorista.md]
- UX Feedback patterns (Toast, error handling): [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Feedback Patterns]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

### File List
