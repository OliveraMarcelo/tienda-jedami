<script setup lang="ts">
import { onMounted, computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'
import { useOrdersStore } from '@/stores/orders.store'
import { useConfigStore } from '@/stores/config.store'
import { cancelOrder, updateOrderNotes } from '@/api/orders.api'
import { smartCheckout, retryPayment, type BankDetails } from '@/api/payments.api'
import type { OrderStatus } from '@/api/orders.api'

const router = useRouter()
const ordersStore = useOrdersStore()
const configStore = useConfigStore()

onMounted(() => {
  ordersStore.loadOrders()
})

const statusConfig: Record<OrderStatus, { label: string; classes: string }> = {
  pending:   { label: 'Pendiente de pago', classes: 'bg-amber-50 text-amber-700 border-amber-200' },
  paid:      { label: 'Pagado',            classes: 'bg-green-50 text-green-700 border-green-200' },
  rejected:  { label: 'Rechazado',         classes: 'bg-red-50 text-red-700 border-red-200' },
  cancelled: { label: 'Cancelado',         classes: 'bg-gray-50 text-gray-500 border-gray-200' },
}

const hasOrders = computed(() => ordersStore.orders.length > 0)

const confirmingCancel = ref<number | null>(null)
const cancelError = ref('')

const retrying = ref<number | null>(null)
const retryError = ref<Record<number, string>>({})

// ─── Notas ────────────────────────────────────────────────────────────────────
const editingNotes = ref<number | null>(null)
const notesText = ref('')
const savingNotes = ref(false)

function openNotesEdit(order: { id: number; notes: string | null }) {
  editingNotes.value = order.id
  notesText.value = order.notes ?? ''
}

async function saveNotes(order: { id: number; notes: string | null }) {
  savingNotes.value = true
  try {
    await updateOrderNotes(order.id, notesText.value.trim() || null)
    order.notes = notesText.value.trim() || null
    editingNotes.value = null
  } finally {
    savingNotes.value = false
  }
}

async function handleRetry(orderId: number) {
  retrying.value = orderId
  retryError.value[orderId] = ''
  try {
    const { checkoutUrl } = await retryPayment(orderId)
    window.location.href = checkoutUrl
  } catch (e: any) {
    retryError.value[orderId] = e?.response?.data?.detail ?? 'Error al generar el link de pago'
  } finally {
    retrying.value = null
  }
}

async function doCancel(orderId: number) {
  cancelError.value = ''
  try {
    await cancelOrder(orderId)
    const order = ordersStore.orders.find(o => o.id === orderId)
    if (order) order.status = 'cancelled'
    confirmingCancel.value = null
  } catch (e: any) {
    cancelError.value = e?.response?.data?.detail ?? 'Error al cancelar'
  }
}

// ─── Smart payment (por orden) ────────────────────────────────────────────────
const bankDetailsMap = ref<Record<number, BankDetails>>({})
const payingOrderId = ref<number | null>(null)
const payError = ref<Record<number, string>>({})
const copied = ref<Record<string, boolean>>({})

async function startPayment(orderId: number) {
  payingOrderId.value = orderId
  payError.value[orderId] = ''
  try {
    const result = await smartCheckout(orderId)
    if (result.type === 'redirect') {
      window.location.href = result.checkoutUrl
    } else if (result.type === 'bank_transfer') {
      bankDetailsMap.value[orderId] = result.bankDetails
    } else {
      // 'select' o 'preference': ir al detalle del pedido donde está el UI completo
      router.push(`/pedidos/${orderId}`)
    }
  } catch (e: any) {
    payError.value[orderId] = e?.response?.data?.detail ?? 'Error al iniciar el pago'
  } finally {
    payingOrderId.value = null
  }
}

async function copyToClipboard(text: string | null, key: string) {
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    copied.value[key] = true
    setTimeout(() => { copied.value[key] = false }, 2000)
  } catch { /* navegador sin soporte */ }
}

function openWhatsApp(orderId: number, amount: number) {
  const number = configStore.branding.whatsappNumber
  if (!number) return
  const text = encodeURIComponent(
    `Hola! Realicé la transferencia para el Pedido #${orderId} por $${amount.toLocaleString('es-AR', { maximumFractionDigits: 0 })}. Adjunto el comprobante.`
  )
  window.open(`https://wa.me/${number}?text=${text}`, '_blank')
}

</script>

