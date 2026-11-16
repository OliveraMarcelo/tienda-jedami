<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import AdminLayout from '@/layouts/AdminLayout.vue'
import OrderPaymentActions from '@/components/features/admin/OrderPaymentActions.vue'
import { fetchAdminPayments, type AdminPayment } from '@/api/admin.payments.api'
import { useConfigStore } from '@/stores/config.store'

const configStore = useConfigStore()

const loading = ref(true)
const error = ref('')
const payments = ref<AdminPayment[]>([])
const page = ref(1)
const limit = 20
const total = ref(0)
const pages = computed(() => Math.ceil(total.value / limit))

// Filtros (por estado del pedido)
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

function patch(p: AdminPayment, changes: Partial<AdminPayment>) {
  Object.assign(p, changes)
}

onMounted(loadPayments)

function formatCurrency(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

const ORDER_STATUS: Record<string, { label: string; classes: string }> = {
  pending:   { label: 'Pendiente de pago', classes: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  paid:      { label: 'Pagado',            classes: 'bg-green-50 text-green-700 border-green-200' },
  shipped:   { label: 'Despachado',        classes: 'bg-sky-50 text-sky-700 border-sky-200' },
  rejected:  { label: 'Rechazado',         classes: 'bg-red-50 text-red-700 border-red-200' },
  cancelled: { label: 'Cancelado',         classes: 'bg-[var(--a-bg)] text-[var(--a-muted)] border-[var(--a-border)]' },
}

const METHOD_LABELS: Record<string, { label: string; classes: string }> = {
  mercadopago:   { label: 'Mercado Pago',  classes: 'bg-blue-50 text-blue-700 border-blue-200' },
  bank_transfer: { label: 'Transferencia', classes: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  mp_point:      { label: 'Point',         classes: 'bg-sky-50 text-sky-700 border-sky-200' },
}

/** Pagado: el medio con el que pagó. Pendiente: los medios que se le ofrecieron. */
function shownMethods(p: AdminPayment): string[] {
  if (!p.paymentMethod) return []
  return p.paymentStatus === 'approved' ? [p.paymentMethod] : (p.methods.length ? p.methods : [p.paymentMethod])
}

const copiedOp = ref<string | null>(null)
async function copyOp(op: string) {
  try {
    await navigator.clipboard.writeText(op)
    copiedOp.value = op
    setTimeout(() => { copiedOp.value = null }, 1500)
  } catch { /* sin soporte */ }
}
</script>

<template>
  <AdminLayout>
    <div class="max-w-5xl">
      <h1 class="text-[26px] font-bold mb-6">Pagos</h1>

      <!-- Filtros -->
      <div class="bg-white rounded-xl border border-[var(--a-border)] p-4 mb-4 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end">
        <div class="col-span-2 sm:col-span-1">
          <label for="f-status" class="block text-xs text-[var(--a-muted)] mb-1">Estado del pedido</label>
          <select
            id="f-status"
            v-model="filterStatus"
            class="h-10 w-full rounded-lg border border-[#C9CDD2] px-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--a-primary)]"
          >
            <option value="">Todos</option>
            <option v-for="(s, code) in ORDER_STATUS" :key="code" :value="code">{{ s.label }}</option>
          </select>
        </div>
        <div>
          <label for="f-from" class="block text-xs text-[var(--a-muted)] mb-1">Desde</label>
          <input id="f-from" v-model="filterDateFrom" type="date"
            class="h-10 w-full rounded-lg border border-[#C9CDD2] px-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--a-primary)]" />
        </div>
        <div>
          <label for="f-to" class="block text-xs text-[var(--a-muted)] mb-1">Hasta</label>
          <input id="f-to" v-model="filterDateTo" type="date"
            class="h-10 w-full rounded-lg border border-[#C9CDD2] px-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--a-primary)]" />
        </div>
        <button
          type="button"
          class="col-span-2 h-10 px-4 rounded-lg bg-[var(--a-primary)] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
          @click="applyFilters"
        >Filtrar</button>
      </div>

      <div v-if="loading" class="space-y-3">
        <div v-for="i in 5" :key="i" class="animate-pulse bg-white rounded-xl border border-[var(--a-border)] h-14"></div>
      </div>

      <p v-else-if="error" class="text-red-500 text-sm">{{ error }}</p>

      <template v-else>
        <p v-if="payments.length === 0" class="bg-white rounded-xl border border-[var(--a-border)] px-4 py-8 text-center text-[var(--a-muted)] text-sm mb-4">
          No hay pagos para mostrar.
        </p>

        <!-- Celular: tarjetas -->
        <ul v-if="payments.length" class="md:hidden space-y-3 mb-4">
          <li v-for="p in payments" :key="p.orderId" class="bg-white rounded-xl border border-[var(--a-border)] p-4">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="font-semibold text-[var(--a-ink)]">
                  Pedido #{{ p.orderId }}
                  <span class="font-normal text-[var(--a-muted)]">· {{ configStore.purchaseTypeLabel[p.purchaseType] ?? p.purchaseType }}</span>
                </p>
                <p class="text-sm text-[var(--a-muted)] truncate">{{ p.customerEmail }}</p>
              </div>
              <p class="font-semibold text-[var(--a-ink)] shrink-0">{{ formatCurrency(p.totalAmount) }}</p>
            </div>
            <p v-if="p.notes" class="text-xs text-amber-600 italic mt-1">"{{ p.notes }}"</p>
            <div class="flex flex-wrap items-center gap-1.5 mt-3">
              <span class="inline-flex rounded-full px-2 py-0.5 text-xs font-semibold border" :class="ORDER_STATUS[p.orderStatus]?.classes">
                {{ ORDER_STATUS[p.orderStatus]?.label ?? p.orderStatus }}
              </span>
              <span v-for="m in shownMethods(p)" :key="m" class="inline-flex rounded-full px-2 py-0.5 text-xs font-semibold border" :class="METHOD_LABELS[m]?.classes">
                {{ METHOD_LABELS[m]?.label ?? m }}
              </span>
              <span v-if="!shownMethods(p).length" class="text-xs text-[var(--a-muted)]">Sin pago iniciado</span>
              <span class="text-xs text-[var(--a-muted)] ml-auto">{{ formatDate(p.paidAt ?? p.createdAt) }}</span>
            </div>
            <div class="mt-3 pt-3 border-t border-[var(--a-border)]">
              <OrderPaymentActions :payment="p" @changed="patch(p, $event)" />
            </div>
          </li>
        </ul>

        <!-- Compu: tabla -->
        <div v-if="payments.length" class="hidden md:block bg-white rounded-xl border border-[var(--a-border)] overflow-hidden mb-4">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-xs text-[var(--a-muted)] border-b border-[var(--a-border)]">
                <th class="px-4 py-3 font-medium">Pedido</th>
                <th class="px-4 py-3 font-medium">Cliente</th>
                <th class="px-4 py-3 font-medium text-right">Monto</th>
                <th class="px-4 py-3 font-medium">Estado</th>
                <th class="px-4 py-3 font-medium">Medio</th>
                <th class="px-4 py-3 font-medium">Fecha</th>
                <th class="px-4 py-3 font-medium w-[200px]">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in payments" :key="p.orderId" class="border-b border-[var(--a-border)] last:border-0 align-top hover:bg-[var(--a-bg)] transition-colors">
                <td class="px-4 py-3">
                  <p class="font-semibold text-[var(--a-ink)]">#{{ p.orderId }}</p>
                  <p class="whitespace-nowrap text-xs text-[var(--a-muted)]">{{ configStore.purchaseTypeLabel[p.purchaseType] ?? p.purchaseType }}</p>
                </td>
                <td class="px-4 py-3 max-w-[220px]">
                  <p class="text-[var(--a-ink)] truncate" :title="p.customerEmail">{{ p.customerEmail }}</p>
                  <p v-if="p.notes" class="text-xs text-amber-600 italic truncate mt-0.5" :title="p.notes">"{{ p.notes }}"</p>
                </td>
                <td class="px-4 py-3 text-right font-semibold text-[var(--a-ink)] whitespace-nowrap">{{ formatCurrency(p.totalAmount) }}</td>
                <td class="px-4 py-3">
                  <span class="inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold border" :class="ORDER_STATUS[p.orderStatus]?.classes">
                    {{ ORDER_STATUS[p.orderStatus]?.label ?? p.orderStatus }}
                  </span>
                </td>
                <td class="px-4 py-3">
                  <div class="flex flex-wrap gap-1">
                    <span v-for="m in shownMethods(p)" :key="m" class="inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold border" :class="METHOD_LABELS[m]?.classes">
                      {{ METHOD_LABELS[m]?.label ?? m }}
                    </span>
                    <span v-if="!shownMethods(p).length" class="text-xs text-[var(--a-muted)]">Sin pago iniciado</span>
                  </div>
                  <button
                    v-if="p.mpPaymentId"
                    type="button"
                    class="mt-1 block whitespace-nowrap font-mono text-xs text-[var(--a-muted)] hover:text-[var(--a-ink)]"
                    title="Copiar número de operación"
                    @click="copyOp(p.mpPaymentId)"
                  >Op. {{ p.mpPaymentId }}<span v-if="copiedOp === p.mpPaymentId" class="ml-1 font-sans text-green-700">✓</span></button>
                </td>
                <td class="px-4 py-3 text-[var(--a-muted)] whitespace-nowrap">{{ formatDate(p.paidAt ?? p.createdAt) }}</td>
                <td class="px-4 py-3">
                  <OrderPaymentActions :payment="p" @changed="patch(p, $event)" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Paginación -->
        <div class="flex items-center justify-between gap-3 text-sm text-[var(--a-muted)]">
          <span>{{ total }} pedidos · Página {{ page }} de {{ pages || 1 }}</span>
          <div class="flex gap-2 shrink-0">
            <button
              type="button"
              :disabled="page <= 1"
              class="h-8 px-3 rounded-lg border border-[#C9CDD2] hover:border-[var(--a-primary)] hover:text-[var(--a-primary)] transition-colors disabled:opacity-40 disabled:pointer-events-none"
              @click="goToPage(page - 1)"
            >←<span class="hidden sm:inline"> Anterior</span></button>
            <button
              type="button"
              :disabled="page >= pages"
              class="h-8 px-3 rounded-lg border border-[#C9CDD2] hover:border-[var(--a-primary)] hover:text-[var(--a-primary)] transition-colors disabled:opacity-40 disabled:pointer-events-none"
              @click="goToPage(page + 1)"
            ><span class="hidden sm:inline">Siguiente </span>→</button>
          </div>
        </div>
      </template>
    </div>
  </AdminLayout>
</template>
