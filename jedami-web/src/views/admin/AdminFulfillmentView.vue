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
  totalAssigned,
  problems,
  allocationState,
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

function clearGrid(o: PendingOrder, p: PendingProduct) {
  grids[key(o, p)] = {}
}

function orderProblems(o: PendingOrder) {
  return o.products.flatMap(p => problems(p, cellsOf(o, p)).map(msg => `${p.productName} — ${msg}`))
}

/** Reparto del pedido entero: null si no tiene curva/cantidad (minorista, ya trae color) */
function orderState(o: PendingOrder): 'none' | 'partial' | 'full' | null {
  const states = o.products.filter(needsAllocation).map(p => allocationState(p, cellsOf(o, p)))
  if (states.length === 0) return null
  if (states.every(st => st === 'none')) return 'none'
  return states.every(st => st === 'full') ? 'full' : 'partial'
}

/** Por cantidad: curvas completas que equivale (las mismas unidades en cada talle) */
const curvasOf = (p: PendingProduct) => Math.min(...[...sizeTargets(p).values()], Number.POSITIVE_INFINITY)

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
    const state = orderState(o)
    await dispatchOrder(o.id, allocations)
    orders.value = orders.value.filter(x => x.id !== o.id)
    toast.value = state === 'none'
      ? `Pedido #${o.id} despachado (sin descontar stock)`
      : `Pedido #${o.id} despachado y stock actualizado`
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

// Lista a la izquierda, pedido elegido a la derecha. Al despachar uno, se abre el siguiente.
const selectedId = ref<number | null>(null)
const selectedOrder = computed(() =>
  filteredOrders.value.find(o => o.id === selectedId.value) ?? pagedOrders.value[0] ?? null,
)
// En el celular se ve una cosa por vez: la lista o el pedido
const showDetailOnMobile = ref(false)
function selectOrder(o: PendingOrder) {
  selectedId.value = o.id
  showDetailOnMobile.value = true
}
const orderUnits = (o: PendingOrder) => o.products.reduce((n, p) => n + p.lines.reduce((m, l) => m + l.quantity, 0), 0)
const ready = (o: PendingOrder) => orderState(o) === 'full' && orderProblems(o).length === 0
</script>

