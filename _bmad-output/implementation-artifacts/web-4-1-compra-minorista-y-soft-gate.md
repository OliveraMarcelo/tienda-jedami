# Story W4.1: Compra Minorista y Soft Registration Gate

Status: ready-for-dev

## Story

Como visitante o comprador minorista,
quiero seleccionar una variante de producto y comprarlo, con un gate de registro contextual si no tengo cuenta,
para que la experiencia de compra sea simple y sin fricciones innecesarias.

**Depende de:** BFF Story 4.1 done (compra minorista con validación de stock)

## Acceptance Criteria

1. **Given** un visitante sin cuenta está en el detalle de un producto (`/catalogo/:productId`)
   **When** selecciona un color + talle y hace click en "Comprar"
   **Then** aparece un `Sheet` (bottom sheet de shadcn-vue) con dos opciones: "Crear cuenta gratis" e "Iniciar sesión"
   **And** la selección de variante permanece activa (el item sigue seleccionado)

2. **Given** el visitante elige "Crear cuenta gratis" en el bottom sheet
   **When** completa el registro exitosamente
   **Then** el Sheet se cierra y el flujo de compra continúa automáticamente con la variante ya seleccionada
   **And** el pedido se crea sin que el usuario tenga que seleccionar nuevamente

3. **Given** el minorista está autenticado y está en el detalle de un producto
   **When** selecciona color + talle disponibles y hace click en "Comprar"
   **Then** se llama `POST /api/v1/orders` con `{ items: [{ variantId, quantity: 1 }] }`
   **And** si el pedido se crea exitosamente, el usuario es redirigido a `/pedidos/:orderId` para pagar

4. **Given** el minorista intenta comprar una variante sin stock
   **When** el BFF retorna 422
   **Then** se muestra un mensaje inline "Sin stock disponible para esta variante" bajo el selector (no Toast, no Dialog)

5. **Given** el minorista selecciona una variante con stock limitado (≤ 3 unidades)
   **When** ve el `VariantSelector`
   **Then** el botón de talle muestra un badge "Últimas X unidades" en color naranja

6. **Given** el modo `data-mode` en `<html>` es `retail`
   **When** el usuario autenticado como minorista ve el ProductView
   **Then** el CTA de compra dice "Comprar" (no "Agregar al pedido" que es mayorista)

## Tasks / Subtasks

