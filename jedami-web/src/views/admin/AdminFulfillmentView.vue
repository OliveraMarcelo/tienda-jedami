<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted } from 'vue'
import AdminLayout from '@/layouts/AdminLayout.vue'
import DateRangeFilter from '@/components/features/admin/DateRangeFilter.vue'
import SearchField from '@/components/features/admin/SearchField.vue'
import TablePagination from '@/components/features/admin/TablePagination.vue'
import { PAGE_SIZE, EMPTY_RANGE, inRange, type DateRange } from '@/lib/date-range'
import { apiErrorDetail } from '@/lib/auth-errors'
import {
  fetchPendingFulfillment,
  dispatchOrder,
  type PendingOrder,
  type PendingProduct,
} from '@/api/admin.fulfillment.api'
import {
  type Cells,
  needsAllocation,
  sizeTargets,
  freeUnits,
  gridSizes,
  totalTarget,
  rowAssigned,
  totalAssigned,
  problems,
  autoFill,
  toAllocations,
} from '@/lib/fulfillment'

const loading = ref(true)
const error = ref('')
const orders = ref<PendingOrder[]>([])
const toast = ref('')

// Grilla de cada producto de cada pedido: `${orderId}-${productId}` → unidades por variante
const grids = reactive<Record<string, Cells>>({})
const dispatching = ref<number | null>(null)
const dispatchErrors = ref<Record<number, string>>({})

const key = (o: PendingOrder, p: PendingProduct) => `${o.id}-${p.productId}`
const EMPTY: Cells = {}
const cellsOf = (o: PendingOrder, p: PendingProduct) => grids[key(o, p)] ?? EMPTY

async function load() {
  loading.value = true
  error.value = ''
  try {
    orders.value = await fetchPendingFulfillment()
    for (const o of orders.value) for (const p of o.products) grids[key(o, p)] ??= {}
  } catch {
    error.value = 'Error al cargar los pedidos para despachar.'
  } finally {
    loading.value = false
  }
}

const variantAt = (p: PendingProduct, sizeId: number, colorId: number) =>
  p.variants.find(v => v.sizeId === sizeId && v.colorId === colorId)

function setCell(o: PendingOrder, p: PendingProduct, variantId: number, value: string) {
  const n = Math.max(0, Math.floor(Number(value) || 0))
  grids[key(o, p)] = { ...grids[key(o, p)], [variantId]: n }
}

function suggest(o: PendingOrder, p: PendingProduct) {
  grids[key(o, p)] = autoFill(p)
}

function clearGrid(o: PendingOrder, p: PendingProduct) {
  grids[key(o, p)] = {}
}

function orderProblems(o: PendingOrder) {
  return o.products.flatMap(p => problems(p, cellsOf(o, p)).map(msg => `${p.productName} — ${msg}`))
}

/** Línea minorista: talle y color ya elegidos por el cliente */
function retailLabel(p: PendingProduct, variantId: number) {
  const v = p.variants.find(x => x.id === variantId)
  if (!v) return 'Variante no disponible'
  const size = p.sizes.find(s => s.id === v.sizeId)?.label
  const color = p.colors.find(c => c.id === v.colorId)
  return `Talle ${size} · ${color?.name ?? ''}`
}
const retailHex = (p: PendingProduct, variantId: number) => {
  const v = p.variants.find(x => x.id === variantId)
  return p.colors.find(c => c.id === v?.colorId)?.hexCode ?? '#ccc'
}

async function doDispatch(o: PendingOrder) {
  if (orderProblems(o).length > 0) return
  dispatching.value = o.id
  dispatchErrors.value[o.id] = ''
  try {
    const allocations = o.products.filter(needsAllocation).flatMap(p => toAllocations(p, cellsOf(o, p)))
    await dispatchOrder(o.id, allocations)
    orders.value = orders.value.filter(x => x.id !== o.id)
    toast.value = `Pedido #${o.id} despachado y stock actualizado`
    setTimeout(() => { toast.value = '' }, 3500)
  } catch (e: unknown) {
    dispatchErrors.value[o.id] = apiErrorDetail(e, 'Error al despachar')
  } finally {
    dispatching.value = null
  }
}

