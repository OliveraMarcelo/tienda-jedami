<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import AdminLayout from '@/layouts/AdminLayout.vue'
import OrderPaymentActions from '@/components/features/admin/OrderPaymentActions.vue'
import DateRangeFilter from '@/components/features/admin/DateRangeFilter.vue'
import SearchField from '@/components/features/admin/SearchField.vue'
import TablePagination from '@/components/features/admin/TablePagination.vue'
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

function patch(p: AdminPayment, changes: Partial<AdminPayment>) {
  Object.assign(p, changes)
}

onMounted(loadPayments)

const hasFilters = () => !!(filterStatus.value || filterSearch.value || filterRange.value.from || filterRange.value.to)
function clearFilters() {
  filterStatus.value = ''
  filterSearch.value = ''
  filterRange.value = { ...EMPTY_RANGE }
}

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
    <div>
      <h1 class="text-[26px] font-bold mb-5">Pagos</h1>

      <div class="overflow-visible rounded-xl border border-[var(--a-border)] bg-white">
        <!-- Filtros: se aplican al cambiar -->
        <div class="grid grid-cols-1 gap-3 border-b border-[var(--a-border)] p-4 sm:grid-cols-2 lg:grid-cols-[minmax(220px,1.3fr)_minmax(180px,1fr)_minmax(230px,1fr)_auto] lg:items-end">
          <SearchField v-model="filterSearch" label="Buscar" placeholder="Email o número de pedido" />
          <div>
            <label for="f-status" class="block text-xs text-[var(--a-muted)] mb-1">Estado del pedido</label>
            <select id="f-status" v-model="filterStatus" class="h-10 w-full rounded-lg border border-[#C9CDD2] px-2 text-sm focus:outline-none">
              <option value="">Todos</option>
              <option v-for="(st, code) in ORDER_STATUS" :key="code" :value="code">{{ st.label }}</option>
            </select>
          </div>
          <DateRangeFilter v-model="filterRange" label="Fecha del pedido" />
          <button
            v-if="hasFilters()"
            type="button"
            class="h-10 rounded-lg px-3 text-sm font-medium text-[var(--a-muted)] hover:bg-[var(--a-bg)] hover:text-[var(--a-ink)]"
            @click="clearFilters"
          >Limpiar filtros</button>
        </div>

        <div v-if="!loaded" class="space-y-2 p-4">
          <div v-for="i in 6" :key="i" class="h-12 animate-pulse rounded-lg bg-[var(--a-bg)]"></div>
        </div>

        <p v-else-if="error" class="p-4 text-sm text-red-500">{{ error }}</p>

        <div v-else :class="['transition-opacity duration-200', loading ? 'opacity-50' : 'opacity-100']">
          <p v-if="payments.length === 0" class="px-4 py-10 text-center text-sm text-[var(--a-muted)]">
            No hay pedidos con estos filtros.
          </p>

          <!-- Celular: tarjetas -->
          <ul v-if="payments.length" :key="`m-${page}`" class="jd-stagger divide-y divide-[var(--a-border)] md:hidden">
            <li v-for="p in payments" :key="p.orderId" class="p-4">
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
          <div v-if="payments.length" class="hidden overflow-x-auto overflow-y-hidden md:block">
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
              <tbody :key="`d-${page}`" class="jd-stagger">
                <tr v-for="p in payments" :key="p.orderId" class="border-b border-[var(--a-border)] last:border-0 align-top hover:bg-[var(--a-bg)] transition-colors">
                  <td class="px-4 py-3">
                    <p class="font-semibold text-[var(--a-ink)]">#{{ p.orderId }}</p>
                    <p class="whitespace-nowrap text-xs text-[var(--a-muted)]">{{ configStore.purchaseTypeLabel[p.purchaseType] ?? p.purchaseType }}</p>
                  </td>
                  <td class="px-4 py-3 max-w-[280px]">
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

          <TablePagination v-model:page="page" :total="total" noun="pedidos" />
        </div>
      </div>
    </div>
  </AdminLayout>
</template>
