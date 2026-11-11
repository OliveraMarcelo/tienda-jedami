<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import AdminLayout from '@/layouts/AdminLayout.vue'
import { fetchAdminPayments, confirmBankTransfer, type AdminPayment } from '@/api/admin.payments.api'
import { cancelOrder } from '@/api/orders.api'
import { retryPayment } from '@/api/payments.api'
import { useConfigStore } from '@/stores/config.store'

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

const METHOD_LABELS: Record<string, { label: string; classes: string }> = {
  mercadopago:   { label: 'Mercado Pago',  classes: 'bg-blue-50 text-blue-700 border-blue-200' },
  bank_transfer: { label: 'Transferencia', classes: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  mp_point:      { label: 'Point',         classes: 'bg-sky-50 text-sky-700 border-sky-200' },
}

// Intento pendiente de un pedido que ya se pagó por otro medio/intento o que se canceló
function isStale(p: AdminPayment) {
  return p.paymentStatus === 'pending' && (p.orderStatus === 'paid' || p.orderStatus === 'cancelled')
}

const copiedOp = ref<string | null>(null)
async function copyOp(op: string) {
  try {
    await navigator.clipboard.writeText(op)
    copiedOp.value = op
    setTimeout(() => { copiedOp.value = null }, 1500)
  } catch { /* sin soporte */ }
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
  <AdminLayout>
    <div class="max-w-5xl">
      <!-- Breadcrumb -->
      <div class="flex items-center gap-3 mb-6">
        <h1 class="text-[26px] font-bold">Pagos</h1>
      </div>

      <!-- Filtros -->
      <div class="bg-white rounded-xl border border-[var(--a-border)] p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div>
          <label class="block text-xs text-[var(--a-muted)] mb-1">Estado</label>
          <select
            v-model="filterStatus"
            class="h-10 rounded-lg border border-[#C9CDD2] px-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--a-primary)]"
          >
            <option value="">Todos</option>
            <option value="approved">Aprobado</option>
            <option value="pending">Pendiente</option>
            <option value="rejected">Rechazado</option>
          </select>
        </div>
        <div>
          <label class="block text-xs text-[var(--a-muted)] mb-1">Desde</label>
          <input
            v-model="filterDateFrom"
            type="date"
            class="h-10 rounded-lg border border-[#C9CDD2] px-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--a-primary)]"
          />
        </div>
        <div>
          <label class="block text-xs text-[var(--a-muted)] mb-1">Hasta</label>
          <input
            v-model="filterDateTo"
            type="date"
            class="h-10 rounded-lg border border-[#C9CDD2] px-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--a-primary)]"
          />
        </div>
        <button
          @click="applyFilters"
          class="h-10 px-4 rounded-lg bg-[var(--a-primary)] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          Filtrar
        </button>
      </div>

      <!-- Skeleton -->
      <div v-if="loading" class="space-y-3">
        <div v-for="i in 5" :key="i" class="animate-pulse bg-white rounded-xl border border-[var(--a-border)] h-14"></div>
      </div>

      <p v-else-if="error" class="text-red-500 text-sm">{{ error }}</p>

      <template v-else>
        <!-- Tabla -->
        <div class="bg-white rounded-xl border border-[var(--a-border)] overflow-hidden mb-4">
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="text-left text-xs text-[var(--a-muted)] border-b border-[var(--a-border)]">
                  <th class="px-4 py-3 font-medium">Pedido</th>
                  <th class="px-4 py-3 font-medium">Cliente</th>
                  <th class="px-4 py-3 font-medium">Tipo compra</th>
                  <th class="px-4 py-3 font-medium text-right">Monto</th>
                  <th class="px-4 py-3 font-medium">Método</th>
                  <th class="px-4 py-3 font-medium">Estado</th>
                  <th class="px-4 py-3 font-medium">Fecha</th>
                  <th class="px-4 py-3 font-medium min-w-[160px]">Acciones</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="p in payments"
                  :key="p.id"
                  class="border-b border-[var(--a-border)] hover:bg-[var(--a-bg)] transition-colors"
                >
                  <td class="px-4 py-3 font-semibold text-[var(--a-ink)]">#{{ p.orderId }}</td>
                  <td class="px-4 py-3 max-w-[220px]">
                    <p class="text-[var(--a-ink)] truncate">{{ p.customerEmail }}</p>
                    <p v-if="p.notes" class="text-xs text-amber-600 italic truncate mt-0.5" :title="p.notes">
                      "{{ p.notes }}"
                    </p>
                  </td>
                  <td class="px-4 py-3 text-[var(--a-muted)]">{{ configStore.purchaseTypeLabel[p.purchaseType] ?? p.purchaseType }}</td>
                  <td class="px-4 py-3 text-right font-semibold text-[var(--a-ink)]">{{ formatCurrency(p.totalAmount) }}</td>
                  <td class="px-4 py-3">
                    <span
                      class="inline-flex rounded-full px-2 py-0.5 text-xs font-semibold border"
                      :class="METHOD_LABELS[p.paymentMethod]?.classes ?? 'bg-blue-50 text-blue-700 border-blue-200'"
                    >
                      {{ METHOD_LABELS[p.paymentMethod]?.label ?? 'Mercado Pago' }}
                    </span>
                    <button
                      v-if="p.mpPaymentId"
                      type="button"
                      class="mt-1 block font-mono text-xs text-[var(--a-muted)] hover:text-[var(--a-ink)]"
                      :title="'Copiar número de operación'"
                      @click="copyOp(p.mpPaymentId)"
                    >
                      Op. {{ p.mpPaymentId }}<span v-if="copiedOp === p.mpPaymentId" class="ml-1 font-sans text-green-700">✓</span>
                    </button>
                  </td>
                  <td class="px-4 py-3">
                    <span
                      v-if="isStale(p)"
                      class="inline-flex rounded-full border border-[var(--a-border)] bg-[var(--a-bg)] px-2 py-0.5 text-xs font-semibold text-[var(--a-muted)]"
                      :title="p.orderStatus === 'paid' ? 'El pedido se pagó con otro intento' : 'El pedido fue cancelado'"
                    >
                      {{ p.orderStatus === 'paid' ? 'Sin usar' : 'Pedido cancelado' }}
                    </span>
                    <span
                      v-else
                      class="inline-flex rounded-full px-2 py-0.5 text-xs font-semibold border"
                      :class="paymentStatusColors[p.paymentStatus] ?? 'bg-[var(--a-bg)] text-[var(--a-muted)] border-[var(--a-border)]'"
                    >
                      {{ paymentStatusLabels[p.paymentStatus] ?? p.paymentStatus }}
                    </span>
                  </td>
                  <td class="px-4 py-3 text-[var(--a-muted)]">{{ formatDate(p.paidAt) }}</td>
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
                          <p class="text-xs text-[var(--a-muted)]">¿Confirmar?</p>
                          <div class="flex gap-2">
                            <button @click="doCancel(p.orderId)" class="text-xs text-red-600 font-semibold hover:underline">Sí</button>
                            <button @click="confirmingCancel = null" class="text-xs text-[var(--a-muted)] hover:underline">No</button>
                          </div>
                          <p v-if="cancelError[p.orderId]" class="text-xs text-red-500">{{ cancelError[p.orderId] }}</p>
                        </div>
                      </template>
                      <!-- Confirmar transferencia -->
                      <template v-if="p.paymentMethod === 'bank_transfer' && p.paymentStatus === 'pending' && !isStale(p)">
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
                  <td colspan="8" class="px-4 py-8 text-center text-[var(--a-muted)] text-sm">No hay pagos para mostrar.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Paginación -->
        <div class="flex items-center justify-between text-sm text-[var(--a-muted)]">
          <span>{{ total }} resultados — Página {{ page }} de {{ pages || 1 }}</span>
          <div class="flex gap-2">
            <button
              :disabled="page <= 1"
              @click="goToPage(page - 1)"
              class="h-8 px-3 rounded-lg border border-[#C9CDD2] hover:border-[var(--a-primary)] hover:text-[var(--a-primary)] transition-colors disabled:opacity-40 disabled:pointer-events-none"
            >
              ← Anterior
            </button>
            <button
              :disabled="page >= pages"
              @click="goToPage(page + 1)"
              class="h-8 px-3 rounded-lg border border-[#C9CDD2] hover:border-[var(--a-primary)] hover:text-[var(--a-primary)] transition-colors disabled:opacity-40 disabled:pointer-events-none"
            >
              Siguiente →
            </button>
          </div>
        </div>
      </template>
    </div>
  </AdminLayout>
</template>
