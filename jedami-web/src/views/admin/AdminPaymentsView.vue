<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'
import { fetchAdminPayments, confirmBankTransfer, type AdminPayment } from '@/api/admin.payments.api'
import { cancelOrder } from '@/api/orders.api'
import { retryPayment } from '@/api/payments.api'
import { useConfigStore } from '@/stores/config.store'

const router = useRouter()
const configStore = useConfigStore()

const loading = ref(true)
const error = ref('')
const payments = ref<AdminPayment[]>([])
const page = ref(1)
const limit = 20
const total = ref(0)
const pages = computed(() => Math.ceil(total.value / limit))

// Filtros
const filterStatus = ref('')
const filterDateFrom = ref('')
const filterDateTo = ref('')

async function loadPayments() {
  loading.value = true
  error.value = ''
  try {
    const res = await fetchAdminPayments({
      page: page.value,
      limit,
      status:   filterStatus.value   || undefined,
      dateFrom: filterDateFrom.value || undefined,
      dateTo:   filterDateTo.value   || undefined,
    })
    payments.value = res.payments
    total.value = res.pagination.total
  } catch {
    error.value = 'Error al cargar los pagos.'
  } finally {
    loading.value = false
  }
}

async function applyFilters() {
  page.value = 1
  await loadPayments()
}

async function goToPage(p: number) {
  page.value = p
  await loadPayments()
}

onMounted(loadPayments)

