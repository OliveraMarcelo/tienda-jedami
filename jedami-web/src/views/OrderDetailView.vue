<script setup lang="ts">
import { onMounted, computed, ref, nextTick } from 'vue'
import { PURCHASE_TYPES } from '@/lib/constants'
import { useRoute, useRouter } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'
import { useOrdersStore } from '@/stores/orders.store'
import { usePaymentsStore } from '@/stores/payments.store'
import { useConfigStore } from '@/stores/config.store'
import { initiateCheckout, processPayment, type BankDetails } from '@/api/payments.api'
import type { OrderStatus } from '@/api/orders.api'

const route = useRoute()
const router = useRouter()
const ordersStore = useOrdersStore()
const paymentsStore = usePaymentsStore()
const configStore = useConfigStore()

onMounted(async () => {
  const id = parseInt(String(route.params.orderId), 10)
  if (isNaN(id) || id <= 0) {
    router.replace('/pedidos')
    return
  }
  await ordersStore.loadOrder(id)
  if (
    ordersStore.currentOrder?.status === 'pending' &&
    configStore.config.paymentGateway === 'bank_transfer'
  ) {
    await startBankTransfer()
  }
})

const order = computed(() => ordersStore.currentOrder)

const statusConfig: Record<OrderStatus, { label: string; classes: string }> = {
  pending:   { label: 'Pendiente de pago', classes: 'bg-amber-50 text-amber-700 border-amber-200' },
  paid:      { label: 'Pagado',            classes: 'bg-green-50 text-green-700 border-green-200' },
  rejected:  { label: 'Rechazado',         classes: 'bg-red-50 text-red-700 border-red-200' },
  cancelled: { label: 'Cancelado',         classes: 'bg-gray-50 text-gray-500 border-gray-200' },
}

// ─── Bank Transfer ────────────────────────────────────────────────────────────
const bankDetails = ref<BankDetails | null>(null)
const bankTransferLoading = ref(false)
const copied = ref<Record<string, boolean>>({})

async function startBankTransfer() {
  if (!order.value) return
  bankTransferLoading.value = true
  try {
    const result = await initiateCheckout(order.value.id)
    if (result.type === 'bank_transfer') {
      bankDetails.value = result.bankDetails
    }
  } catch { /* el usuario puede reintentar */ } finally {
    bankTransferLoading.value = false
  }
}

async function copyToClipboard(text: string | null, key: string) {
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    copied.value[key] = true
    setTimeout(() => { copied.value[key] = false }, 2000)
  } catch { /* sin soporte */ }
}

function openWhatsApp() {
  const number = configStore.branding.whatsappNumber
  if (!number || !order.value) return
  const amount = order.value.totalAmount.toLocaleString('es-AR')
  const text = encodeURIComponent(
    `Hola! Realicé la transferencia para el Pedido #${order.value.id} por $${amount}. Adjunto el comprobante.`
  )
  window.open(`https://wa.me/${number}?text=${text}`, '_blank')
}

// ─── Checkout API (CardPaymentBrick) ─────────────────────────────────────────
const brickVisible = ref(false)
const brickLoading = ref(false)
const brickError = ref('')
const brickProcessing = ref(false)

const statusDetailEs: Record<string, string> = {
  cc_rejected_insufficient_amount:      'Fondos insuficientes',
  cc_rejected_bad_filled_security_code: 'Código de seguridad incorrecto',
  cc_rejected_bad_filled_date:          'Fecha de vencimiento incorrecta',
  cc_rejected_bad_filled_other:         'Datos de tarjeta incorrectos',
  cc_rejected_call_for_authorize:       'Llamá a tu banco para autorizar el pago',
  cc_rejected_card_disabled:            'Tarjeta deshabilitada',
  cc_rejected_duplicated_payment:       'Pago duplicado',
  cc_rejected_high_risk:                'Pago rechazado por riesgo',
}

function loadMpSdk(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).MercadoPago) { resolve(); return }
    const script = document.createElement('script')
    script.src = 'https://sdk.mercadopago.com/js/v2'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('No se pudo cargar el SDK de MP'))
    document.head.appendChild(script)
  })
}

async function openCardBrick() {
  if (!order.value) return
  brickLoading.value = true
  brickError.value = ''
  try {
    const result = await initiateCheckout(order.value.id)
    if (result.type !== 'preference') return
    const { publicKey } = result
    brickVisible.value = true
    await nextTick()
    await loadMpSdk()
    const mp = new (window as any).MercadoPago(publicKey, { locale: 'es-AR' })
    const bricksBuilder = mp.bricks()
    await bricksBuilder.create('cardPayment', 'mp-brick-detail', {
      initialization: { amount: order.value.totalAmount },
      customization: {
        paymentMethods: { types: { excluded: ['credit_card'] }, maxInstallments: 1 },
      },
      callbacks: {
        onReady: () => {},
        onSubmit: async (formData: any) => {
          brickProcessing.value = true
          brickError.value = ''
          try {
            const res = await processPayment(order.value!.id, formData)
            if (res.status === 'approved') {
              brickVisible.value = false
              await nextTick()
              ordersStore.loadOrder(order.value!.id)
            } else if (res.status === 'rejected') {
              brickError.value = statusDetailEs[res.statusDetail ?? ''] ?? 'Pago rechazado'
            } else {
              brickError.value = 'Pago en revisión, te avisaremos por email'
            }
          } catch (e: any) {
            brickError.value = e?.response?.data?.detail ?? 'Error al procesar el pago'
          } finally {
            brickProcessing.value = false
          }
        },
        onError: (error: any) => { brickError.value = error.message },
      },
    })
  } catch {
    brickError.value = 'Error al preparar el pago'
    brickVisible.value = false
  } finally {
    brickLoading.value = false
  }
}
</script>

