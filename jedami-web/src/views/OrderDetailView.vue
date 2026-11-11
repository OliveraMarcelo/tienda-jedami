<script setup lang="ts">
import { onMounted, computed, ref, watch, nextTick } from 'vue'
import { PURCHASE_TYPES } from '@/lib/constants'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'
import { useOrdersStore } from '@/stores/orders.store'
import { usePaymentsStore } from '@/stores/payments.store'
import { useConfigStore } from '@/stores/config.store'
import { processPayment } from '@/api/payments.api'
import PaymentMethodSelector from '@/components/features/checkout/PaymentMethodSelector.vue'
import MercadoPagoQrPanel from '@/components/features/checkout/MercadoPagoQrPanel.vue'
import WhatsAppShippingModal from '@/components/features/checkout/WhatsAppShippingModal.vue'
import { ORDER_STATUS } from '@/lib/order-status'

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
  paymentsStore.resetCheckoutState()
  await ordersStore.loadOrder(id)
  // Mostrar los medios de pago directamente, sin tener que tocar "Pagar"
  if (canPay.value) await paymentsStore.loadPaymentOptions(id)
})

const order = computed(() => ordersStore.currentOrder)
const bankDetails = computed(() => paymentsStore.bankDetails)
// Se puede pagar si está pendiente o si un intento anterior fue rechazado
const canPay = computed(() => !!order.value && ['pending', 'rejected'].includes(order.value.status) && order.value.totalAmount > 0)
const justPaid = ref(false)

async function onQrPaid() {
  if (!order.value) return
  paymentsStore.resetCheckoutState()
  justPaid.value = true
  await ordersStore.loadOrder(order.value.id)
}


// ─── Smart Checkout ────────────────────────────────────────────────────────────
async function startPayment() {
  if (!order.value) return
  await paymentsStore.loadPaymentOptions(order.value.id)
}

const showCombined = computed(() => canPay.value && (!!paymentsStore.checkoutUrl || !!bankDetails.value))
const bothMethods = computed(() => !!paymentsStore.checkoutUrl && !!bankDetails.value)
// Otros medios activos (p. ej. tarjeta embebida) que no entran en la vista combinada
const otherGateways = computed(() => showCombined.value ? paymentsStore.availableGateways : [])

async function onGatewaySelected(gateway: string) {
  if (!order.value) return
  await paymentsStore.selectGateway(order.value.id, gateway)
}

async function copyToClipboard(text: string | null, key: string) {
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    copied.value[key] = true
    setTimeout(() => { copied.value[key] = false }, 2000)
  } catch { /* sin soporte */ }
}

const copied = ref<Record<string, boolean>>({})

const shippingModalOpen = ref(false)

