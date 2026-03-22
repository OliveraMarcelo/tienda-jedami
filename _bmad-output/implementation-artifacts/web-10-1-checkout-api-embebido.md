# Story W10.1: Gateway de Pago Configurable — Web

Status: done

## Story

Como comprador,
quiero pagar con el formulario embebido de Mercado Pago cuando el administrador lo habilite,
para no salir de la tienda durante el proceso de pago.

## Acceptance Criteria

1. **Given** el admin tiene habilitado `checkout_pro`
   **When** el comprador hace click en "Pagar"
   **Then** el comportamiento es el existente: redirige a MP (checkout_url)

2. **Given** el admin tiene habilitado `checkout_api`
   **When** el comprador hace click en "Pagar con tarjeta"
   **Then** se renderiza el CardPaymentBrick de MP embebido en la página (sin redirigir)
   **And** el botón de pago nativo de MP queda dentro del Brick

3. **Given** el CardPaymentBrick está visible y el comprador ingresa datos válidos y confirma
   **When** MP SDK tokeniza la tarjeta
   **Then** el frontend llama `POST /payments/:orderId/process` con el formData del Brick
   **And** si `status === "approved"` → muestra mensaje de éxito y redirige a `/pedidos/:id`
   **And** si `status === "rejected"` → muestra el `statusDetail` en español
   **And** si `status === "pending"` → muestra "Pago en revisión, te avisaremos por email"

4. **Given** el admin está en el panel de configuración
   **When** navega a la sección de pagos
   **Then** ve un selector con opciones "Checkout Pro (redirección)" y "Checkout API (embebido)"
   **And** al cambiar y guardar se llama `PATCH /admin/config/payment-gateway`

5. **Given** el config store ya cargó
   **Then** `configStore.config.paymentGateway` contiene `'checkout_pro'` o `'checkout_api'`

## Tasks / Subtasks

- [ ] Actualizar `config.store.ts` para exponer `paymentGateway` desde la respuesta del BFF (AC: 5)
- [ ] Actualizar `OrdersView.vue`: leer `configStore.config.paymentGateway` para elegir flujo de pago (AC: 1, 2, 3):
  - `checkout_pro`: comportamiento actual — `paymentsStore.startCheckout(orderId)` → redirect
  - `checkout_api`: botón "Pagar con tarjeta" que abre el CardPaymentBrick inline
- [ ] Crear composable `useCheckoutApi(orderId, amount, publicKey)` o implementar inline en OrdersView:
  - Carga MP SDK dinámicamente (script tag)
  - Inicializa `new MercadoPago(publicKey, { locale: 'es-AR' })`
  - Crea CardPaymentBrick en un div contenedor
  - `onSubmit` del Brick → llama `processPayment(orderId, formData)` de la API
  - Maneja los 3 estados de respuesta (AC: 3)
- [ ] Agregar `processPayment(orderId, dto)` en `payments.api.ts` → `POST /payments/:orderId/process` (AC: 3)
- [ ] Actualizar `AdminConfigView.vue`: agregar sección "Gateway de pago" con selector y botón guardar (AC: 4)
- [ ] Agregar `updatePaymentGateway(gateway)` en `admin.config.api.ts` → `PATCH /admin/config/payment-gateway` (AC: 4)

## Dev Notes

### config.store.ts — campo nuevo
```typescript
// En la interfaz del config y en el mapeo de la respuesta:
paymentGateway: data.paymentGateway ?? 'checkout_pro'
```

### Carga dinámica del MP SDK
```typescript
function loadMpSdk(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).MercadoPago) { resolve(); return; }
    const script = document.createElement('script')
    script.src = 'https://sdk.mercadopago.com/js/v2'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('No se pudo cargar el SDK de MP'))
    document.head.appendChild(script)
  })
}
```

### Inicialización del CardPaymentBrick
```typescript
await loadMpSdk()
const mp = new (window as any).MercadoPago(publicKey, { locale: 'es-AR' })
const bricksBuilder = mp.bricks()
await bricksBuilder.create('cardPayment', 'mp-card-payment-brick', {
  initialization: { amount },
  callbacks: {
    onReady: () => { /* brick listo */ },
    onSubmit: async (formData: any) => {
      const result = await processPayment(orderId, formData)
      if (result.status === 'approved') {
        router.push(`/pedidos/${orderId}`)
      } else if (result.status === 'rejected') {
        brickError.value = statusDetailEs[result.statusDetail] ?? 'Pago rechazado'
      } else {
        brickError.value = 'Pago en revisión, te avisaremos por email'
      }
    },
    onError: (error: any) => { brickError.value = error.message },
  },
})
```