<template>
  <AppLayout>
    <div class="max-w-2xl mx-auto">
      <!-- Loading -->
      <div v-if="ordersStore.loading" class="animate-pulse space-y-4">
        <div class="h-8 bg-gray-200 rounded w-48"></div>
        <div class="bg-white rounded-2xl border border-gray-200 p-6 h-40"></div>
      </div>

      <!-- Error -->
      <div v-else-if="ordersStore.error" class="text-red-500 text-sm">{{ ordersStore.error }}</div>

      <div v-else-if="order">
        <!-- Header del pedido -->
        <div class="flex items-center gap-3 mb-6">
          <button @click="router.push('/pedidos')" class="text-sm text-gray-500 hover:text-[#E91E8C]">
            ← Mis pedidos
          </button>
        </div>

        <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-4">
          <div class="flex items-start justify-between gap-4">
            <div>
              <h1 class="text-xl font-bold text-gray-900 mb-1">Pedido #{{ order.id }}</h1>
              <p class="text-sm text-gray-500">
                {{ configStore.purchaseTypeLabel[order.purchaseType] ?? order.purchaseType }} ·
                {{ new Date(order.createdAt).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' }) }}
              </p>
            </div>
            <span
              class="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold border shrink-0"
              :class="statusConfig[order.status].classes"
            >
              {{ statusConfig[order.status].label }}
            </span>
          </div>
        </div>

        <!-- Nota del comprador -->
        <div v-if="order.notes" class="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3 mb-4">
          <p class="text-xs font-semibold text-amber-700 mb-0.5">Nota para el administrador</p>
          <p class="text-sm text-amber-800 italic">"{{ order.notes }}"</p>
        </div>

        <!-- Items del pedido -->
        <div class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-4">
          <div class="px-5 py-3 bg-gray-50 border-b border-gray-100">
            <p class="text-sm font-semibold text-gray-600">Artículos</p>
          </div>
          <div v-if="!order.items?.length" class="px-5 py-6 text-sm text-gray-400 text-center">
            Sin artículos en este pedido.
          </div>
          <table v-else class="w-full text-sm">
            <thead>
              <tr class="text-gray-500 text-xs border-b border-gray-100">
                <th class="px-5 py-2 text-left font-medium">Variante</th>
                <th class="px-5 py-2 text-right font-medium">Cant.</th>
                <th class="px-5 py-2 text-right font-medium">Precio unit.</th>
                <th class="px-5 py-2 text-right font-medium">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="item in order.items"
                :key="item.id"
                class="border-t border-gray-50"
              >
                <td class="px-5 py-3 text-gray-800 font-medium">
                  <template v-if="order.purchaseType === PURCHASE_TYPES.CURVA">
                    <span v-if="item.size">Talle {{ item.size }}</span>
                    <span v-else class="text-gray-500 italic">—</span>
                  </template>
                  <template v-else>
                    <span v-if="item.size && item.color">{{ item.size }} — {{ item.color }}</span>
                    <span v-else class="text-gray-500 italic">Distribución proporcional</span>
                  </template>
                </td>
                <td class="px-5 py-3 text-right text-gray-700">{{ item.quantity }}</td>
                <td class="px-5 py-3 text-right text-gray-700">${{ Number(item.unitPrice).toLocaleString('es-AR') }}</td>
                <td class="px-5 py-3 text-right font-semibold text-gray-900">
                  ${{ (item.quantity * Number(item.unitPrice)).toLocaleString('es-AR') }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Total y CTA -->
        <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex items-center justify-between gap-4">
          <div>
            <p class="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-0.5">Total del pedido</p>
            <p class="text-2xl font-bold text-gray-900">${{ order.totalAmount?.toLocaleString('es-AR') ?? '—' }}</p>
          </div>

          <template v-if="order.status === 'pending' && order.totalAmount > 0">
            <!-- Transferencia bancaria: cargando datos -->
            <template v-if="configStore.config.paymentGateway === 'bank_transfer'">
              <div v-if="bankTransferLoading" class="flex items-center gap-2 text-sm text-indigo-600">
                <svg class="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                Cargando datos bancarios…
              </div>
            </template>
            <!-- Checkout Pro -->
            <template v-else-if="configStore.config.paymentGateway !== 'checkout_api'">
              <button
                :disabled="paymentsStore.loading"
                @click="paymentsStore.startCheckout(order.id)"
                class="inline-flex items-center gap-2 rounded-xl bg-[#009EE3] text-white px-5 py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity shadow disabled:opacity-50 disabled:pointer-events-none"
              >
                <svg v-if="paymentsStore.loading" class="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                <span>{{ paymentsStore.loading ? 'Redirigiendo…' : 'Pagar con Mercado Pago' }}</span>
              </button>
            </template>
            <!-- Checkout API -->
            <template v-else>
              <button
                v-if="!brickVisible"
                :disabled="brickLoading"
                @click="openCardBrick"
                class="inline-flex items-center gap-2 rounded-xl bg-[#009EE3] text-white px-5 py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity shadow disabled:opacity-50 disabled:pointer-events-none"
              >
                <svg v-if="brickLoading" class="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                <span>{{ brickLoading ? 'Preparando…' : 'Pagar con tarjeta' }}</span>
              </button>
            </template>
          </template>
        </div>

        <!-- Datos de transferencia bancaria -->
        <div v-if="bankDetails" class="rounded-xl border border-indigo-200 bg-indigo-50 p-4 space-y-2 mt-4">
          <p class="text-sm font-semibold text-indigo-800 mb-3">Datos para la transferencia</p>
          <div v-if="bankDetails.cvu" class="flex items-center justify-between text-sm">
            <span class="text-gray-600 shrink-0 mr-2">CVU</span>
            <div class="flex items-center gap-2 min-w-0">
              <span class="font-mono font-semibold text-gray-800 truncate">{{ bankDetails.cvu }}</span>
              <button @click="copyToClipboard(bankDetails!.cvu, 'cvu')" class="shrink-0 text-xs font-semibold text-indigo-600 hover:text-indigo-800">
                {{ copied['cvu'] ? '✓ Copiado' : 'Copiar' }}
              </button>
            </div>
          </div>
          <div v-if="bankDetails.alias" class="flex items-center justify-between text-sm">
            <span class="text-gray-600 shrink-0 mr-2">Alias</span>
            <div class="flex items-center gap-2">
              <span class="font-mono font-semibold text-gray-800">{{ bankDetails.alias }}</span>
              <button @click="copyToClipboard(bankDetails!.alias, 'alias')" class="shrink-0 text-xs font-semibold text-indigo-600 hover:text-indigo-800">
                {{ copied['alias'] ? '✓ Copiado' : 'Copiar' }}
              </button>
            </div>
          </div>
          <div v-if="bankDetails.holderName" class="flex items-center justify-between text-sm">
            <span class="text-gray-600">Titular</span>
            <span class="font-semibold text-gray-800">{{ bankDetails.holderName }}</span>
          </div>
          <div v-if="bankDetails.bankName" class="flex items-center justify-between text-sm">
            <span class="text-gray-600">Banco</span>
            <span class="font-semibold text-gray-800">{{ bankDetails.bankName }}</span>
          </div>
          <div class="flex items-center justify-between text-sm">
            <span class="text-gray-600">Monto a transferir</span>
            <span class="font-bold text-gray-900">${{ Number(bankDetails.amount).toLocaleString('es-AR') }}</span>
          </div>
          <p v-if="bankDetails.notes" class="text-xs text-indigo-700 bg-indigo-100 rounded-lg px-3 py-2 mt-1">{{ bankDetails.notes }}</p>

          <!-- Instrucciones en 3 pasos -->
          <ol class="text-sm text-gray-600 space-y-1 pt-2 border-t border-indigo-200">
            <li><span class="font-semibold text-indigo-700">1.</span> Copiá el CVU o alias</li>
            <li><span class="font-semibold text-indigo-700">2.</span> Realizá la transferencia desde tu homebanking por el monto exacto</li>
            <li><span class="font-semibold text-indigo-700">3.</span> Avisanos por WhatsApp para que confirmemos tu pago</li>
          </ol>

          <!-- Botón WhatsApp -->
          <button
            v-if="configStore.branding.whatsappNumber"
            @click="openWhatsApp"
            class="mt-1 inline-flex items-center gap-2 rounded-xl bg-green-500 text-white px-4 py-2 text-sm font-semibold hover:opacity-90 transition-opacity w-full justify-center"
          >
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Avisar por WhatsApp
          </button>
        </div>

        <!-- CardPaymentBrick (checkout_api) -->
        <div v-if="brickVisible" class="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 mt-4">
          <div id="mp-brick-detail"></div>
          <p v-if="brickError" class="text-xs text-red-500 mt-2">{{ brickError }}</p>
          <button
            @click="brickVisible = false; brickError = ''"
            class="text-xs text-gray-400 hover:text-gray-600 mt-2"
          >Cancelar</button>
        </div>

        <!-- Error de pago (checkout pro) -->
        <p v-if="paymentsStore.error" class="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mt-4">
          {{ paymentsStore.error }}
        </p>
      </div>
    </div>
  </AppLayout>
</template>