- [ ] Task 1 — Crear `src/components/features/catalog/SoftRegistrationGate.vue` (AC: #1, #2)
  - [ ] `Sheet` de shadcn-vue que se abre con `open` prop
  - [ ] Dos botones: "Crear cuenta gratis" → abre form de registro inline | "Iniciar sesión" → redirige a `/login`
  - [ ] Form de registro inline en el mismo Sheet (email + password + tipo cliente)
  - [ ] Emit `registered` cuando el registro es exitoso → el componente padre continúa el flujo
  - [ ] La variante seleccionada se pasa como prop y se preserva durante el registro

- [ ] Task 2 — Crear `src/api/retail-orders.api.ts` (AC: #3, #4)
  - [ ] `createRetailOrder(items: { variantId: number, quantity: number }[])`: POST `/orders`
  - [ ] Response: `{ data: { id, status, totalAmount, items } }`
  - [ ] Error 422 con RFC 7807: re-throw con `detail` del BFF para mostrarlo inline

- [ ] Task 3 — Actualizar `ProductView.vue` para flujo minorista (AC: #1, #2, #3, #4, #5, #6)
  - [ ] Si `!authStore.isAuthenticated`: al hacer click en "Comprar" → abre `SoftRegistrationGate`
  - [ ] Si `authStore.isRetail`: CTA "Comprar" (no "Agregar al pedido")
  - [ ] Si `authStore.isWholesale`: CTA "Agregar al pedido" (ya existe de W2.2)
  - [ ] Handler `handleBuyRetail()`: crea pedido → redirige a `/pedidos/:id`
  - [ ] Error inline bajo el `VariantSelector` si el BFF retorna 422
  - [ ] Badge "Últimas X unidades" en `VariantSelector` si `stock.quantity <= 3`
  - [ ] Integrar `SoftRegistrationGate` con `@registered` handler que llama `handleBuyRetail()` post-registro

- [ ] Task 4 — Actualizar `VariantSelector.vue` (AC: #5)
  - [ ] Prop adicional: `showLowStockBadge?: boolean` (default true)
  - [ ] Si `variant.stock.quantity <= 3 && variant.stock.quantity > 0`: mostrar badge naranja "Últimas X unidades"
  - [ ] Si `variant.stock.quantity === 0`: botón tachado, `aria-disabled=true` (ya implementado en W1.3)

## Dev Notes

### Endpoint del BFF a consumir

```
POST /api/v1/orders
  Headers: Authorization: Bearer {token}  (retail)
  Body: { "items": [{ "variantId": 5, "quantity": 1 }] }
  Response 201: { data: { id, status: "pending", totalAmount, items: [...] } }
  Error 422: { type, title, status: 422, detail: "Talle M color azul sin stock suficiente (disponibles: 0)" }
  Error 403: usuario sin rol retail o wholesale
```

**Diferencia con compra mayorista:**
- Minorista: `POST /orders` con `{ items: [{ variantId, quantity }] }` — compra directa por variante
- Mayorista: `POST /orders` con `{ purchaseType }` → luego `POST /orders/:id/items` con curva o cantidad
- El BFF distingue por el `purchase_type` del pedido; retail no envía `purchaseType`

### Flujo del Soft Registration Gate

```typescript
// ProductView.vue
const selectedVariant = ref<Variant | null>(null)
const showGate = ref(false)

async function handleBuyClick() {
  if (!authStore.isAuthenticated) {
    showGate.value = true  // abre el Sheet
    return
  }
  await handleBuyRetail()
}

async function handleBuyRetail() {
  if (!selectedVariant.value) return
  try {
    const order = await retailOrdersApi.createRetailOrder([
      { variantId: selectedVariant.value.id, quantity: 1 }
    ])
    router.push(`/pedidos/${order.id}`)
  } catch (err: AppError) {
    inlineError.value = err.detail  // mostrar bajo el VariantSelector
  }
}

// El Gate emite 'registered' cuando el usuario se registró exitosamente
// El authStore ya tiene el token → el usuario está autenticado
// Llamamos handleBuyRetail() directamente
function onGateRegistered() {
  showGate.value = false
  handleBuyRetail()
}
```

### Modo retail vs wholesale en ProductView

El `ProductView` ya tiene lógica condicional de W2.2 para mayoristas. La lógica extendida:

```vue
<!-- ProductView.vue -->
<template>
  <!-- CTA para mayorista (ya existe de W2.2) -->
  <div v-if="authStore.isWholesale">
    <!-- tabs curva/cantidad + CurvaCalculator -->
  </div>

  <!-- CTA para minorista autenticado -->
  <div v-else-if="authStore.isRetail">
    <Button @click="handleBuyRetail" :disabled="!selectedVariant">
      Comprar
    </Button>
    <p v-if="inlineError" class="text-destructive text-sm mt-1">{{ inlineError }}</p>
  </div>

  <!-- CTA para visitante no autenticado -->
  <div v-else>
    <Button @click="handleBuyClick" :disabled="!selectedVariant">
      Comprar
    </Button>
  </div>

  <!-- Soft Registration Gate -->
  <SoftRegistrationGate
    :open="showGate"
    :selected-variant="selectedVariant"
    @close="showGate = false"
    @registered="onGateRegistered"
  />
</template>
```

### authStore getters necesarios

```typescript
// src/stores/auth.store.ts — agregar getters
isRetail: computed(() => state.value.roles.includes('retail')),
isWholesale: computed(() => state.value.roles.includes('wholesale')),
isAuthenticated: computed(() => !!state.value.token),
```

### References

- BFF story 4.1: [Source: _bmad-output/planning-artifacts/epics.md#Story 4.1]
- W1.3 (VariantSelector base): [Source: _bmad-output/implementation-artifacts/web-1-3-catalogo-publico.md]
- W2.2 (ProductView wholesale, CurvaCalculator): [Source: _bmad-output/implementation-artifacts/web-2-2-checkout-mayorista-curva-cantidad.md]
- W1.2 (authStore, register form): [Source: _bmad-output/implementation-artifacts/web-1-2-auth-pages.md]
- UX J4 (compra minorista con gate): [Source: _bmad-output/planning-artifacts/ux-design-specification.md#User Journey Flows]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

### File List
