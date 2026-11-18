<script setup lang="ts">
// Pagos: una fila por pedido, de una sola línea para que las 10 entren sin scroll.
// El detalle (nota, número de operación, acciones) se abre en un panel al costado.
import { ref, computed, onMounted, watch } from 'vue'
import AdminLayout from '@/layouts/AdminLayout.vue'
import OrderPaymentActions from '@/components/features/admin/OrderPaymentActions.vue'
import DateRangeFilter from '@/components/features/admin/DateRangeFilter.vue'
import SearchField from '@/components/features/admin/SearchField.vue'
import TablePagination from '@/components/features/admin/TablePagination.vue'
import SidePanel from '@/components/features/admin/SidePanel.vue'
import { fetchAdminPayments, type AdminPayment } from '@/api/admin.payments.api'
import { useConfigStore } from '@/stores/config.store'
import { PAGE_SIZE, EMPTY_RANGE, rangeToIso, debounce, type DateRange } from '@/lib/date-range'

const configStore = useConfigStore()

const loading = ref(true)
const loaded = ref(false)
const error = ref('')
const payments = ref<AdminPayment[]>([])
const page = ref(1)
const total = ref(0)

// Filtros: se aplican solos al cambiar
const filterStatus = ref('')
const filterRange = ref<DateRange>({ ...EMPTY_RANGE })
const filterSearch = ref('')

// Si llegan dos respuestas desordenadas, vale la del último pedido
let requestId = 0

async function loadPayments() {
  const id = ++requestId
  loading.value = true
  error.value = ''
  try {
    const res = await fetchAdminPayments({
      page: page.value,
      limit: PAGE_SIZE,
      status: filterStatus.value || undefined,
      search: filterSearch.value.trim() || undefined,
      ...rangeToIso(filterRange.value),
    })
    if (id !== requestId) return
    payments.value = res.payments
    total.value = res.pagination.total
  } catch {
    if (id === requestId) error.value = 'Error al cargar los pagos.'
  } finally {
    if (id === requestId) {
      loading.value = false
      loaded.value = true
    }
  }
}

function reload() {
  page.value = 1
  loadPayments()
}

watch([filterStatus, filterRange], reload)
watch(filterSearch, debounce(reload, 350))
watch(page, loadPayments)
onMounted(loadPayments)

const hasFilters = computed(() => !!(filterStatus.value || filterSearch.value || filterRange.value.from || filterRange.value.to))
function clearFilters() {
  filterStatus.value = ''
  filterSearch.value = ''
  filterRange.value = { ...EMPTY_RANGE }
}

// Detalle
const selectedId = ref<number | null>(null)
const selected = computed(() => payments.value.find(p => p.orderId === selectedId.value) ?? null)
const panelOpen = computed({
  get: () => selected.value !== null,
  set: (v) => { if (!v) selectedId.value = null },
})