<template>
  <AdminLayout title="Despacho">
    <div
      v-if="toast"
      role="status"
      class="fixed bottom-6 right-6 z-50 rounded-full bg-gray-900 px-5 py-3 text-sm font-semibold text-white shadow-lg"
    >
      ✓ {{ toast }}
    </div>

    <div v-if="loading" class="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
      <div class="h-96 animate-pulse rounded-xl border border-[var(--a-border)] bg-white"></div>
      <div class="hidden h-96 animate-pulse rounded-xl border border-[var(--a-border)] bg-white lg:block"></div>
    </div>

    <p v-else-if="error" class="text-sm text-red-500">{{ error }}</p>

    <div v-else-if="orders.length === 0" class="rounded-xl border border-[var(--a-border)] bg-white px-4 py-16 text-center">
      <p class="font-semibold">No hay pedidos para despachar</p>
      <p class="mt-1 text-sm text-[var(--a-muted)]">Cuando entre un pedido pagado, va a aparecer acá.</p>
    </div>

    <div v-else class="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)] lg:items-start">
      <!-- Lista de pedidos -->
      <section :class="['flex flex-col rounded-xl border border-[var(--a-border)] bg-white', showDetailOnMobile ? 'hidden lg:flex' : '']">
        <div class="space-y-2 border-b border-[var(--a-border)] p-3">
          <SearchField v-model="filterSearch" compact label="Buscar pedido" placeholder="Email o número de pedido" />
          <div class="grid grid-cols-2 gap-2">
            <select v-model="filterType" aria-label="Forma de compra" class="h-10 w-full rounded-lg border border-[#C9CDD2] px-2 text-sm focus:outline-none">
              <option value="">Todas</option>
              <option value="curva">Curva</option>
              <option value="cantidad">Cantidad</option>
              <option value="retail">Minorista</option>
            </select>
            <DateRangeFilter v-model="filterRange" compact label="Fechas" />
          </div>
          <button
            v-if="hasFilters"
            type="button"
            class="text-xs font-medium text-[var(--a-muted)] hover:text-[var(--a-ink)]"
            @click="clearFilters"
          >Limpiar filtros</button>
        </div>

        <p v-if="filteredOrders.length === 0" class="px-4 py-10 text-center text-sm text-[var(--a-muted)]">No hay pedidos con estos filtros.</p>

        <ul v-else :key="page" class="jd-stagger divide-y divide-[var(--a-border)]">
          <li v-for="o in pagedOrders" :key="o.id">
            <button
              type="button"
              :aria-current="selectedOrder?.id === o.id ? 'true' : undefined"
              :class="[
                'flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors',
                selectedOrder?.id === o.id ? 'bg-[var(--a-primary-soft)]' : 'hover:bg-[var(--a-bg)]',
              ]"
              @click="selectOrder(o)"
            >
              <div class="min-w-0 flex-1">
                <p class="flex items-center gap-1.5 text-sm font-semibold">
                  #{{ o.id }}
                  <span
                    class="rounded-full px-1.5 py-px text-[11px] font-semibold"
                    :class="{
                      'bg-purple-100 text-purple-700': o.purchaseType === 'curva',
                      'bg-blue-100 text-blue-700': o.purchaseType === 'cantidad',
                      'bg-gray-100 text-[var(--a-muted)]': o.purchaseType === 'retail',
                    }"
                  >{{ typeLabel(o.purchaseType) }}</span>
                  <span v-if="ready(o)" class="text-xs font-semibold text-green-600" title="Reparto completo">✓</span>
                </p>
                <p class="truncate text-xs text-[var(--a-muted)]">{{ o.customerEmail }}</p>
              </div>
              <div class="shrink-0 text-right text-xs text-[var(--a-muted)]">
                <p class="font-semibold text-[var(--a-ink)]">{{ orderUnits(o) }} u.</p>
                <p>{{ new Date(o.createdAt).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) }}</p>
              </div>
            </button>
          </li>
        </ul>

        <TablePagination v-if="filteredOrders.length" v-model:page="page" :total="filteredOrders.length" noun="pedidos" />
      </section>

      <!-- Pedido elegido -->
      <Transition name="jd-fade" mode="out-in">
        <article
          v-if="selectedOrder"
          :key="selectedOrder.id"
          :class="['overflow-hidden rounded-xl border border-[var(--a-border)] bg-white', showDetailOnMobile ? '' : 'hidden lg:block']"
        >
          <button
            type="button"
            class="flex w-full items-center gap-1.5 border-b border-[var(--a-border)] px-4 py-2.5 text-sm font-semibold text-[var(--a-primary)] lg:hidden"
            @click="showDetailOnMobile = false"
          >
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
            Pedidos
          </button>
          <!-- Mismo bloque de siempre, con el pedido elegido como "order" -->
          <template v-for="order in [selectedOrder]" :key="order.id">
          <!-- Cabecera -->
          <header class="flex items-start justify-between px-5 py-3 border-b border-[var(--a-border)] bg-[var(--a-bg)] gap-3">
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
          <section v-for="p in order.products" :key="p.productId" class="px-5 py-3 border-b border-[var(--a-border)] last:border-0">
            <div class="flex items-center justify-between gap-3 mb-3 flex-wrap">
              <p class="font-medium text-[var(--a-ink)] text-sm">{{ p.productName }}</p>
              <div v-if="needsAllocation(p) && allocationState(p, cellsOf(order, p)) !== 'none'" class="flex gap-2">
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
              <p v-if="order.purchaseType === 'cantidad' && sizeTargets(p).size > 0" class="text-xs font-semibold text-[var(--a-ink)] mb-1">
                Equivale a {{ curvasOf(p) === 1 ? '1 curva' : `${curvasOf(p)} curvas` }}<template v-if="freeUnits(p) > 0"> + {{ freeUnits(p) === 1 ? '1 unidad suelta' : `${freeUnits(p)} unidades sueltas` }} que elige el mayorista</template>
              </p>
              <p v-else-if="order.purchaseType === 'curva' && sizeTargets(p).size > 0" class="text-xs font-semibold text-[var(--a-ink)] mb-1">
                {{ curvasOf(p) === 1 ? '1 curva' : `${curvasOf(p)} curvas` }} ({{ curvasOf(p) === 1 ? '1 unidad' : `${curvasOf(p)} unidades` }} por talle)
              </p>
              <p v-else-if="freeUnits(p) > 0" class="text-xs font-semibold text-[var(--a-ink)] mb-1">
                {{ freeUnits(p) === 1 ? '1 unidad suelta' : `${freeUnits(p)} unidades sueltas` }} que elige el mayorista
              </p>
              <p class="text-xs text-[var(--a-muted)] mb-2">
                Recomendado: cargá los colores que mandás y se descuenta ese stock. Si no, despachalo igual y ajustá el stock en Productos.
                <template v-if="freeUnits(p) > 0"> Las sueltas sumalas en el talle y color que pidió el mayorista<template v-if="order.notes"> (mirá la nota)</template>.</template>
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
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="s in gridSizes(p)" :key="s.id">
                      <td class="py-0.5 pr-3 font-semibold text-[var(--a-ink)] sticky left-0 bg-white">{{ s.label }}</td>
                      <td v-for="c in p.colors" :key="c.id" class="py-0.5 px-1.5 text-center">
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
                            class="w-14 h-8 rounded-lg border text-center text-sm disabled:bg-gray-50 disabled:opacity-50"
                            :class="(cellsOf(order, p)[variantAt(p, s.id, c.id)!.id] ?? 0) > variantAt(p, s.id, c.id)!.stock ? 'border-red-400 text-red-600' : 'border-[var(--a-border)]'"
                            @input="setCell(order, p, variantAt(p, s.id, c.id)!.id, ($event.target as HTMLInputElement).value)"
                          />
                          <span class="block text-[10px] leading-3 text-[var(--a-muted)]">stock {{ variantAt(p, s.id, c.id)!.stock }}</span>
                        </template>
                        <span v-else class="text-[var(--a-muted)]">—</span>
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
          <footer class="px-5 py-3 bg-[var(--a-bg)] flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <!-- Lo que falta: el primero y cuántos más (el detalle está en la columna "Pedido" de cada grilla) -->
            <p v-if="orderProblems(order).length" class="text-xs text-red-600" :title="orderProblems(order).join('\n')">
              {{ orderProblems(order)[0] }}<template v-if="orderProblems(order).length > 1"> · y {{ orderProblems(order).length - 1 }} más</template>
            </p>
            <p v-else-if="orderState(order) === 'none'" class="text-xs text-[var(--a-muted)]">Sin reparto: se despacha sin descontar stock.</p>
            <p v-else-if="orderState(order) === 'partial'" class="text-xs text-amber-700">Reparto parcial: se descuenta solo lo cargado.</p>
            <p v-else class="text-xs text-green-600 font-semibold">{{ orderState(order) === 'full' ? 'Reparto completo: se descuenta el stock' : 'Listo para despachar' }}</p>
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
          </template>
        </article>
      </Transition>
    </div>
  </AdminLayout>
</template>
