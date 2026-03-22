# Story web-15.2: WhatsApp — Aviso de Transferencia — WEB

Status: review

## Story

Como comprador,
quiero ver los datos bancarios directamente al acceder a mi pedido (sin tener que hacer click extra)
y poder avisar al negocio por WhatsApp con un solo tap
para que el proceso de pago por transferencia sea lo más simple posible.

Como administrador,
quiero que los compradores me avisen por WhatsApp cuando realizan una transferencia
para poder confirmarla rápidamente sin depender de que el comprador sepa cómo contactarme.

## Acceptance Criteria

1. **Given** el gateway es `bank_transfer` y el pedido está en `pending`
   **When** el comprador entra al detalle del pedido
   **Then** los datos bancarios aparecen directamente (sin botón "Ver datos" intermedio)
   **And** el backend registra el pago pendiente automáticamente (idempotente)

2. **Given** los datos bancarios están visibles
   **Then** se muestran instrucciones claras con pasos numerados:
   - Paso 1: Copiá el CVU o alias
   - Paso 2: Realizá la transferencia desde tu homebanking
   - Paso 3: Avisanos por WhatsApp para confirmar

3. **Given** el branding tiene `whatsappNumber` configurado
   **When** el comprador hace click en "Avisar por WhatsApp"
   **Then** se abre WhatsApp (app o web) con el mensaje pre-llenado:
   `Hola! Realicé la transferencia para el Pedido #[id] por $[monto]. Adjunto comprobante.`
   usando `https://wa.me/[whatsappNumber]?text=...`

4. **Given** el admin configura el número de WhatsApp en `/admin/configuracion` tab "Pagos"
   **Then** se guarda con `PUT /config/branding` y se refleja en el botón del comprador

5. **Given** los mismos cambios aplican a `OrdersView.vue` (lista de pedidos)
   **Then** los datos bancarios también aparecen directamente sin botón previo

## Tasks / Subtasks

- [x] **`config.api.ts`** — agregar `whatsappNumber: string | null` a `BrandingConfig`

- [x] **`config.store.ts`** — agregar `whatsappNumber: null` en `DEFAULT_BRANDING`

- [x] **`admin.config.api.ts`** — ya acepta `Partial<BrandingConfig>`, no requiere cambios

- [x] **`AdminConfigView.vue`** — en la sección de transferencia bancaria (tab Pagos):
  - Agregar input "Número de WhatsApp" con hint `ej: 5491112345678 (sin + ni espacios)`
  - Incluir `whatsappNumber` en el objeto que se envía a `saveBankTransfer`

- [x] **`OrderDetailView.vue`** — reemplazar flujo existente:
  - Mostrar datos bancarios directamente (`onMounted` → `startBankTransfer`)
  - Reemplazar mensaje estático por instrucciones en 3 pasos
  - Agregar botón "Avisar por WhatsApp" que abre `wa.me` link si `branding.whatsappNumber` está configurado

- [x] **`OrdersView.vue`** — mismos cambios: botón WhatsApp + instrucciones en 3 pasos

## Dev Notes

### config.api.ts — BrandingConfig

```typescript
export interface BrandingConfig {
  // campos existentes...
  whatsappNumber: string | null
}
```

### OrderDetailView.vue — mostrar datos directo

En `onMounted`, luego de cargar el pedido, si el gateway es `bank_transfer` y el pedido está `pending`, llamar `startBankTransfer()` automáticamente. Como `initiateCheckout` es idempotente, no hay problema con llamarlo siempre.

```typescript
onMounted(async () => {
  const id = parseInt(String(route.params.orderId), 10)
  if (isNaN(id) || id <= 0) { router.replace('/pedidos'); return }
  await ordersStore.loadOrder(id)
  if (
    ordersStore.currentOrder?.status === 'pending' &&
    configStore.config.paymentGateway === 'bank_transfer'
  ) {
    await startBankTransfer()
  }
})
```

### Botón WhatsApp

```typescript
function openWhatsApp(orderId: number, amount: number) {
  const number = configStore.branding.whatsappNumber
  if (!number) return
  const text = encodeURIComponent(
    `Hola! Realicé la transferencia para el Pedido #${orderId} por $${amount.toLocaleString('es-AR')}. Adjunto el comprobante.`
  )
  window.open(`https://wa.me/${number}?text=${text}`, '_blank')
}
```

### Instrucciones — template

```vue
<ol class="text-sm text-gray-600 space-y-1 mt-3">
  <li><span class="font-semibold text-indigo-700">1.</span> Copiá el CVU o alias</li>
  <li><span class="font-semibold text-indigo-700">2.</span> Realizá la transferencia desde tu homebanking por el monto exacto</li>
  <li><span class="font-semibold text-indigo-700">3.</span> Avisanos por WhatsApp para que confirmemos tu pago</li>
</ol>
<button
  v-if="configStore.branding.whatsappNumber"
  @click="openWhatsApp(order.id, order.totalAmount)"
  class="mt-3 inline-flex items-center gap-2 rounded-xl bg-green-500 text-white px-4 py-2 text-sm font-semibold hover:opacity-90 transition-opacity"
>
  <!-- SVG WhatsApp icon -->
  Avisar por WhatsApp
</button>
```

### AdminConfigView.vue — campo WhatsApp

En la sección de datos bancarios (siempre visible bajo "Pagos"), agregar:

```vue
<div>
  <label class="block text-xs text-gray-500 mb-1">
    Número de WhatsApp <span class="text-gray-400">(para recibir avisos de transferencia)</span>
  </label>
  <input
    v-model="bankTransferForm.whatsappNumber"
    type="text"
    placeholder="ej: 5491112345678"
    class="..."
  />
  <p class="text-xs text-gray-400 mt-0.5">Sin + ni espacios. Incluí el código de país (54 para Argentina).</p>
</div>
```

### OrdersView.vue — datos directo

En `OrdersView`, el auto-fetch no es tan directo porque hay múltiples pedidos. Mantener el botón "Ver datos" pero mostrarlo más prominente y auto-ejecutarlo para el primer pedido pendiente, o simplemente dejar que el usuario clickee (es aceptable en la lista). El cambio prioritario es en `OrderDetailView`.

### Depende de
- Story 15-2 (BFF) — whatsapp_number en branding

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Completion Notes
`whatsappNumber` agregado a `BrandingConfig`, `DEFAULT_BRANDING` y `AdminConfigView` (tab Pagos, sección bancaria). `OrderDetailView` ahora carga datos bancarios automáticamente en `onMounted` y muestra instrucciones en 3 pasos + botón WhatsApp verde con ícono SVG. `OrdersView` también recibió botón WhatsApp + instrucciones. TypeScript compila sin errores.

### File List
- jedami-web/src/api/config.api.ts
- jedami-web/src/stores/config.store.ts
- jedami-web/src/views/admin/AdminConfigView.vue
- jedami-web/src/views/OrderDetailView.vue
- jedami-web/src/views/OrdersView.vue
