<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import type { AxiosError } from 'axios'
import AppLayout from '@/layouts/AppLayout.vue'
import { useConfigStore } from '@/stores/config.store'
import { fetchAdminPayments, type AdminPayment } from '@/api/admin.payments.api'
import {
  createIntent,
  cancelIntent,
  getIntent,
  confirmPointPayment,
  type IntentState,
} from '@/api/pos.api'

type ApiError = AxiosError<{ detail?: string; title?: string }>

const router = useRouter()
const configStore = useConfigStore()

// ─── Pedidos pending ──────────────────────────────────────────────────────────
const loading = ref(true)
const error = ref('')
const orders = ref<AdminPayment[]>([])

async function loadPendingOrders() {
  loading.value = true
  error.value = ''
  try {
    const res = await fetchAdminPayments({ status: 'pending', limit: 100 })
    orders.value = res.payments.filter(p => Number(p.totalAmount) > 0)
  } catch {
    error.value = 'Error al cargar los pedidos pendientes.'
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await configStore.loadConfig()
  await loadPendingOrders()
})

// ─── Estado de intent por pedido ─────────────────────────────────────────────
const intentStates = ref<Record<number, IntentState>>({})

function getState(orderId: number): IntentState {
  if (!intentStates.value[orderId]) {
    intentStates.value[orderId] = { loading: false, status: null, deviceName: '', intentId: null, error: '' }
  }
  return intentStates.value[orderId]
}

const ACTIVE_STATUSES = new Set(['open', 'on_terminal', 'processing'])

function isIntentActive(orderId: number): boolean {
  const s = intentStates.value[orderId]
  return !!s?.status && ACTIVE_STATUSES.has(s.status)
}

// ─── Cobrar con Point ─────────────────────────────────────────────────────────
async function handleCreateIntent(orderId: number) {
  const state = getState(orderId)
  state.loading = true
  state.error = ''
  try {
    const result = await createIntent(orderId)
    state.status = result.status
    state.intentId = result.intentId
    state.deviceName = result.deviceName
  } catch (err) {
    const e = err as ApiError
    state.error = e?.response?.data?.detail ?? e?.response?.data?.title ?? 'Error al iniciar el cobro'
  } finally {
    state.loading = false
  }
}

// ─── Verificar estado ─────────────────────────────────────────────────────────
async function handleGetIntent(orderId: number) {
  const state = getState(orderId)
  state.loading = true
  state.error = ''
  try {
    const result = await getIntent(orderId)
    state.status = result.intent.status
    state.intentId = result.intent.mp_intent_id
    state.deviceName = result.deviceName
    // Si ya terminó el proceso, recargar pedidos y limpiar estado local
    if (!ACTIVE_STATUSES.has(result.intent.status)) {
      await loadPendingOrders()
      delete intentStates.value[orderId]
    }
  } catch (err) {
    const e = err as ApiError
    state.error = e?.response?.data?.detail ?? 'Error al verificar el estado'
  } finally {
    state.loading = false
  }
}

// ─── Cancelar cobro ───────────────────────────────────────────────────────────
async function handleCancelIntent(orderId: number) {
  const state = getState(orderId)
  state.loading = true
  state.error = ''
  try {
    await cancelIntent(orderId)
    state.status = null
    state.intentId = null
    state.deviceName = ''
  } catch (err) {
    const e = err as ApiError
    state.error = e?.response?.data?.detail ?? 'Error al cancelar el cobro'
  } finally {
    state.loading = false
  }
}

// ─── Confirmación manual ─────────────────────────────────────────────────────
const confirmingOrderId = ref<number | null>(null)
const confirmMpPaymentId = ref('')
const confirmLoading = ref(false)
const confirmError = ref('')

function openConfirmModal(orderId: number) {
  confirmingOrderId.value = orderId
  confirmMpPaymentId.value = ''
  confirmError.value = ''
}

function closeConfirmModal() {
  confirmingOrderId.value = null
  confirmMpPaymentId.value = ''
  confirmError.value = ''
}