const typeLabel = (t: string) => ({ curva: 'Curva', cantidad: 'Cantidad', retail: 'Minorista' } as Record<string, string>)[t] ?? t

function formatCurrency(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

onMounted(load)

// Filtros (en el navegador: ya están todos los pedidos para despachar)
const filterSearch = ref('')
const filterType = ref('')
const filterRange = ref<DateRange>({ ...EMPTY_RANGE })
const page = ref(1)

const filteredOrders = computed(() => {
  const term = filterSearch.value.trim().toLowerCase().replace(/^#/, '')
  return orders.value.filter(o =>
    (!filterType.value || o.purchaseType === filterType.value)
    && inRange(o.createdAt, filterRange.value)
    && (!term || o.customerEmail.toLowerCase().includes(term) || String(o.id) === term),
  )
})
const pagedOrders = computed(() => filteredOrders.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE))
watch([filterSearch, filterType, filterRange], () => { page.value = 1 })
watch(() => filteredOrders.value.length, (n) => {
  const last = Math.max(1, Math.ceil(n / PAGE_SIZE))
  if (page.value > last) page.value = last
})
const hasFilters = computed(() => !!(filterSearch.value || filterType.value || filterRange.value.from || filterRange.value.to))
function clearFilters() {
  filterSearch.value = ''
  filterType.value = ''
  filterRange.value = { ...EMPTY_RANGE }
}
</script>

<template>
  <AdminLayout>
    <div>
      <h1 class="text-[26px] font-bold mb-2">Despacho</h1>
      <p class="text-sm text-[var(--a-muted)] mb-6">
        Pedidos pagados, del más viejo al más nuevo. En curva y cantidad elegí cuántas unidades de cada color mandás:
        al confirmar se descuenta el stock y el pedido queda despachado.
      </p>

      <div
        v-if="toast"
        role="status"
        class="fixed bottom-6 right-6 z-50 rounded-full bg-gray-900 px-5 py-3 text-sm font-semibold text-white shadow-lg"
      >
        ✓ {{ toast }}
      </div>

      <div v-if="loading" class="space-y-4">
        <div v-for="i in 3" :key="i" class="animate-pulse bg-white rounded-xl border border-[var(--a-border)] h-32"></div>
      </div>

      <p v-else-if="error" class="text-red-500 text-sm">{{ error }}</p>

      <p v-else-if="orders.length === 0" class="text-center text-[var(--a-muted)] text-sm py-12">
        No hay pedidos pagados para despachar.
      </p>

      <template v-else>
      <!-- Filtros: se aplican al cambiar -->
      <div class="mb-4 grid grid-cols-1 gap-3 rounded-xl border border-[var(--a-border)] bg-white p-4 sm:grid-cols-2 lg:grid-cols-[minmax(220px,1.3fr)_minmax(160px,1fr)_minmax(230px,1fr)_auto] lg:items-end">
        <SearchField v-model="filterSearch" label="Buscar" placeholder="Email o número de pedido" />
        <div>
          <label for="f-type" class="mb-1 block text-xs text-[var(--a-muted)]">Forma de compra</label>
          <select id="f-type" v-model="filterType" class="h-10 w-full rounded-lg border border-[#C9CDD2] px-2 text-sm focus:outline-none">
            <option value="">Todas</option>
            <option value="curva">Curva</option>
            <option value="cantidad">Cantidad</option>
            <option value="retail">Minorista</option>
          </select>
        </div>
        <DateRangeFilter v-model="filterRange" label="Fecha del pedido" />
        <button
          v-if="hasFilters"
          type="button"
          class="h-10 rounded-lg px-3 text-sm font-medium text-[var(--a-muted)] hover:bg-[var(--a-bg)] hover:text-[var(--a-ink)]"
          @click="clearFilters"
        >Limpiar filtros</button>
      </div>

      <p v-if="filteredOrders.length === 0" class="rounded-xl border border-[var(--a-border)] bg-white py-10 text-center text-sm text-[var(--a-muted)]">
        No hay pedidos con estos filtros.
      </p>

      <div v-else :key="page" class="jd-stagger space-y-6">
        <article
          v-for="order in pagedOrders"
          :key="order.id"
          class="bg-white rounded-xl border border-[var(--a-border)] overflow-hidden"
        >
          <!-- Cabecera -->
          <header class="flex items-start justify-between px-5 py-4 border-b border-[var(--a-border)] bg-[var(--a-bg)] gap-3">
            <div class="min-w-0">
              <div class="flex items-center gap-2 flex-wrap mb-1">
                <p class="font-bold text-[var(--a-ink)]">Pedido #{{ order.id }}</p>
                <span
                  class="text-xs font-semibold px-2 py-0.5 rounded-full"
                  :class="{
                    'bg-purple-100 text-purple-700': order.purchaseType === 'curva',
                    'bg-blue-100 text-blue-700': order.purchaseType === 'cantidad',
                    'bg-gray-100 text-[var(--a-muted)]': order.purchaseType === 'retail',
                  }"
                >{{ typeLabel(order.purchaseType) }}</span>
              </div>
              <p class="text-xs text-[var(--a-muted)] break-all">{{ order.customerEmail }} — {{ formatDate(order.createdAt) }}</p>
              <p v-if="order.notes" class="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 mt-1.5 italic">
                Nota: "{{ order.notes }}"
              </p>
            </div>
            <p class="font-semibold text-[var(--a-ink)] shrink-0">{{ formatCurrency(order.totalAmount) }}</p>
          </header>

          <!-- Productos -->
          <section v-for="p in order.products" :key="p.productId" class="px-5 py-4 border-b border-[var(--a-border)] last:border-0">
            <div class="flex items-center justify-between gap-3 mb-3 flex-wrap">
              <p class="font-medium text-[var(--a-ink)] text-sm">{{ p.productName }}</p>
              <div v-if="needsAllocation(p)" class="flex gap-2">
                <button
                  type="button"
                  class="h-8 px-3 rounded-lg border border-[#C9CDD2] text-xs font-semibold text-[var(--a-ink)] hover:border-gray-400"
                  @click="suggest(order, p)"
                >Sugerir reparto</button>
                <button
                  type="button"
                  class="h-8 px-3 rounded-lg text-xs text-[var(--a-muted)] hover:text-[var(--a-ink)]"
                  @click="clearGrid(order, p)"
                >Limpiar</button>
              </div>
            </div>

            <!-- Minorista: el cliente ya eligió talle y color -->
            <ul v-if="!needsAllocation(p)" class="space-y-1.5">
              <li v-for="l in p.lines" :key="l.id" class="flex items-center gap-2 text-sm text-[#45494E]">
                <span class="w-4 h-4 rounded-full border border-[var(--a-border)] shrink-0" :style="{ backgroundColor: retailHex(p, l.variantId!) }"></span>
                {{ retailLabel(p, l.variantId!) }} — {{ l.quantity }} u.
              </li>
            </ul>

            <!-- Curva / cantidad: grilla talle × color -->
            <template v-else>
              <p v-if="freeUnits(p) > 0" class="text-xs text-[var(--a-muted)] mb-2">
                <template v-if="sizeTargets(p).size > 0">Además de lo de cada talle, </template>
                {{ freeUnits(p) === 1 ? 'hay 1 unidad' : `hay ${freeUnits(p)} unidades` }} a tu elección: sumalas en el talle y color que quieras.
              </p>
              <div class="overflow-x-auto -mx-1 px-1">
                <table class="text-xs border-separate border-spacing-0">
                  <thead>
                    <tr class="text-[var(--a-muted)]">
                      <th class="text-left font-medium pb-2 pr-3 sticky left-0 bg-white">Talle</th>
                      <th v-for="c in p.colors" :key="c.id" class="font-medium pb-2 px-1.5 min-w-[64px]">
                        <span class="inline-flex flex-col items-center gap-1">
                          <span class="w-4 h-4 rounded-full border border-[var(--a-border)]" :style="{ backgroundColor: c.hexCode ?? '#ccc' }"></span>
                          {{ c.name }}
                        </span>
                      </th>
                      <th v-if="sizeTargets(p).size > 0" class="font-medium pb-2 pl-3 text-right">Pedido</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="s in gridSizes(p)" :key="s.id">
                      <td class="py-1 pr-3 font-semibold text-[var(--a-ink)] sticky left-0 bg-white">{{ s.label }}</td>
                      <td v-for="c in p.colors" :key="c.id" class="py-1 px-1.5 text-center">
                        <template v-if="variantAt(p, s.id, c.id)">
                          <input
                            type="number"
                            inputmode="numeric"
                            min="0"
                            :max="variantAt(p, s.id, c.id)!.stock"
                            :value="cellsOf(order, p)[variantAt(p, s.id, c.id)!.id] || ''"
                            :disabled="variantAt(p, s.id, c.id)!.stock === 0"
                            :aria-label="`Talle ${s.label} ${c.name}`"
                            placeholder="0"
                            class="w-14 h-9 rounded-lg border text-center text-sm disabled:bg-gray-50 disabled:opacity-50"
                            :class="(cellsOf(order, p)[variantAt(p, s.id, c.id)!.id] ?? 0) > variantAt(p, s.id, c.id)!.stock ? 'border-red-400 text-red-600' : 'border-[var(--a-border)]'"
                            @input="setCell(order, p, variantAt(p, s.id, c.id)!.id, ($event.target as HTMLInputElement).value)"
                          />
                          <span class="block text-[10px] text-[var(--a-muted)] mt-0.5">stock {{ variantAt(p, s.id, c.id)!.stock }}</span>
                        </template>
                        <span v-else class="text-[var(--a-muted)]">—</span>
                      </td>
                      <td v-if="sizeTargets(p).size > 0" class="py-1 pl-3 text-right whitespace-nowrap font-semibold"
                        :class="rowAssigned(p, cellsOf(order, p), s.id) >= (sizeTargets(p).get(s.id) ?? 0) ? 'text-green-600' : 'text-[var(--a-ink)]'">
                        {{ rowAssigned(p, cellsOf(order, p), s.id) }} / {{ sizeTargets(p).get(s.id) ?? 0 }}
                        <span v-if="rowAssigned(p, cellsOf(order, p), s.id) >= (sizeTargets(p).get(s.id) ?? 0)">✓</span>
                        <span v-if="rowAssigned(p, cellsOf(order, p), s.id) > (sizeTargets(p).get(s.id) ?? 0)" class="block text-[10px] font-normal text-[var(--a-muted)]">
                          +{{ rowAssigned(p, cellsOf(order, p), s.id) - (sizeTargets(p).get(s.id) ?? 0) }} a elección
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p class="mt-2 text-xs font-semibold"
                :class="totalAssigned(p, cellsOf(order, p)) === totalTarget(p) ? 'text-green-600' : 'text-[var(--a-muted)]'">
                Total: {{ totalAssigned(p, cellsOf(order, p)) }} de {{ totalTarget(p) }} unidades
              </p>
            </template>
          </section>

          <!-- Confirmar -->
          <footer class="px-5 py-4 bg-[var(--a-bg)] flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <ul v-if="orderProblems(order).length" class="text-xs text-[var(--a-muted)] space-y-0.5">
              <li v-for="msg in orderProblems(order).slice(0, 4)" :key="msg">• {{ msg }}</li>
              <li v-if="orderProblems(order).length > 4">• y {{ orderProblems(order).length - 4 }} más</li>
            </ul>
            <p v-else class="text-xs text-green-600 font-semibold">Listo para despachar</p>
            <div class="sm:text-right">
              <button
                type="button"
                :disabled="orderProblems(order).length > 0 || dispatching === order.id"
                class="h-10 w-full sm:w-auto px-5 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:opacity-90 disabled:opacity-40 disabled:pointer-events-none"
                @click="doDispatch(order)"
              >
                {{ dispatching === order.id ? 'Despachando…' : 'Confirmar despacho' }}
              </button>
              <p v-if="dispatchErrors[order.id]" role="alert" class="text-xs text-red-500 mt-1">{{ dispatchErrors[order.id] }}</p>
            </div>
          </footer>
        </article>
      </div>

      <div v-if="filteredOrders.length" class="mt-4 rounded-xl border border-[var(--a-border)] bg-white [&>div]:border-t-0">
        <TablePagination v-model:page="page" :total="filteredOrders.length" noun="pedidos" />
      </div>
      </template>
    </div>
  </AdminLayout>
</template>