<template>
  <AppLayout>
    <div class="max-w-2xl mx-auto">
      <h1 class="text-2xl font-bold text-gray-900 mb-6">Mis pedidos</h1>

      <!-- Loading -->
      <div v-if="ordersStore.loading" class="space-y-3">
        <div v-for="i in 3" :key="i" class="animate-pulse bg-white rounded-2xl border border-gray-200 p-4 h-20"></div>
      </div>

      <!-- Error -->
      <div v-else-if="ordersStore.error" class="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center justify-between">
        <span>{{ ordersStore.error }}</span>
        <button @click="ordersStore.loadOrders()" class="text-red-600 font-semibold hover:underline">Reintentar</button>
      </div>

      <!-- Estado vacío -->
      <div v-else-if="!hasOrders" class="text-center py-16">
        <div class="text-5xl mb-4">📦</div>
        <p class="text-gray-600 font-medium mb-2">Todavía no tenés pedidos</p>
        <p class="text-sm text-gray-400 mb-6">Explorá el catálogo y hacé tu primer pedido.</p>
        <button
          @click="router.push('/catalogo')"
          class="inline-flex items-center gap-2 rounded-xl bg-[#E91E8C] text-white px-5 py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          Ver catálogo
        </button>
      </div>

      <!-- Lista de pedidos -->
      <div v-else class="space-y-3">
        <div
          v-for="order in ordersStore.orders"
          :key="order.id"
          class="bg-white rounded-2xl border border-gray-200 shadow-sm p-4"
        >
          <div
            class="flex items-start justify-between gap-3 cursor-pointer"
            @click="router.push('/pedidos/' + order.id)"
          >
            <div>
              <div class="flex items-center gap-2 mb-1">
                <span class="font-semibold text-gray-800">#{{ order.id }}</span>
                <span
                  class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold border"
                  :class="statusConfig[order.status].classes"
                >
                  {{ statusConfig[order.status].label }}
                </span>
              </div>
              <p class="text-sm text-gray-500">
                {{ configStore.purchaseTypeLabel[order.purchaseType] ?? order.purchaseType }} ·
                {{ new Date(order.createdAt).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }) }}
              </p>
            </div>
            <div class="text-right shrink-0">
              <p class="text-lg font-bold text-gray-900">${{ order.totalAmount.toLocaleString('es-AR', { maximumFractionDigits: 0 }) }}</p>
              <p class="text-xs text-gray-400">total</p>
            </div>
          </div>

          <!-- Notas del comprador -->
          <div class="mt-3 pt-3 border-t border-gray-100" @click.stop>
            <!-- Modo lectura -->
            <template v-if="editingNotes !== order.id">
              <div class="flex items-start justify-between gap-2">
                <p v-if="order.notes" class="text-xs text-gray-500 italic">
                  "{{ order.notes }}"
                </p>
                <p v-else class="text-xs text-gray-400">Sin notas para el administrador</p>
                <button
                  v-if="order.status === 'pending'"
                  @click="openNotesEdit(order)"
                  class="text-xs text-[#E91E8C] hover:underline shrink-0"
                >{{ order.notes ? 'Editar nota' : 'Agregar nota' }}</button>
              </div>
            </template>
            <!-- Modo edición -->
            <template v-else>
              <textarea
                v-model="notesText"
                maxlength="500"
                rows="2"
                placeholder="Ej: Entregar en horario de la tarde, necesito factura A…"
                class="w-full text-sm rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#E91E8C] resize-none"
              ></textarea>
              <div class="flex items-center justify-between mt-1.5">
                <span class="text-xs text-gray-400">{{ notesText.length }}/500</span>
                <div class="flex gap-2">
                  <button @click="editingNotes = null" class="text-xs text-gray-400 hover:text-gray-600">Cancelar</button>
                  <button
                    :disabled="savingNotes"
                    @click="saveNotes(order)"
                    class="text-xs font-semibold text-white bg-[#E91E8C] px-3 py-1 rounded-lg hover:opacity-90 disabled:opacity-50"
                  >{{ savingNotes ? 'Guardando…' : 'Guardar' }}</button>
                </div>
              </div>
            </template>
          </div>

          <!-- CTA de pago y cancelación para pedidos pendientes -->
          <div
            v-if="order.status === 'pending'"
            class="mt-3 pt-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2"
          >
            <div v-if="order.totalAmount > 0" class="w-full">
              <!-- Datos de transferencia bancaria (después de iniciar smart checkout) -->
              <div v-if="bankDetailsMap[order.id]" class="rounded-xl border border-indigo-200 bg-indigo-50 p-4 space-y-2">
                <p class="text-sm font-semibold text-indigo-800 mb-3">Datos para la transferencia</p>
                <div v-if="bankDetailsMap[order.id].cvu" class="flex items-center justify-between text-sm">
                  <span class="text-gray-600 shrink-0 mr-2">CVU</span>
                  <div class="flex items-center gap-2 min-w-0">
                    <span class="font-mono font-semibold text-gray-800 truncate">{{ bankDetailsMap[order.id].cvu }}</span>
                    <button
                      @click.stop="copyToClipboard(bankDetailsMap[order.id].cvu, `cvu-${order.id}`)"
                      class="shrink-0 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
                    >{{ copied[`cvu-${order.id}`] ? '✓ Copiado' : 'Copiar' }}</button>
                  </div>
                </div>
                <div v-if="bankDetailsMap[order.id].alias" class="flex items-center justify-between text-sm">
                  <span class="text-gray-600 shrink-0 mr-2">Alias</span>
                  <div class="flex items-center gap-2">
                    <span class="font-mono font-semibold text-gray-800">{{ bankDetailsMap[order.id].alias }}</span>
                    <button
                      @click.stop="copyToClipboard(bankDetailsMap[order.id].alias, `alias-${order.id}`)"
                      class="shrink-0 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
                    >{{ copied[`alias-${order.id}`] ? '✓ Copiado' : 'Copiar' }}</button>
                  </div>
                </div>
                <div v-if="bankDetailsMap[order.id].holderName" class="flex items-center justify-between text-sm">
                  <span class="text-gray-600">Titular</span>
                  <span class="font-semibold text-gray-800">{{ bankDetailsMap[order.id].holderName }}</span>
                </div>
                <div v-if="bankDetailsMap[order.id].bankName" class="flex items-center justify-between text-sm">
                  <span class="text-gray-600">Banco</span>
                  <span class="font-semibold text-gray-800">{{ bankDetailsMap[order.id].bankName }}</span>
                </div>
                <div class="flex items-center justify-between text-sm">
                  <span class="text-gray-600">Monto a transferir</span>
                  <span class="font-bold text-gray-900">${{ Number(bankDetailsMap[order.id].amount).toLocaleString('es-AR', { maximumFractionDigits: 0 }) }}</span>
                </div>
                <p v-if="bankDetailsMap[order.id].notes" class="text-xs text-indigo-700 bg-indigo-100 rounded-lg px-3 py-2 mt-1">
                  {{ bankDetailsMap[order.id].notes }}
                </p>
                <ol class="text-sm text-gray-600 space-y-1 pt-2 border-t border-indigo-200">
                  <li><span class="font-semibold text-indigo-700">1.</span> Copiá el CVU o alias</li>
                  <li><span class="font-semibold text-indigo-700">2.</span> Realizá la transferencia por el monto exacto</li>
                  <li><span class="font-semibold text-indigo-700">3.</span> Avisanos por WhatsApp para confirmar tu pago</li>
                </ol>
                <button
                  v-if="configStore.branding.whatsappNumber"
                  @click.stop="openWhatsApp(order.id, order.totalAmount)"
                  class="mt-1 inline-flex items-center gap-2 rounded-xl bg-green-500 text-white px-4 py-2 text-sm font-semibold hover:opacity-90 transition-opacity w-full justify-center"
                >
                  <svg class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  Avisar por WhatsApp
                </button>
              </div>

              <!-- Botón Pagar unificado -->
              <button
                v-else
                :disabled="payingOrderId === order.id"
                @click.stop="startPayment(order.id)"
                class="inline-flex items-center gap-2 rounded-xl bg-[#009EE3] text-white px-4 py-2 text-sm font-semibold hover:opacity-90 transition-opacity shadow disabled:opacity-50"
              >
                <svg v-if="payingOrderId === order.id" class="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                {{ payingOrderId === order.id ? 'Procesando…' : 'Pagar' }}
              </button>
              <p v-if="payError[order.id]" class="text-xs text-red-500 mt-1">{{ payError[order.id] }}</p>
            </div>

            <!-- Cancelación inline -->
            <div @click.stop>
              <button
                v-if="confirmingCancel !== order.id"
                @click="confirmingCancel = order.id; cancelError = ''"
                class="text-xs text-red-500 hover:text-red-700 font-medium"
              >Cancelar pedido</button>
              <template v-else>
                <p class="text-xs text-gray-600 mb-1">¿Estás seguro? Esta acción no se puede deshacer.</p>
                <div class="flex gap-2 items-center">
                  <button @click="doCancel(order.id)" class="text-xs text-red-600 font-semibold hover:underline">Sí, cancelar</button>
                  <button @click="confirmingCancel = null" class="text-xs text-gray-500 hover:underline">No, volver</button>
                </div>
                <p v-if="cancelError" class="text-xs text-red-500 mt-1">{{ cancelError }}</p>
              </template>
            </div>
          </div>

          <!-- Reintentar pago para pedidos rechazados -->
          <div
            v-if="order.status === 'rejected'"
            class="mt-3 pt-3 border-t border-gray-100 flex flex-wrap items-center gap-3"
            @click.stop
          >
            <button
              :disabled="retrying === order.id"
              @click="handleRetry(order.id)"
              class="text-xs font-semibold text-[#009EE3] hover:opacity-80 disabled:opacity-40"
            >
              {{ retrying === order.id ? 'Generando link…' : 'Reintentar pago' }}
            </button>
            <p v-if="retryError[order.id]" class="text-xs text-red-500">{{ retryError[order.id] }}</p>
          </div>
        </div>
      </div>
    </div>
  </AppLayout>
</template>