function patch(p: AdminPayment, changes: Partial<AdminPayment>) {
  Object.assign(p, changes)
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function formatDateTime(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const ORDER_STATUS: Record<string, { label: string; classes: string }> = {
  pending:   { label: 'Pendiente de pago', classes: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  paid:      { label: 'Pagado',            classes: 'bg-green-50 text-green-700 border-green-200' },
  shipped:   { label: 'Despachado',        classes: 'bg-sky-50 text-sky-700 border-sky-200' },
  rejected:  { label: 'Rechazado',         classes: 'bg-red-50 text-red-700 border-red-200' },
  cancelled: { label: 'Cancelado',         classes: 'bg-[var(--a-bg)] text-[var(--a-muted)] border-[var(--a-border)]' },
}

const METHOD_LABELS: Record<string, { label: string; short: string; classes: string }> = {
  mercadopago:   { label: 'Mercado Pago',  short: 'MP',      classes: 'bg-blue-50 text-blue-700 border-blue-200' },
  bank_transfer: { label: 'Transferencia', short: 'Transf.', classes: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  mp_point:      { label: 'Point',         short: 'Point',   classes: 'bg-sky-50 text-sky-700 border-sky-200' },
}

/** Pagado: el medio con el que pagó. Pendiente: los medios que se le ofrecieron. */
function shownMethods(p: AdminPayment): string[] {
  if (!p.paymentMethod) return []
  return p.paymentStatus === 'approved' ? [p.paymentMethod] : (p.methods.length ? p.methods : [p.paymentMethod])
}

/** Hay algo para hacer con este pedido (se marca con un punto en la fila) */
function needsAction(p: AdminPayment) {
  return p.orderStatus === 'paid' || (p.orderStatus === 'pending' && p.methods.includes('bank_transfer'))
}

const copiedOp = ref(false)
async function copyOp(op: string) {
  try {
    await navigator.clipboard.writeText(op)
    copiedOp.value = true
    setTimeout(() => { copiedOp.value = false }, 1500)
  } catch { /* sin soporte */ }
}

const chip = 'inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold'
</script>

<template>
  <AdminLayout title="Pagos">
    <div class="rounded-xl border border-[var(--a-border)] bg-white">
      <!-- Filtros en una sola franja: se aplican al cambiar -->
      <div class="grid grid-cols-1 gap-2 border-b border-[var(--a-border)] p-3 sm:grid-cols-2 lg:grid-cols-[minmax(220px,1.4fr)_minmax(170px,1fr)_minmax(220px,1fr)_auto]">
        <SearchField v-model="filterSearch" compact label="Buscar pedido" placeholder="Buscar por email o número de pedido" />
        <select v-model="filterStatus" aria-label="Estado del pedido" class="h-10 w-full rounded-lg border border-[#C9CDD2] px-2 text-sm focus:outline-none">
          <option value="">Todos los estados</option>
          <option v-for="(st, code) in ORDER_STATUS" :key="code" :value="code">{{ st.label }}</option>
        </select>
        <DateRangeFilter v-model="filterRange" compact label="Fecha del pedido" />
        <button
          v-if="hasFilters"
          type="button"
          class="h-10 rounded-lg px-3 text-sm font-medium text-[var(--a-muted)] hover:bg-[var(--a-bg)] hover:text-[var(--a-ink)]"
          @click="clearFilters"
        >Limpiar</button>
      </div>

      <div v-if="!loaded" class="space-y-2 p-3">
        <div v-for="i in 8" :key="i" class="h-10 animate-pulse rounded-lg bg-[var(--a-bg)]"></div>
      </div>

      <p v-else-if="error" class="p-4 text-sm text-red-500">{{ error }}</p>

      <div v-else :class="['transition-opacity duration-200', loading ? 'opacity-50' : 'opacity-100']">
        <p v-if="payments.length === 0" class="px-4 py-10 text-center text-sm text-[var(--a-muted)]">
          No hay pedidos con estos filtros.
        </p>

        <!-- Celular: una línea por pedido -->
        <ul v-if="payments.length" :key="`m-${page}`" class="jd-stagger divide-y divide-[var(--a-border)] md:hidden">
          <li v-for="p in payments" :key="p.orderId">
            <button type="button" class="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[var(--a-bg)]" @click="selectedId = p.orderId">
              <div class="min-w-0 flex-1">
                <p class="flex items-center gap-1.5 text-sm font-semibold">
                  #{{ p.orderId }}
                  <span :class="[chip, ORDER_STATUS[p.orderStatus]?.classes]">{{ ORDER_STATUS[p.orderStatus]?.label ?? p.orderStatus }}</span>
                </p>
                <p class="truncate text-xs text-[var(--a-muted)]">{{ p.customerEmail }} · {{ formatDate(p.paidAt ?? p.createdAt) }}</p>
              </div>
              <span class="shrink-0 text-sm font-semibold">{{ formatCurrency(p.totalAmount) }}</span>
              <svg class="h-4 w-4 shrink-0 text-[var(--a-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
            </button>
          </li>
        </ul>

        <!-- Compu: tabla de una línea por fila; tocar la fila abre el detalle -->
        <div v-if="payments.length" class="hidden overflow-x-auto overflow-y-hidden md:block">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-[var(--a-border)] text-left">
                <th class="px-4 py-2.5">Pedido</th>
                <th class="px-4 py-2.5">Cliente</th>
                <th class="px-4 py-2.5 text-right">Monto</th>
                <th class="px-4 py-2.5">Estado</th>
                <th class="px-4 py-2.5">Medio</th>
                <th class="px-4 py-2.5">Fecha</th>
                <th class="w-10 px-2 py-2.5"><span class="sr-only">Detalle</span></th>
              </tr>
            </thead>
            <tbody :key="`d-${page}`" class="jd-stagger">
              <tr
                v-for="p in payments"
                :key="p.orderId"
                tabindex="0"
                :aria-label="`Ver pedido ${p.orderId}`"
                :class="['h-12 cursor-pointer border-b border-[var(--a-border)] last:border-0 hover:bg-[var(--a-bg)]', selectedId === p.orderId ? 'bg-[var(--a-primary-soft)]' : '']"
                @click="selectedId = p.orderId"
                @keydown.enter="selectedId = p.orderId"
              >
                <td class="whitespace-nowrap px-4">
                  <span class="font-semibold">#{{ p.orderId }}</span>
                  <span class="ml-1.5 text-xs text-[var(--a-muted)]">{{ configStore.purchaseTypeLabel[p.purchaseType] ?? p.purchaseType }}</span>
                </td>
                <td class="max-w-[260px] px-4">
                  <span class="block truncate" :title="p.customerEmail">{{ p.customerEmail }}</span>
                </td>
                <td class="whitespace-nowrap px-4 text-right font-semibold">{{ formatCurrency(p.totalAmount) }}</td>
                <td class="whitespace-nowrap px-4">
                  <span :class="[chip, ORDER_STATUS[p.orderStatus]?.classes]">{{ ORDER_STATUS[p.orderStatus]?.label ?? p.orderStatus }}</span>
                  <span v-if="needsAction(p)" class="ml-1.5 inline-block h-2 w-2 rounded-full bg-[var(--a-primary)] align-middle" title="Tiene algo para hacer"></span>
                </td>
                <td class="whitespace-nowrap px-4">
                  <span v-for="m in shownMethods(p)" :key="m" :class="[chip, 'mr-1', METHOD_LABELS[m]?.classes]" :title="METHOD_LABELS[m]?.label">{{ METHOD_LABELS[m]?.short ?? m }}</span>
                  <span v-if="!shownMethods(p).length" class="text-xs text-[var(--a-muted)]">—</span>
                </td>
                <td class="whitespace-nowrap px-4 text-[var(--a-muted)]">{{ formatDate(p.paidAt ?? p.createdAt) }}</td>
                <td class="px-2 text-[var(--a-muted)]">
                  <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <TablePagination v-model:page="page" :total="total" noun="pedidos" />
      </div>
    </div>

    <!-- Detalle del pedido -->
    <SidePanel
      v-model:open="panelOpen"
      :title="selected ? `Pedido #${selected.orderId}` : ''"
      :subtitle="selected ? (configStore.purchaseTypeLabel[selected.purchaseType] ?? selected.purchaseType) : ''"
    >
      <div v-if="selected" class="space-y-5 text-sm">
        <div class="flex items-center justify-between gap-3">
          <span :class="[chip, ORDER_STATUS[selected.orderStatus]?.classes]">{{ ORDER_STATUS[selected.orderStatus]?.label ?? selected.orderStatus }}</span>
          <span class="text-xl font-bold">{{ formatCurrency(selected.totalAmount) }}</span>
        </div>

        <dl class="grid grid-cols-[130px_1fr] items-baseline gap-x-3 gap-y-2.5">
          <dt class="text-[var(--a-muted)]">Cliente</dt>
          <dd class="break-all">{{ selected.customerEmail }}</dd>
          <dt class="text-[var(--a-muted)]">Pedido</dt>
          <dd>{{ formatDateTime(selected.createdAt) }}</dd>
          <template v-if="selected.paidAt">
            <dt class="text-[var(--a-muted)]">Pagado</dt>
            <dd>{{ formatDateTime(selected.paidAt) }}</dd>
          </template>
          <dt class="text-[var(--a-muted)]">{{ selected.paymentStatus === 'approved' ? 'Pagó con' : 'Medios ofrecidos' }}</dt>
          <dd class="flex flex-wrap items-start gap-1">
            <span v-for="m in shownMethods(selected)" :key="m" :class="[chip, METHOD_LABELS[m]?.classes]">{{ METHOD_LABELS[m]?.label ?? m }}</span>
            <span v-if="!shownMethods(selected).length" class="text-[var(--a-muted)]">Todavía no inició un pago</span>
          </dd>
          <template v-if="selected.mpPaymentId">
            <dt class="text-[var(--a-muted)]">Operación MP</dt>
            <dd>
              <button type="button" class="font-mono hover:underline" title="Copiar número de operación" @click="copyOp(selected.mpPaymentId)">{{ selected.mpPaymentId }}</button>
              <span v-if="copiedOp" class="ml-2 text-xs font-semibold text-green-700">✓ Copiado</span>
            </dd>
          </template>
        </dl>

        <p v-if="selected.notes" class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
          <span class="block text-xs font-semibold uppercase tracking-wide">Nota del cliente</span>
          {{ selected.notes }}
        </p>

        <section>
          <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--a-muted)]">Acciones</h3>
          <OrderPaymentActions stacked :payment="selected" @changed="patch(selected, $event)" />
          <p
            v-if="!['pending', 'paid', 'rejected'].includes(selected.orderStatus)"
            class="text-[var(--a-muted)]"
          >No hay nada para hacer con este pedido.</p>
        </section>
      </div>
    </SidePanel>
  </AdminLayout>
</template>
