# Story web-15.1: Transferencia Bancaria — WEB

Status: review

## Story

Como administrador,
quiero configurar los datos bancarios desde el panel admin
para que los compradores reciban la info correcta al elegir pagar por transferencia.

Como comprador,
quiero ver los datos bancarios claramente con botones para copiar el CVU/alias
para poder hacer la transferencia desde mi homebanking sin errores.

Como administrador,
quiero confirmar manualmente una transferencia recibida
para que el pedido pase a estado "Pagado" y se descuente el stock.

## Acceptance Criteria

1. **Given** el admin está en `/admin/configuracion` tab "Pagos"
   **When** selecciona gateway "Transferencia bancaria"
   **Then** aparece un formulario con campos: CVU (22 dígitos), Alias, Nombre del titular, Banco, Notas adicionales
   **And** puede guardar los datos

2. **Given** el admin guarda los datos de transferencia
   **Then** se llama `PUT /config/branding` con los campos correspondientes
   **And** se muestra confirmación de éxito

3. **Given** el comprador tiene un pedido en estado `pending` y el gateway es `bank_transfer`
   **When** hace click en el botón de pago
   **Then** se llama `POST /payments/:orderId/checkout`
   **And** se muestran los datos bancarios: CVU (con botón copiar), alias (con botón copiar), titular, banco, monto a transferir, notas
   **And** hay un mensaje "Una vez realizada la transferencia, el administrador confirmará tu pago."

4. **Given** el comprador ve los datos de transferencia
   **When** hace click en "Copiar CVU" o "Copiar alias"
   **Then** el valor se copia al portapapeles y el botón muestra "✓ Copiado" por 2 segundos

5. **Given** el admin está en `/admin/pagos`
   **When** hay un pago con `paymentMethod = 'bank_transfer'` y status `pending`
   **Then** la fila muestra el badge "Transferencia" y un botón "Confirmar"
   **When** hace click en "Confirmar"
   **Then** se llama `POST /admin/orders/:orderId/confirm-transfer`
   **And** el estado del pago se actualiza a "Aprobado" sin recargar la página

6. **Given** el gateway activo es `bank_transfer`
   **Then** en `OrdersView` no se muestra el botón de Mercado Pago ni el Brick de tarjeta
   **And** se muestra directamente el bloque con datos bancarios (si ya se inició el pago) o el botón "Ver datos de transferencia"

## Tasks / Subtasks

- [ ] **admin.config.api.ts** — extender `updateBranding` y `BrandingConfig` interface con campos bank_transfer

- [ ] **config.store.ts** — extender `BrandingConfig` con los nuevos campos

- [ ] **AdminConfigView.vue** — tab "Pagos":
  - Selector ahora tiene 3 opciones: Checkout Pro / Checkout API / Transferencia bancaria
  - Cuando `payment_gateway === 'bank_transfer'`: mostrar formulario de datos bancarios
  - Guardar con `PUT /config/branding`

- [ ] **payments.api.ts** — `initiateCheckout` ahora puede retornar `{ method: 'bank_transfer', bankDetails: {...} }`; actualizar tipo de retorno

- [ ] **OrdersView.vue** — manejar gateway `bank_transfer`:
  - Si pago ya iniciado (bankDetails disponibles): mostrar bloque con datos + copy buttons
  - Si pago no iniciado: botón "Ver datos de transferencia" → llama checkout → muestra bloque
  - No renderizar lógica de MP cuando gateway = bank_transfer

- [ ] **admin.payments.api.ts** — agregar `confirmBankTransfer(orderId: number): Promise<void>`

- [ ] **AdminPaymentsView.vue**:
  - Columna "Método" con badge: "Mercado Pago" (azul) / "Transferencia" (indigo)
  - Botón "Confirmar" en filas con `paymentMethod = 'bank_transfer'` y status `pending`
  - Al confirmar: actualizar fila sin reload completo

## Dev Notes

### BrandingConfig — nuevos campos

```typescript
// En config.store.ts y admin.config.api.ts
interface BrandingConfig {
  // campos existentes...
  bankTransferCvu: string | null
  bankTransferAlias: string | null
  bankTransferHolderName: string | null
  bankTransferBankName: string | null
  bankTransferNotes: string | null
}
```

### AdminConfigView.vue — tab Pagos

El selector de gateway actualmente tiene 2 opciones. Agregar la tercera:
```vue
<option value="checkout_pro">Checkout Pro (redirección a Mercado Pago)</option>
<option value="checkout_api">Checkout API (tarjeta embebida)</option>
<option value="bank_transfer">Transferencia bancaria</option>
```