function formatCurrency(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

const paymentStatusColors: Record<string, string> = {
  approved: 'bg-green-50 text-green-700 border-green-200',
  pending:  'bg-yellow-50 text-yellow-700 border-yellow-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
}

const paymentStatusLabels: Record<string, string> = {
  approved:  'Aprobado',
  pending:   'Pendiente',
  rejected:  'Rechazado',
  cancelled: 'Cancelado',
}

const confirmingCancel = ref<number | null>(null)
const cancelError = ref<Record<number, string>>({})

async function doCancel(orderId: number) {
  cancelError.value[orderId] = ''
  try {
    await cancelOrder(orderId)
    const payment = payments.value.find(p => p.orderId === orderId)
    if (payment) payment.orderStatus = 'cancelled'
    confirmingCancel.value = null
  } catch (e: any) {
    cancelError.value[orderId] = e?.response?.data?.detail ?? 'Error al cancelar'
  }
}

const retrying = ref<number | null>(null)
const retryError = ref<Record<number, string>>({})

async function handleRetry(orderId: number) {
  retrying.value = orderId
  retryError.value[orderId] = ''
  try {
    const { checkoutUrl } = await retryPayment(orderId)
    window.location.href = checkoutUrl
  } catch (e: any) {
    retryError.value[orderId] = e?.response?.data?.detail ?? 'Error al generar el link'
  } finally {
    retrying.value = null
  }
}

const confirming = ref<number | null>(null)
const confirmError = ref<Record<number, string>>({})

async function handleConfirmTransfer(orderId: number) {
  confirming.value = orderId
  confirmError.value[orderId] = ''
  try {
    await confirmBankTransfer(orderId)
    const payment = payments.value.find(p => p.orderId === orderId)
    if (payment) {
      payment.paymentStatus = 'approved'
      payment.orderStatus = 'paid'
    }
  } catch (e: any) {
    confirmError.value[orderId] = e?.response?.data?.detail ?? 'Error al confirmar'
  } finally {
    confirming.value = null
  }
}
</script>

<template>
  <AppLayout>
    <div class="max-w-5xl mx-auto">
      <!-- Breadcrumb -->
      <div class="flex items-center gap-3 mb-6">
        <button @click="router.push('/admin')" class="text-sm text-gray-500 hover:text-[#E91E8C]">← Admin</button>
        <h1 class="text-2xl font-bold text-gray-900">Pagos</h1>
      </div>

      <!-- Filtros -->
      <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div>
          <label class="block text-xs text-gray-500 mb-1">Estado</label>
          <select
            v-model="filterStatus"
            class="h-9 rounded-lg border border-gray-300 px-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#E91E8C]"
          >
            <option value="">Todos</option>
            <option value="approved">Aprobado</option>
            <option value="pending">Pendiente</option>
            <option value="rejected">Rechazado</option>
          </select>
        </div>
        <div>
          <label class="block text-xs text-gray-500 mb-1">Desde</label>
          <input
            v-model="filterDateFrom"
            type="date"
            class="h-9 rounded-lg border border-gray-300 px-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#E91E8C]"
          />
        </div>
        <div>
          <label class="block text-xs text-gray-500 mb-1">Hasta</label>
          <input
            v-model="filterDateTo"
            type="date"
            class="h-9 rounded-lg border border-gray-300 px-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#E91E8C]"
          />
        </div>
        <button
          @click="applyFilters"
          class="h-9 px-4 rounded-lg bg-[#E91E8C] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          Filtrar
        </button>
      </div>

      <!-- Skeleton -->
      <div v-if="loading" class="space-y-3">
        <div v-for="i in 5" :key="i" class="animate-pulse bg-white rounded-2xl border border-gray-200 h-14"></div>
      </div>

      <p v-else-if="error" class="text-red-500 text-sm">{{ error }}</p>

      <template v-else>
        <!-- Tabla -->
        <div class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-4">
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="text-left text-xs text-gray-500 border-b border-gray-100">
                  <th class="px-4 py-3 font-medium">#</th>
                  <th class="px-4 py-3 font-medium">Cliente</th>
                  <th class="px-4 py-3 font-medium">Tipo compra</th>
                  <th class="px-4 py-3 font-medium text-right">Monto</th>
                  <th class="px-4 py-3 font-medium">Método</th>
                  <th class="px-4 py-3 font-medium">Estado</th>
                  <th class="px-4 py-3 font-medium">Fecha</th>
                  <th class="px-4 py-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="p in payments"
                  :key="p.id"
                  class="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                >
                  <td class="px-4 py-3 text-gray-400 text-xs">{{ p.id }}</td>
                  <td class="px-4 py-3 max-w-[220px]">
                    <p class="text-gray-800 truncate">{{ p.customerEmail }}</p>
                    <p v-if="p.notes" class="text-xs text-amber-600 italic truncate mt-0.5" :title="p.notes">
                      "{{ p.notes }}"
                    </p>
                  </td>
                  <td class="px-4 py-3 text-gray-600">{{ configStore.purchaseTypeLabel[p.purchaseType] ?? p.purchaseType }}</td>
                  <td class="px-4 py-3 text-right font-semibold text-gray-800">{{ formatCurrency(p.amount) }}</td>
                  <td class="px-4 py-3">
                    <span
                      class="inline-flex rounded-full px-2 py-0.5 text-xs font-semibold border"
                      :class="p.paymentMethod === 'bank_transfer'
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                        : 'bg-blue-50 text-blue-700 border-blue-200'"
                    >
                      {{ p.paymentMethod === 'bank_transfer' ? 'Transferencia' : 'Mercado Pago' }}
                    </span>
                  </td>
                  <td class="px-4 py-3">
                    <span
                      class="inline-flex rounded-full px-2 py-0.5 text-xs font-semibold border"
                      :class="paymentStatusColors[p.paymentStatus] ?? 'bg-gray-50 text-gray-600 border-gray-200'"
                    >
                      {{ paymentStatusLabels[p.paymentStatus] ?? p.paymentStatus }}
                    </span>
                  </td>
                  <td class="px-4 py-3 text-gray-500">{{ formatDate(p.paidAt) }}</td>
                  <td class="px-4 py-3">
                    <div class="flex flex-col gap-1">
                      <!-- Cancelar (solo pending) -->
                      <template v-if="p.orderStatus === 'pending'">
                        <button
                          v-if="confirmingCancel !== p.orderId"
                          @click="confirmingCancel = p.orderId; delete cancelError[p.orderId]"
                          class="text-xs text-red-500 hover:text-red-700 font-medium text-left"
                        >Cancelar</button>
                        <div v-else class="flex flex-col gap-0.5">
                          <p class="text-xs text-gray-600">¿Confirmar?</p>
                          <div class="flex gap-2">
                            <button @click="doCancel(p.orderId)" class="text-xs text-red-600 font-semibold hover:underline">Sí</button>
                            <button @click="confirmingCancel = null" class="text-xs text-gray-500 hover:underline">No</button>
                          </div>
                          <p v-if="cancelError[p.orderId]" class="text-xs text-red-500">{{ cancelError[p.orderId] }}</p>
                        </div>
                      </template>
                      <!-- Confirmar transferencia -->
                      <template v-if="p.paymentMethod === 'bank_transfer' && p.paymentStatus === 'pending'">
                        <button
                          :disabled="confirming === p.orderId"
                          @click="handleConfirmTransfer(p.orderId)"
                          class="text-xs text-indigo-600 font-semibold hover:opacity-80 disabled:opacity-40 text-left"
                        >{{ confirming === p.orderId ? 'Confirmando…' : 'Confirmar transferencia' }}</button>
                        <p v-if="confirmError[p.orderId]" class="text-xs text-red-500">{{ confirmError[p.orderId] }}</p>
                      </template>
                      <!-- Reintentar pago (pending o rejected, solo MP) -->
                      <template v-if="p.paymentMethod !== 'bank_transfer' && ['pending', 'rejected'].includes(p.orderStatus)">
                        <button
                          :disabled="retrying === p.orderId"
                          @click="handleRetry(p.orderId)"
                          class="text-xs text-[#009EE3] font-semibold hover:opacity-80 disabled:opacity-40 text-left"
                        >{{ retrying === p.orderId ? 'Generando…' : 'Reintentar pago' }}</button>
                        <p v-if="retryError[p.orderId]" class="text-xs text-red-500">{{ retryError[p.orderId] }}</p>
                      </template>
                    </div>
                  </td>
                </tr>
                <tr v-if="payments.length === 0">
                  <td colspan="8" class="px-4 py-8 text-center text-gray-400 text-sm">No hay pagos para mostrar.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Paginación -->
        <div class="flex items-center justify-between text-sm text-gray-500">
          <span>{{ total }} resultados — Página {{ page }} de {{ pages || 1 }}</span>
          <div class="flex gap-2">
            <button
              :disabled="page <= 1"
              @click="goToPage(page - 1)"
              class="h-8 px-3 rounded-lg border border-gray-300 hover:border-[#E91E8C] hover:text-[#E91E8C] transition-colors disabled:opacity-40 disabled:pointer-events-none"
            >
              ← Anterior
            </button>
            <button
              :disabled="page >= pages"
              @click="goToPage(page + 1)"
              class="h-8 px-3 rounded-lg border border-gray-300 hover:border-[#E91E8C] hover:text-[#E91E8C] transition-colors disabled:opacity-40 disabled:pointer-events-none"
            >
              Siguiente →
            </button>
          </div>
        </div>
      </template>
    </div>
  </AppLayout>
</template>