async function handleConfirm() {
  if (confirmingOrderId.value === null) return
  confirmLoading.value = true
  confirmError.value = ''
  try {
    await confirmPointPayment(
      confirmingOrderId.value,
      confirmMpPaymentId.value || undefined,
    )
    // Quitar el pedido de la lista (ya está pagado)
    orders.value = orders.value.filter(o => o.orderId !== confirmingOrderId.value)
    delete intentStates.value[confirmingOrderId.value!]
    closeConfirmModal()
  } catch (err) {
    const e = err as ApiError
    confirmError.value = e?.response?.data?.detail ?? e?.response?.data?.title ?? 'Error al confirmar el pago'
  } finally {
    confirmLoading.value = false
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatCurrency(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

const hasActiveDevice = computed(() => !!configStore.pointDevice)
</script>

<template>
  <AppLayout>
    <div class="max-w-4xl mx-auto">
      <!-- Breadcrumb -->
      <div class="flex items-center gap-3 mb-6">
        <button @click="router.push('/admin')" class="text-sm text-gray-500 hover:text-[#E91E8C]">← Admin</button>
        <h1 class="text-2xl font-bold text-gray-900">Cobros Point</h1>
      </div>

      <!-- Aviso: sin device activo -->
      <div
        v-if="!loading && !hasActiveDevice"
        class="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-2xl p-4 mb-4 text-sm"
      >
        ⚠️ No hay dispositivo Point activo.
        <RouterLink to="/admin/configuracion" class="underline font-semibold ml-1">
          Configurar dispositivo
        </RouterLink>
      </div>

      <!-- Device activo info -->
      <div
        v-if="hasActiveDevice"
        class="bg-green-50 border border-green-200 text-green-800 rounded-2xl p-3 mb-4 text-sm flex items-center gap-2"
      >
        <span>🖲️</span>
        <span>Dispositivo activo: <strong>{{ configStore.pointDevice?.name }}</strong></span>
      </div>

      <!-- Error general -->
      <div v-if="error" class="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4 mb-4 text-sm">
        {{ error }}
      </div>

      <!-- Skeleton -->
      <div v-if="loading" class="space-y-3">
        <div v-for="i in 4" :key="i" class="bg-white rounded-2xl border border-gray-200 h-20 animate-pulse" />
      </div>

      <!-- Lista vacía -->
      <div
        v-else-if="orders.length === 0"
        class="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center text-gray-500"
      >
        No hay pedidos pendientes para cobrar.
      </div>

      <!-- Lista de pedidos -->
      <div v-else class="space-y-3">
        <div
          v-for="order in orders"
          :key="order.orderId"
          class="bg-white rounded-2xl border border-gray-200 shadow-sm p-4"
        >
          <div class="flex items-center justify-between flex-wrap gap-3">
            <!-- Info pedido -->
            <div>
              <p class="font-semibold text-gray-900">Pedido #{{ order.orderId }}</p>
              <p class="text-sm text-gray-500">{{ order.customerEmail }}</p>
              <p class="text-sm font-bold text-gray-800 mt-1">{{ formatCurrency(order.totalAmount) }}</p>
            </div>

            <!-- Acciones -->
            <div class="flex flex-col items-end gap-2">
              <!-- Estado inicial: botón cobrar -->
              <template v-if="!isIntentActive(order.orderId)">
                <button
                  v-if="hasActiveDevice"
                  @click="handleCreateIntent(order.orderId)"
                  :disabled="getState(order.orderId).loading"
                  class="px-4 py-2 rounded-xl bg-[#E91E8C] text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {{ getState(order.orderId).loading ? 'Iniciando...' : '🖲️ Cobrar con Point' }}
                </button>
              </template>

              <!-- Estado activo: esperando pago -->
              <template v-else>
                <div class="flex items-center gap-2">
                  <span class="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50 text-blue-700 text-xs font-medium border border-blue-200">
                    ⏳ Esperando en {{ getState(order.orderId).deviceName || 'dispositivo' }}...
                  </span>
                </div>
                <div class="flex gap-2">
                  <button
                    @click="handleGetIntent(order.orderId)"
                    :disabled="getState(order.orderId).loading"
                    class="px-3 py-1.5 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {{ getState(order.orderId).loading ? '...' : '↻ Verificar estado' }}
                  </button>
                  <button
                    @click="openConfirmModal(order.orderId)"
                    class="px-3 py-1.5 rounded-lg border border-green-300 text-sm text-green-700 hover:bg-green-50"
                  >
                    ✓ Confirmar manual
                  </button>
                  <button
                    @click="handleCancelIntent(order.orderId)"
                    :disabled="getState(order.orderId).loading"
                    class="px-3 py-1.5 rounded-lg border border-red-200 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    ✕ Cancelar
                  </button>
                </div>
              </template>

              <!-- Botón confirmar disponible cuando no hay intent activo (no requiere device) -->
              <button
                v-if="!isIntentActive(order.orderId)"
                @click="openConfirmModal(order.orderId)"
                class="px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-500 hover:bg-gray-50"
              >
                Confirmar pago manual
              </button>

              <!-- Error inline -->
              <p v-if="getState(order.orderId).error" class="text-xs text-red-600 text-right max-w-xs">
                {{ getState(order.orderId).error }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Botón recargar -->
      <div class="mt-4 text-center">
        <button
          @click="loadPendingOrders"
          class="text-sm text-gray-500 hover:text-[#E91E8C] underline"
        >
          Recargar lista
        </button>
      </div>
    </div>

    <!-- Modal confirmación manual -->
    <Teleport to="body">
      <div
        v-if="confirmingOrderId !== null"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
        @click.self="closeConfirmModal"
      >
        <div class="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
          <h2 class="text-lg font-bold text-gray-900 mb-1">Confirmar pago manual</h2>
          <p class="text-sm text-gray-500 mb-4">
            Pedido #{{ confirmingOrderId }} — podés ingresar el ID de pago de MP si lo tenés disponible.
          </p>

          <label class="block text-sm font-medium text-gray-700 mb-1">
            ID de pago MP <span class="text-gray-400 font-normal">(opcional)</span>
          </label>
          <input
            v-model="confirmMpPaymentId"
            type="text"
            placeholder="ej: 1234567890"
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E91E8C] mb-4"
          />

          <p v-if="confirmError" class="text-sm text-red-600 mb-3">{{ confirmError }}</p>

          <div class="flex gap-3 justify-end">
            <button
              @click="closeConfirmModal"
              class="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              @click="handleConfirm"
              :disabled="confirmLoading"
              class="px-4 py-2 rounded-xl bg-[#E91E8C] text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50"
            >
              {{ confirmLoading ? 'Confirmando...' : 'Confirmar pago' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </AppLayout>
</template>