function openWhatsApp() {
  if (!configStore.branding.whatsappNumber || !order.value) return
  shippingModalOpen.value = true
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

async function mountBrick(publicKey: string) {
  brickLoading.value = true
  brickError.value = ''
  try {
    brickVisible.value = true
    await nextTick()
    await loadMpSdk()
    const mp = new (window as any).MercadoPago(publicKey, { locale: 'es-AR' })
    const bricksBuilder = mp.bricks()
    await bricksBuilder.create('cardPayment', 'mp-brick-detail', {
      initialization: { amount: order.value!.totalAmount },
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

// Montar brick cuando el store recibe la publicKey
watch(() => paymentsStore.checkoutPublicKey, async (newKey) => {
  if (newKey) await mountBrick(newKey)
})
</script>

<template>
  <AppLayout>
    <div class="max-w-4xl mx-auto">
      <!-- Loading -->
      <div v-if="ordersStore.loading" class="flex animate-pulse flex-col gap-4">
        <div class="h-9 w-56 rounded-full bg-[var(--t-surface)]"></div>
        <div class="h-48 rounded-[var(--t-radius-card)] bg-[var(--t-surface)]"></div>
      </div>

      <!-- Error -->
      <p v-else-if="ordersStore.error" role="alert" class="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{{ ordersStore.error }}</p>

      <div v-else-if="order">
        <RouterLink to="/pedidos" class="mb-5 inline-flex items-center gap-1.5 text-sm text-[var(--t-muted)] hover:text-[var(--t-ink)]">
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
          Mis pedidos
        </RouterLink>

        <!-- Encabezado -->
        <div class="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 class="text-[28px] font-bold leading-tight sm:text-[32px]">Pedido #{{ order.id }}</h1>
            <p class="mt-1 text-[var(--t-muted)]">
              {{ configStore.purchaseTypeLabel[order.purchaseType] ?? order.purchaseType }} ·
              {{ new Date(order.createdAt).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' }) }}
            </p>
          </div>
          <span :class="['shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold', ORDER_STATUS[order.status].classes]">
            {{ ORDER_STATUS[order.status].label }}
          </span>
        </div>

        <!-- Nota del comprador -->
        <div v-if="order.notes" class="mb-4 rounded-2xl bg-[#FDF3D7] px-5 py-3">
          <p class="text-xs font-semibold text-[#8A5A00]">Tu nota para la tienda</p>
          <p class="text-sm italic">"{{ order.notes }}"</p>
        </div>

        <!-- Artículos y total -->
        <section class="overflow-hidden rounded-[var(--t-radius-card)] border border-[var(--t-border)] bg-white" aria-labelledby="items-title">
          <h2 id="items-title" class="border-b border-[var(--t-border)] bg-[var(--t-surface)] px-5 py-3 text-sm font-semibold">Artículos</h2>
          <p v-if="!order.items?.length" class="px-5 py-6 text-center text-sm text-[var(--t-muted)]">Este pedido no tiene artículos.</p>
          <ul v-else>
            <li
              v-for="item in order.items"
              :key="item.id"
              class="flex items-center justify-between gap-4 border-b border-[var(--t-border)] px-5 py-3.5 last:border-b-0"
            >
              <div class="min-w-0">
                <p class="font-medium">
                  <template v-if="order.purchaseType === PURCHASE_TYPES.CURVA">{{ item.size ? `Talle ${item.size}` : '—' }}</template>
                  <template v-else>{{ item.size && item.color ? `${item.size} · ${item.color}` : 'Distribución proporcional' }}</template>
                </p>
                <p class="text-sm text-[var(--t-muted)]">
                  {{ item.quantity }} × ${{ Number(item.unitPrice).toLocaleString('es-AR', { maximumFractionDigits: 0 }) }}
                  <template v-if="item.discountPct > 0 && item.originalUnitPrice">
                    <span class="ml-1 line-through">${{ Number(item.originalUnitPrice).toLocaleString('es-AR', { maximumFractionDigits: 0 }) }}</span>
                    <span class="ml-1.5 rounded-full bg-[var(--t-highlight)] px-2 py-0.5 text-xs font-bold text-[var(--t-highlight-ink)]">-{{ item.discountPct }}%</span>
                  </template>
                </p>
              </div>
              <p class="shrink-0 font-semibold">
                ${{ (item.quantity * Number(item.unitPrice)).toLocaleString('es-AR', { maximumFractionDigits: 0 }) }}
              </p>
            </li>
          </ul>

          <div class="flex flex-wrap items-center justify-between gap-4 border-t border-[var(--t-border)] bg-[var(--t-surface)] px-5 py-4">
            <div>
              <p class="text-sm text-[var(--t-muted)]">Total</p>
              <p class="text-2xl font-bold">${{ order.totalAmount?.toLocaleString('es-AR', { maximumFractionDigits: 0 }) ?? '—' }}</p>
            </div>

            <template v-if="canPay">
              <button
                v-if="!paymentsStore.pendingSelection && !bankDetails && !paymentsStore.checkoutPublicKey && !paymentsStore.checkoutUrl && !brickVisible"
                type="button"
                :disabled="paymentsStore.loading"
                class="inline-flex min-h-12 items-center gap-2 rounded-full bg-[var(--t-ink)] px-8 font-semibold text-white hover:opacity-90 disabled:pointer-events-none disabled:opacity-50"
                @click="startPayment"
              >
                <svg v-if="paymentsStore.loading" class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                {{ paymentsStore.loading ? 'Preparando el pago…' : 'Pagar' }}
              </button>
              <button
                v-else-if="brickVisible"
                type="button"
                class="text-sm text-[var(--t-muted)] hover:text-[var(--t-ink)]"
                @click="brickVisible = false; brickError = ''; paymentsStore.resetCheckoutState()"
              >Cancelar</button>
            </template>
          </div>

          <!-- Selector cuando hay varios medios y ninguno se muestra combinado -->
          <div v-if="canPay && paymentsStore.pendingSelection" class="border-t border-[var(--t-border)] p-5">
            <PaymentMethodSelector
              :gateways="paymentsStore.availableGateways"
              :loading="paymentsStore.loading"
              @gateway-selected="onGatewaySelected"
            />
          </div>
        </section>

        <!-- Pago confirmado por Mercado Pago -->
        <div v-if="justPaid && order.status === 'paid'" role="status" class="mt-4 rounded-2xl bg-[#E6F2EC] px-5 py-4 text-[#1B6247]">
          <p class="font-bold">¡Pago recibido!</p>
          <p class="text-sm">Mercado Pago confirmó el pago y tu pedido ya figura como pagado.</p>
        </div>

        <!-- Error de pago -->
        <p v-if="paymentsStore.error" class="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mt-4">
          {{ paymentsStore.error }}
        </p>

        <!-- Medios de pago: QR de Mercado Pago y transferencia, lado a lado -->
        <div v-if="showCombined" :class="['mt-4 grid gap-4', bothMethods ? 'md:grid-cols-2' : '']">
          <MercadoPagoQrPanel
            v-if="paymentsStore.checkoutUrl"
            :order-id="order.id"
            :checkout-url="paymentsStore.checkoutUrl"
            :amount="order.totalAmount"
            :show-cancel="false"
            @paid="onQrPaid"
          />
          <!-- Datos de transferencia bancaria -->
          <section v-if="bankDetails" class="h-full space-y-2.5 rounded-[var(--t-radius-card)] bg-[var(--t-surface)] p-5 sm:p-6" aria-labelledby="transfer-title">
            <div class="mb-3">
              <h2 id="transfer-title" class="text-base font-bold">Pagá por transferencia</h2>
              <p class="mt-0.5 text-sm text-[var(--t-muted)]">Desde cualquier banco o billetera, al alias o CVU.</p>
            </div>
            <div v-if="bankDetails.cvu" class="flex items-center justify-between text-sm">
              <span class="text-[var(--t-muted)] shrink-0 mr-2">CVU</span>
              <div class="flex items-center gap-2 min-w-0">
                <span class="font-mono font-semibold text-[var(--t-ink)] truncate">{{ bankDetails.cvu }}</span>
                <button @click="copyToClipboard(bankDetails!.cvu, 'cvu')" class="shrink-0 text-xs font-semibold text-[var(--t-ink)] underline underline-offset-2 hover:opacity-70">
              {{ copied['cvu'] ? '✓ Copiado' : 'Copiar' }}
                </button>
              </div>
            </div>
            <div v-if="bankDetails.alias" class="flex items-center justify-between text-sm">
              <span class="text-[var(--t-muted)] shrink-0 mr-2">Alias</span>
              <div class="flex items-center gap-2">
                <span class="font-mono font-semibold text-[var(--t-ink)]">{{ bankDetails.alias }}</span>
                <button @click="copyToClipboard(bankDetails!.alias, 'alias')" class="shrink-0 text-xs font-semibold text-[var(--t-ink)] underline underline-offset-2 hover:opacity-70">
              {{ copied['alias'] ? '✓ Copiado' : 'Copiar' }}
                </button>
              </div>
            </div>
            <div v-if="bankDetails.holderName" class="flex items-center justify-between text-sm">
              <span class="text-[var(--t-muted)]">Titular</span>
              <span class="font-semibold text-[var(--t-ink)]">{{ bankDetails.holderName }}</span>
            </div>
            <div v-if="bankDetails.bankName" class="flex items-center justify-between text-sm">
              <span class="text-[var(--t-muted)]">Banco</span>
              <span class="font-semibold text-[var(--t-ink)]">{{ bankDetails.bankName }}</span>
            </div>
            <div class="flex items-center justify-between text-sm">
              <span class="text-[var(--t-muted)]">Monto a transferir</span>
              <span class="font-bold text-[var(--t-ink)]">${{ Number(bankDetails.amount).toLocaleString('es-AR', { maximumFractionDigits: 0 }) }}</span>
            </div>
            <p v-if="bankDetails.notes" class="mt-1 rounded-2xl bg-white px-4 py-2.5 text-sm">{{ bankDetails.notes }}</p>

            <!-- Instrucciones en 3 pasos -->
            <ol class="text-sm text-[var(--t-muted)] space-y-1 pt-2 border-t border-[var(--t-border)]">
              <li><span class="font-semibold text-[var(--t-ink)]">1.</span> Copiá el CVU o alias</li>
              <li><span class="font-semibold text-[var(--t-ink)]">2.</span> Realizá la transferencia desde tu homebanking por el monto exacto</li>
              <li><span class="font-semibold text-[var(--t-ink)]">3.</span> Avisanos por WhatsApp para que confirmemos tu pago</li>
            </ol>

            <!-- Botón WhatsApp -->
            <button
              v-if="configStore.branding.whatsappNumber"
              @click="openWhatsApp"
              class="mt-2 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#25D366] px-5 text-sm font-semibold text-[#0B3D21] transition-opacity hover:opacity-90"
            >
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Avisar por WhatsApp
            </button>
          </section>
        </div>

        <!-- Otros medios activos -->
        <div v-if="otherGateways.length" class="mt-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <PaymentMethodSelector
            :gateways="otherGateways"
            :loading="paymentsStore.loading"
            @gateway-selected="onGatewaySelected"
          />
        </div>

        <!-- CardPaymentBrick (checkout_api) -->
        <div v-if="brickVisible" class="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 mt-4">
          <div v-if="brickLoading" class="flex items-center gap-2 text-sm text-gray-500 py-4 justify-center">
            <svg class="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            Preparando formulario…
          </div>
          <div id="mp-brick-detail"></div>
          <p v-if="brickError" class="text-xs text-red-500 mt-2">{{ brickError }}</p>
          <button
            @click="brickVisible = false; brickError = ''; paymentsStore.resetCheckoutState()"
            class="text-xs text-gray-400 hover:text-gray-600 mt-2"
          >Cancelar</button>
        </div>
      </div>
    </div>
  </AppLayout>

  <!-- Modal de datos de envío para WhatsApp -->
  <WhatsAppShippingModal
    v-if="order"
    v-model:open="shippingModalOpen"
    :store-name="configStore.branding.storeName"
    :whatsapp-number="configStore.branding.whatsappNumber!"
    :order-id="order.id"
    :created-at="order.createdAt"
    :total-amount="order.totalAmount"
    :purchase-type="order.purchaseType"
    :items="order.items"
  />
</template>