### Mensajes de rechazo en español (statusDetail más comunes)
```typescript
const statusDetailEs: Record<string, string> = {
  cc_rejected_insufficient_amount: 'Fondos insuficientes',
  cc_rejected_bad_filled_security_code: 'Código de seguridad incorrecto',
  cc_rejected_bad_filled_date: 'Fecha de vencimiento incorrecta',
  cc_rejected_bad_filled_other: 'Datos de tarjeta incorrectos',
  cc_rejected_call_for_authorize: 'Llamá a tu banco para autorizar el pago',
  cc_rejected_card_disabled: 'Tarjeta deshabilitada',
  cc_rejected_duplicated_payment: 'Pago duplicado',
  cc_rejected_high_risk: 'Pago rechazado por riesgo',
}
```

### processPayment en payments.api.ts
```typescript
export async function processPayment(
  orderId: number,
  dto: Record<string, unknown>,
): Promise<{ status: string; statusDetail?: string }> {
  const res = await apiClient.post(`/payments/${orderId}/process`, dto)
  return res.data
}
```

### AdminConfigView — sección pagos
```vue
<!-- Selector gateway -->
<div class="flex flex-col gap-2">
  <label class="text-sm font-semibold text-gray-700">Gateway de pago</label>
  <select v-model="paymentGateway" class="...">
    <option value="checkout_pro">Checkout Pro (redirige a Mercado Pago)</option>
    <option value="checkout_api">Checkout API (formulario embebido)</option>
  </select>
  <p class="text-xs text-gray-400">Checkout API requiere aprobación de MP en tu cuenta.</p>
  <button @click="savePaymentGateway" ...>Guardar</button>
</div>
```

### Importante — actualizar consumers de checkoutUrl
La respuesta de `POST /payments/:orderId/checkout` cambia de `{ checkoutUrl }` a `{ type, checkoutUrl?, preferenceId?, publicKey? }`.

Archivos a actualizar que actualmente leen `checkoutUrl`:
- `jedami-web/src/stores/payments.store.ts` → `startCheckout()`
- `jedami-web/src/views/admin/AdminPaymentsView.vue` → botón de checkout admin

Cuando `type === 'redirect'` → `window.location.href = data.checkoutUrl`
Cuando `type === 'preference'` → no redirigir, guardar `preferenceId` y `publicKey` para el Brick

### Depende de
Story 10-1 (BFF) debe estar done.

### Referencias
- [Source: jedami-web/src/views/OrdersView.vue]
- [Source: jedami-web/src/stores/config.store.ts]
- [Source: jedami-web/src/views/admin/AdminConfigView.vue]
- [Source: jedami-web/src/api/payments.api.ts]
- [MP Bricks Docs: https://www.mercadopago.com.ar/developers/es/docs/checkout-bricks/card-payment-brick/introduction]

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Debug Log References
N/A — sin errores TypeScript ni regresiones

### Completion Notes List
- `AppConfig` interface ampliada con `paymentGateway?: string`; default `'checkout_pro'` en config store
- `CheckoutResult` discriminated union: `{ type: 'redirect', checkoutUrl }` | `{ type: 'preference', preferenceId, publicKey }`
- `processPayment(orderId, dto)` agregado en `payments.api.ts` → `POST /payments/:orderId/process`
- `payments.store.ts.startCheckout` actualizado para manejar `type === 'redirect'` sin asumir `checkoutUrl`
- `OrdersView.vue` gateway-aware: checkout_pro mantiene flujo actual; checkout_api muestra botón "Pagar con tarjeta" que abre CardPaymentBrick inline
- Brick carga MP SDK dinámicamente, inicializa con publicKey del BFF, maneja 3 estados (approved/rejected/pending)
- `updatePaymentGateway(gateway)` agregado en `admin.config.api.ts` → `PATCH /admin/config/payment-gateway`
- `AdminConfigView.vue` tab "Pagos" con selector de gateway y botón guardar

### File List
- jedami-web/src/api/config.api.ts
- jedami-web/src/stores/config.store.ts
- jedami-web/src/api/payments.api.ts
- jedami-web/src/stores/payments.store.ts
- jedami-web/src/views/OrdersView.vue
- jedami-web/src/api/admin.config.api.ts
- jedami-web/src/views/admin/AdminConfigView.vue