Cuando `gateway === 'bank_transfer'`, mostrar debajo del select:
```vue
<div v-if="gateway === 'bank_transfer'" class="mt-4 space-y-3 border-t pt-4">
  <h3 class="font-semibold text-gray-700 text-sm">Datos bancarios</h3>
  <!-- CVU: input text, maxlength=22, hint: "22 dígitos numéricos" -->
  <!-- Alias: input text, maxlength=50 -->
  <!-- Nombre del titular: input text -->
  <!-- Banco: input text -->
  <!-- Notas adicionales: textarea (ej: "Indicar número de pedido en el concepto") -->
  <button @click="saveBankTransfer">Guardar datos bancarios</button>
</div>
```

`saveBankTransfer` llama `updateBranding({ bankTransferCvu, bankTransferAlias, ... })`.

### payments.api.ts — tipo de retorno de initiateCheckout

```typescript
export type CheckoutResult =
  | { method: 'checkout_pro'; checkoutUrl: string }
  | { method: 'checkout_api'; publicKey: string }
  | { method: 'bank_transfer'; bankDetails: BankDetails }

export interface BankDetails {
  cvu: string | null
  alias: string | null
  holderName: string | null
  bankName: string | null
  notes: string | null
  amount: string
}

export async function initiateCheckout(orderId: number): Promise<CheckoutResult> {
  const res = await apiClient.post<{ data: CheckoutResult }>(`/payments/${orderId}/checkout`)
  return res.data.data
}
```

### OrdersView.vue — flujo bank_transfer

En OrdersView el gateway actual viene de `configStore.paymentGateway`. Dentro del bloque de "Pagar" de cada pedido pendiente:

```vue
<!-- Gateway: bank_transfer -->
<template v-else-if="configStore.paymentGateway === 'bank_transfer'">
  <!-- Si ya tenemos bankDetails para este pedido -->
  <div v-if="bankDetailsMap[order.id]" class="mt-3 rounded-xl border border-indigo-200 bg-indigo-50 p-4 space-y-2">
    <p class="text-sm font-semibold text-indigo-800">Datos para la transferencia</p>
    <div class="flex items-center justify-between text-sm">
      <span class="text-gray-600">CVU</span>
      <div class="flex items-center gap-2">
        <span class="font-mono font-semibold">{{ bankDetailsMap[order.id].cvu }}</span>
        <button @click="copyToClipboard(bankDetailsMap[order.id].cvu, 'cvu-' + order.id)">
          {{ copied['cvu-' + order.id] ? '✓ Copiado' : 'Copiar' }}
        </button>
      </div>
    </div>
    <!-- Alias, Titular, Banco, Monto, Notas — mismo patrón -->
    <p class="text-xs text-gray-500 mt-2">
      Una vez realizada la transferencia, el administrador confirmará tu pago.
    </p>
  </div>

  <!-- Si aún no iniciamos el pago -->
  <button v-else @click="startBankTransfer(order.id)" :disabled="loadingPayment[order.id]">
    Ver datos de transferencia
  </button>
</template>
```

`startBankTransfer(orderId)`:
```typescript
async function startBankTransfer(orderId: number) {
  loadingPayment[orderId] = true
  try {
    const result = await initiateCheckout(orderId)
    if (result.method === 'bank_transfer') {
      bankDetailsMap[orderId] = result.bankDetails
    }
  } finally {
    loadingPayment[orderId] = false
  }
}
```

`copyToClipboard`:
```typescript
const copied = ref<Record<string, boolean>>({})
async function copyToClipboard(text: string | null, key: string) {
  if (!text) return
  await navigator.clipboard.writeText(text)
  copied.value[key] = true
  setTimeout(() => { copied.value[key] = false }, 2000)
}
```

### AdminPaymentsView.vue — confirmar transferencia

```typescript
// En admin.payments.api.ts
export async function confirmBankTransfer(orderId: number): Promise<void> {
  await apiClient.post(`/admin/orders/${orderId}/confirm-transfer`)
}
```

En la tabla de pagos, agregar columna "Método":
```vue
<td>
  <span v-if="payment.paymentMethod === 'bank_transfer'"
    class="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800">
    Transferencia
  </span>
  <span v-else class="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
    Mercado Pago
  </span>
</td>
<td>
  <button
    v-if="payment.paymentMethod === 'bank_transfer' && payment.paymentStatus === 'pending'"
    @click="confirmTransfer(payment)"
  >
    Confirmar
  </button>
</td>
```

`confirmTransfer`:
```typescript
async function confirmTransfer(payment) {
  await confirmBankTransfer(payment.orderId)
  payment.paymentStatus = 'approved'  // actualizar local sin reload
}
```

### Depende de
- Story 15-1 (BFF) — done

## Dev Agent Record

### Agent Model Used
_pendiente_

### Completion Notes
_pendiente_

### File List
_pendiente_
