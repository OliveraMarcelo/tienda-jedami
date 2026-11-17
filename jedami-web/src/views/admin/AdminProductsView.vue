<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import AdminLayout from '@/layouts/AdminLayout.vue'
import ProductRowActions from '@/components/features/admin/ProductRowActions.vue'
import ProductFormDialog from '@/components/features/admin/ProductFormDialog.vue'
import VariantFormDialog from '@/components/features/admin/VariantFormDialog.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import AdminProductDiscounts from '@/components/features/admin/AdminProductDiscounts.vue'
import SearchField from '@/components/features/admin/SearchField.vue'
import TablePagination from '@/components/features/admin/TablePagination.vue'
import { PAGE_SIZE } from '@/lib/date-range'
import { useAdminProductsStore } from '@/stores/admin.products.store'
import { useProductsStore } from '@/stores/products.store'
import type { Product } from '@/types/api'

const adminStore = useAdminProductsStore()
const productsStore = useProductsStore()

const showProductDialog = ref(false)
const editingProduct = ref<Product | undefined>(undefined)
const showVariantDialog = ref(false)
const variantProductId = ref<number>(0)
const actionError = ref<string | null>(null)

const expandedProducts = ref<Set<number>>(new Set())

// ─── Pestañas y búsqueda (estilo Tiendanube) ─────────────────────────────────
type ProductTab = 'all' | 'visible' | 'hidden'
const tab = ref<ProductTab>('all')
const searchTerm = ref('')
const filterCategory = ref<string>('')   // '' = todas, 'none' = sin categoría, o el id
const filterStock = ref<'' | 'with' | 'without'>('')
const tabCounts = computed(() => {
  const hidden = adminStore.products.filter(p => p.active === false).length
  return { all: adminStore.products.length, visible: adminStore.products.length - hidden, hidden }
})
const tabs: { id: ProductTab; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'visible', label: 'Visibles' },
  { id: 'hidden', label: 'Ocultos' },
]
const filteredProducts = computed(() => {
  const term = searchTerm.value.trim().toLowerCase()
  return adminStore.products.filter(p => {
    if (tab.value === 'visible' && p.active === false) return false
    if (tab.value === 'hidden' && p.active !== false) return false
    if (filterCategory.value === 'none' && p.categoryId != null) return false
    if (filterCategory.value && filterCategory.value !== 'none' && String(p.categoryId) !== filterCategory.value) return false
    if (filterStock.value === 'with' && totalStock(p) === 0) return false
    if (filterStock.value === 'without' && totalStock(p) > 0) return false
    return !term || p.name.toLowerCase().includes(term) || (p.categoryName ?? '').toLowerCase().includes(term)
  })
})

// Paginación en el navegador (la lista completa ya está cargada)
const page = ref(1)
const pagedProducts = computed(() => filteredProducts.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE))
watch([tab, searchTerm, filterCategory, filterStock], () => { page.value = 1 })
// Si al ocultar o borrar se vacía la página, volver a la última que tenga productos
watch(() => filteredProducts.value.length, (n) => {
  const last = Math.max(1, Math.ceil(n / PAGE_SIZE))
  if (page.value > last) page.value = last
})
const hasFilters = computed(() => !!(searchTerm.value || filterCategory.value || filterStock.value))
function clearFilters() {
  searchTerm.value = ''
  filterCategory.value = ''
  filterStock.value = ''
}
const expandedDiscounts = ref<Set<number>>(new Set())
const editMap = reactive<Map<number, { stock: number }>>(new Map())

// Toast
const toastMessage = ref('')
let toastTimer: ReturnType<typeof setTimeout> | null = null
function showToast(msg: string) {
  toastMessage.value = msg
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toastMessage.value = '' }, 3000)
}

function toggleDiscounts(productId: number) {
  if (expandedDiscounts.value.has(productId)) {
    expandedDiscounts.value.delete(productId)
  } else {
    expandedDiscounts.value.add(productId)
  }
}

// Confirm dialog
const confirmOpen = ref(false)
const confirmMessage = ref('')
const confirmCallback = ref<() => void>(() => {})

onMounted(() => {
  adminStore.fetchAll()
  productsStore.loadCategories()
})

function toggleVariants(product: Product) {
  if (expandedProducts.value.has(product.id)) {
    expandedProducts.value.delete(product.id)
  } else {
    expandedProducts.value.add(product.id)
    for (const v of product.variants) {
      if (!editMap.has(v.id)) {
        editMap.set(v.id, { stock: v.stock.quantity })
      }
    }
  }
}

function totalStock(product: Product): number {
  return product.variants.reduce((sum, v) => sum + v.stock.quantity, 0)
}

function hasActiveStock(product: Product): boolean {
  return product.variants.some(v => v.stock.quantity > 0)
}

function getProductSizes(product: Product) {
  const seen = new Set<number>()
  const result: { id: number; label: string }[] = []
  for (const v of [...product.variants].sort((a, b) => a.sizeId - b.sizeId)) {
    if (!seen.has(v.sizeId)) {
      seen.add(v.sizeId)
      result.push({ id: v.sizeId, label: v.size })
    }
  }
  return result
}

function getProductColors(product: Product) {
  const seen = new Set<number>()
  const result: { id: number; name: string; hexCode: string | null }[] = []
  for (const v of product.variants) {
    if (!seen.has(v.colorId)) {
      seen.add(v.colorId)
      result.push({ id: v.colorId, name: v.color, hexCode: v.hexCode })
    }
  }
  return result
}

function getVariantByCell(product: Product, sizeId: number, colorId: number) {
  return product.variants.find(v => v.sizeId === sizeId && v.colorId === colorId) ?? null
}

function openNewProduct() {
  editingProduct.value = undefined
  actionError.value = null
  showProductDialog.value = true
}

function openEditProduct(product: Product) {
  editingProduct.value = product
  actionError.value = null
  showProductDialog.value = true
}

function openAddVariant(productId: number) {
  variantProductId.value = productId
  actionError.value = null
  showVariantDialog.value = true
}

function askConfirm(message: string, callback: () => void) {
  confirmMessage.value = message
  confirmCallback.value = callback
  confirmOpen.value = true
}

async function handleDeleteProduct(product: Product) {
  askConfirm(`¿Eliminar el producto "${product.name}"? Esta acción no se puede deshacer.`, async () => {
    actionError.value = null
    try {
      await adminStore.deleteProduct(product.id)
      expandedProducts.value.delete(product.id)
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } }
      actionError.value = e.response?.data?.detail ?? 'Error al eliminar el producto.'
    }
  })
}

async function handleToggleActive(product: Product) {
  const hide = product.active !== false
  const action = async () => {
    actionError.value = null
    try {
      await adminStore.updateProduct(product.id, { active: !hide })
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } }
      actionError.value = e.response?.data?.detail ?? 'Error al cambiar la visibilidad del producto.'
    }
  }
  if (hide) askConfirm(`¿Ocultar "${product.name}" del catálogo? Podés volver a mostrarlo cuando quieras.`, action)
  else action()
}

async function handleDeleteVariant(productId: number, variantId: number, label: string) {
  askConfirm(`¿Eliminar la variante "${label}"?`, async () => {
    actionError.value = null
    try {
      await adminStore.deleteVariant(productId, variantId)
      editMap.delete(variantId)
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } }
      actionError.value = e.response?.data?.detail ?? 'Error al eliminar la variante.'
    }
  })
}

const creatingCell = reactive<Set<string>>(new Set())

async function handleAddVariantFromCell(productId: number, sizeId: number, colorId: number) {
  const key = `${productId}-${sizeId}-${colorId}`
  if (creatingCell.has(key)) return
  creatingCell.add(key)
  actionError.value = null
  try {
    const newVariant = await adminStore.createVariant(productId, { sizeId, colorId, initialStock: 0 })
    editMap.set(newVariant.id, { stock: 0 })
  } catch (err: unknown) {
    const e = err as { response?: { data?: { detail?: string } } }
    actionError.value = e.response?.data?.detail ?? 'Error al agregar la variante.'
  } finally {
    creatingCell.delete(key)
  }
}

async function handleSaveVariantStock(productId: number, variantId: number) {
  const entry = editMap.get(variantId)
  if (!entry) return
  actionError.value = null
  try {
    await adminStore.updateVariantStock(productId, variantId, entry.stock)
  } catch (err: unknown) {
    const e = err as { response?: { data?: { detail?: string } } }
    actionError.value = e.response?.data?.detail ?? 'Error al guardar el stock.'
  }
}

async function handleProductSaved(data: { name: string; description: string; categoryId: number | null; retailPrice: number; wholesalePrice: number | null }) {
  actionError.value = null
  try {
    if (editingProduct.value) {
      await adminStore.updateProduct(editingProduct.value.id, {
        name: data.name,
        description: data.description || undefined,
        categoryId: data.categoryId,
      })
      await adminStore.updateProductPrices(editingProduct.value.id, {
        retailPrice: data.retailPrice,
        wholesalePrice: data.wholesalePrice,
      })
      showProductDialog.value = false
    } else {
      const newProduct = await adminStore.createProduct(data.name, data.description || undefined, data.categoryId)
      await adminStore.updateProductPrices(newProduct.id, {
        retailPrice: data.retailPrice,
        wholesalePrice: data.wholesalePrice,
      })
      // El diálogo se queda abierto — pasar a modo edición para que el usuario pueda subir fotos
      editingProduct.value = adminStore.products.find(p => p.id === newProduct.id)
    }
  } catch (err: unknown) {
    const e = err as { response?: { data?: { detail?: string } } }
    actionError.value = e.response?.data?.detail ?? 'Error al guardar el producto.'
  }
}

async function handleVariantSaved(data: { sizeId: number; colorId: number; initialStock: number }) {
  actionError.value = null
  try {
    const newVariant = await adminStore.createVariant(variantProductId.value, data)
    editMap.set(newVariant.id, { stock: newVariant.stock.quantity })
    showVariantDialog.value = false
  } catch (err: unknown) {
    const e = err as { response?: { data?: { detail?: string } } }
    actionError.value = e.response?.data?.detail ?? 'Error al guardar la variante.'
  }
}
</script>

<template>
  <AdminLayout>
    <!-- Toast -->
    <div
      v-if="toastMessage"
      class="fixed bottom-6 right-6 z-50 bg-green-50 border border-green-200 text-green-900 rounded-xl px-4 py-3 shadow-lg text-sm font-semibold flex items-center gap-2"
    >
      <span class="text-green-600">✓</span> {{ toastMessage }}
    </div>

    <div class="mb-6 flex flex-wrap items-center gap-3">
      <h1 class="flex-1 text-[26px] font-bold">Productos</h1>
      <button
        type="button"
        @click="openNewProduct"
        class="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--a-primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--a-primary-hover)] transition-colors"
      >
        Agregar producto
      </button>
    </div>

    <!-- Error de carga -->
    <div v-if="adminStore.error" class="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center justify-between">
      <span>{{ adminStore.error }}</span>
      <button @click="adminStore.fetchAll()" class="text-red-600 font-semibold hover:underline">Reintentar</button>
    </div>

    <!-- Advertencia de truncado -->
    <div
      v-if="adminStore.totalProducts > 100"
      class="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-xl text-sm text-yellow-800"
    >
      Se muestran los primeros 100 de {{ adminStore.totalProducts }} productos.
    </div>

    <!-- Error de acción -->
    <div v-if="actionError" class="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
      {{ actionError }}
    </div>

    <div v-if="adminStore.loading" class="space-y-2">
      <div v-for="n in 5" :key="n" class="h-12 bg-gray-200 rounded-xl animate-pulse" />
    </div>

    <div v-else-if="!adminStore.error && adminStore.products.length === 0" class="text-center py-16 text-[var(--a-muted)]">
      No hay productos. Creá el primero.
    </div>

    <div v-else-if="adminStore.products.length > 0" class="overflow-hidden rounded-xl border border-[var(--a-border)] bg-white">
      <!-- Pestañas -->
      <div role="tablist" aria-label="Filtrar productos" class="flex flex-wrap gap-1 border-b border-[var(--a-border)] px-4">
        <button
          v-for="t in tabs"
          :key="t.id"
          type="button"
          role="tab"
          :aria-selected="tab === t.id"
          @click="tab = t.id"
          :class="[
            'min-h-11 border-b-2 px-3 text-sm font-semibold transition-colors',
            tab === t.id ? 'border-[var(--a-primary)] text-[var(--a-primary)]' : 'border-transparent text-[#45494E] hover:text-[var(--a-ink)]',
          ]"
        >
          {{ t.label }} <span class="font-medium text-[var(--a-muted)]">{{ tabCounts[t.id] }}</span>
        </button>
      </div>
      <!-- Filtros: se aplican al cambiar -->
      <div class="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[minmax(220px,1.4fr)_minmax(170px,1fr)_minmax(150px,0.8fr)_auto] lg:items-end">
        <SearchField v-model="searchTerm" label="Buscar" placeholder="Nombre o categoría" />
        <div>
          <label for="f-cat" class="mb-1 block text-xs text-[var(--a-muted)]">Categoría</label>
          <select id="f-cat" v-model="filterCategory" class="h-10 w-full rounded-lg border border-[#C9CDD2] px-2 text-sm focus:outline-none">
            <option value="">Todas</option>
            <option v-for="c in productsStore.categories" :key="c.id" :value="String(c.id)">{{ c.name }}</option>
            <option value="none">Sin categoría</option>
          </select>
        </div>
        <div>
          <label for="f-stock" class="mb-1 block text-xs text-[var(--a-muted)]">Stock</label>
          <select id="f-stock" v-model="filterStock" class="h-10 w-full rounded-lg border border-[#C9CDD2] px-2 text-sm focus:outline-none">
            <option value="">Todos</option>
            <option value="with">Con stock</option>
            <option value="without">Sin stock</option>
          </select>
        </div>
        <button
          v-if="hasFilters"
          type="button"
          class="h-10 rounded-lg px-3 text-sm font-medium text-[var(--a-muted)] hover:bg-[var(--a-bg)] hover:text-[var(--a-ink)]"
          @click="clearFilters"
        >Limpiar filtros</button>
      </div>
      <div class="overflow-x-auto overflow-y-hidden">
      <table class="w-full text-sm">
        <thead class="border-y border-[var(--a-border)] bg-[#F9FAFB]">
          <tr>
            <th class="text-left px-4 py-3 font-semibold text-[#45494E] w-12"><span class="sr-only">Foto</span></th>
            <th class="text-left px-4 py-3 font-semibold text-[#45494E]">Nombre</th>
            <th class="text-left px-4 py-3 font-semibold text-[#45494E] hidden md:table-cell">Categoría</th>
            <th class="text-right px-4 py-3 font-semibold text-[#45494E] hidden lg:table-cell">Minorista</th>
            <th class="text-right px-4 py-3 font-semibold text-[#45494E] hidden lg:table-cell">Mayorista</th>
            <th class="text-center px-4 py-3 font-semibold text-[#45494E] hidden md:table-cell">Stock</th>
            <th class="text-center px-4 py-3 font-semibold text-[#45494E]">Visible</th>
            <th class="px-4 py-3 hidden md:table-cell"><span class="sr-only">Acciones</span></th>
          </tr>
        </thead>
        <tbody :key="`${page}-${tab}`" class="jd-stagger">
          <template v-for="product in pagedProducts" :key="product.id">
            <!-- Fila principal del producto -->
            <tr class="border-b border-[var(--a-border)] hover:bg-[var(--a-bg)] transition-colors" :class="{ 'opacity-60': product.active === false }">
              <td class="px-4 py-3 align-top md:align-middle">
                <img
                  v-if="product.imageUrl"
                  :src="product.imageUrl"
                  :alt="product.name"
                  class="w-12 h-12 min-w-12 max-w-none object-cover object-top rounded-lg border border-[var(--a-border)]"
                />
                <div v-else class="w-12 h-12 min-w-12 bg-gray-100 rounded-lg border border-[var(--a-border)] flex items-center justify-center text-[var(--a-muted)] text-xs">
                  Sin foto
                </div>
              </td>
              <td class="px-4 py-3 font-medium text-[var(--a-ink)]">
                {{ product.name }}
                <span
                  v-if="product.active === false"
                  class="ml-2 px-2 py-0.5 rounded-full bg-gray-200 text-[var(--a-muted)] text-[10px] font-semibold uppercase align-middle"
                >Oculto</span>
                <!-- Celular: datos y acciones debajo del nombre -->
                <p class="md:hidden mt-0.5 text-xs font-normal text-[var(--a-muted)]">
                  {{ product.categoryName ?? 'Sin categoría' }} · {{ totalStock(product) }} en stock<template v-if="product.reserved"> ({{ product.reserved }} reservadas)</template>
                  <template v-if="product.retailPrice != null"> · ${{ product.retailPrice.toLocaleString('es-AR', { maximumFractionDigits: 0 }) }}</template>
                  <template v-if="product.wholesalePrice != null"> / may. ${{ product.wholesalePrice.toLocaleString('es-AR', { maximumFractionDigits: 0 }) }}</template>
                </p>
                <div class="md:hidden mt-2.5">
                  <ProductRowActions
                    :variants-count="product.variants.length"
                    :variants-open="expandedProducts.has(product.id)"
                    :discounts-open="expandedDiscounts.has(product.id)"
                    :can-delete="!hasActiveStock(product)"
                    @edit="openEditProduct(product)"
                    @variants="toggleVariants(product)"
                    @discounts="toggleDiscounts(product.id)"
                    @delete="handleDeleteProduct(product)"
                  />
                </div>
              </td>
              <td class="px-4 py-3 text-[var(--a-muted)] hidden md:table-cell">{{ product.categoryName ?? '—' }}</td>
              <td class="px-4 py-3 text-right text-[#45494E] hidden lg:table-cell">
                {{ product.retailPrice != null ? `$${product.retailPrice.toLocaleString('es-AR', { maximumFractionDigits: 0 })}` : '—' }}
              </td>
              <td class="px-4 py-3 text-right text-[var(--a-muted)] hidden lg:table-cell">
                {{ product.wholesalePrice != null ? `$${product.wholesalePrice.toLocaleString('es-AR', { maximumFractionDigits: 0 })}` : '—' }}
              </td>
              <td class="px-4 py-3 text-center text-[var(--a-muted)] hidden md:table-cell">
                {{ totalStock(product) }}
                <span v-if="product.reserved" class="block text-[10px] font-semibold text-amber-700" title="Unidades de pedidos por curva o cantidad ya pagados, sin despachar: la tienda no las vende">{{ product.reserved }} reservadas</span>
              </td>
              <td class="px-4 py-3 text-center align-top md:align-middle">
                <button
                  type="button"
                  role="switch"
                  :aria-checked="product.active !== false"
                  :aria-label="`Visible en la tienda: ${product.name}`"
                  @click="handleToggleActive(product)"
                  :class="[
                    'relative inline-flex h-[26px] w-11 shrink-0 rounded-full transition-colors',
                    product.active === false ? 'bg-[#C9CDD2]' : 'bg-[var(--a-primary)]',
                  ]"
                >
                  <span
                    :class="[
                      'absolute top-[3px] h-5 w-5 rounded-full bg-white shadow transition-all',
                      product.active === false ? 'left-[3px]' : 'left-[21px]',
                    ]"
                  />
                </button>
              </td>
              <td class="px-4 py-3 hidden md:table-cell">
                <ProductRowActions
                  :variants-count="product.variants.length"
                  :variants-open="expandedProducts.has(product.id)"
                  :discounts-open="expandedDiscounts.has(product.id)"
                  :can-delete="!hasActiveStock(product)"
                  @edit="openEditProduct(product)"
                  @variants="toggleVariants(product)"
                  @discounts="toggleDiscounts(product.id)"
                  @delete="handleDeleteProduct(product)"
                />
              </td>
            </tr>

            <!-- Subtabla de variantes (expandida) — matriz Talle × Color -->
            <tr v-if="expandedProducts.has(product.id)" class="bg-blue-50/40">
              <td colspan="8" class="px-3 md:px-6 py-3">
                <!-- En el celular el ancho se limita a la pantalla y la matriz scrollea adentro -->
                <div class="rounded-xl border border-blue-100 overflow-hidden max-w-[calc(100vw-4rem)] md:max-w-none">
                  <div v-if="product.variants.length === 0" class="px-4 py-4 text-center text-[var(--a-muted)] italic text-xs bg-white">
                    Sin variantes
                  </div>
                  <div v-else class="overflow-x-auto">
                    <table class="w-full text-xs border-collapse">
                      <thead class="bg-blue-100/60 border-b border-blue-100">
                        <tr>
                          <th class="px-3 py-2 text-left font-semibold text-[#45494E] whitespace-nowrap">Talle \ Color</th>
                          <th
                            v-for="color in getProductColors(product)"
                            :key="color.id"
                            class="px-3 py-2 text-center font-semibold text-[#45494E] whitespace-nowrap"
                          >
                            <div class="flex items-center justify-center gap-1">
                              <span
                                v-if="color.hexCode"
                                class="w-2.5 h-2.5 rounded-full border border-[#C9CDD2] flex-none"
                                :style="{ backgroundColor: color.hexCode }"
                              />
                              {{ color.name }}
                            </div>
                          </th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-blue-100">
                        <tr
                          v-for="size in getProductSizes(product)"
                          :key="size.id"
                          class="border-t border-blue-100 bg-white hover:bg-blue-50/30 transition-colors"
                        >
                          <td class="px-3 py-2 font-semibold text-[#45494E] whitespace-nowrap">{{ size.label }}</td>
                          <td
                            v-for="color in getProductColors(product)"
                            :key="color.id"
                            class="px-2 py-1.5 text-center"
                          >
                            <div v-if="getVariantByCell(product, size.id, color.id)" class="flex items-center justify-center gap-1">
                              <input
                                type="number"
                                min="0"
                                step="1"
                                :value="editMap.get(getVariantByCell(product, size.id, color.id)!.id)?.stock ?? getVariantByCell(product, size.id, color.id)!.stock.quantity"
                                @input="editMap.get(getVariantByCell(product, size.id, color.id)!.id)!.stock = Number(($event.target as HTMLInputElement).value)"
                                class="w-14 px-1 py-0.5 border border-[#C9CDD2] rounded text-center focus:outline-none focus:ring-1 focus:ring-[#1565C0]"
                              />
                              <button
                                @click="handleDeleteVariant(product.id, getVariantByCell(product, size.id, color.id)!.id, `${size.label} / ${color.name}`)"
                                class="text-gray-300 hover:text-red-500 transition-colors leading-none"
                                title="Eliminar variante"
                              >×</button>
                            </div>
                            <button
                              v-else
                              @click="handleAddVariantFromCell(product.id, size.id, color.id)"
                              :disabled="creatingCell.has(`${product.id}-${size.id}-${color.id}`)"
                              class="w-14 h-6 rounded border border-dashed border-[#C9CDD2] text-[var(--a-muted)] text-xs hover:border-[var(--a-primary)] hover:text-[var(--a-primary)] transition-colors disabled:opacity-40 disabled:pointer-events-none"
                              title="Agregar esta combinación con stock 0"
                            >
                              {{ creatingCell.has(`${product.id}-${size.id}-${color.id}`) ? '…' : '+' }}
                            </button>
                          </td>
                        </tr>
                      </tbody>
                      <tfoot>
                        <tr class="border-t-2 border-blue-100 bg-blue-50/60">
                          <td class="px-3 py-2 text-[var(--a-muted)] font-semibold" :colspan="getProductColors(product).length + 1">
                            Total de stock: <span class="text-[var(--a-ink)] font-bold">{{ totalStock(product) }}</span>
                            <template v-if="product.reserved">
                              · <span class="text-amber-700 font-bold">{{ product.reserved }} reservadas</span> por pedidos pagados sin despachar (la tienda no las vende hasta que despaches)
                            </template>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  <div class="px-3 py-2 bg-white border-t border-blue-100 flex items-center gap-3">
                    <button
                      @click="openAddVariant(product.id)"
                      class="px-3 py-1 rounded-lg border border-[var(--a-primary)] text-xs font-medium text-[var(--a-primary)] hover:bg-[var(--a-primary)] hover:text-white transition-colors"
                    >
                      + Agregar variante
                    </button>
                    <button
                      @click="product.variants.forEach(v => handleSaveVariantStock(product.id, v.id))"
                      class="px-3 py-1 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-700 transition-colors"
                    >
                      Guardar cambios
                    </button>
                  </div>
                </div>
              </td>
            </tr>
            <!-- Panel de descuentos (expandido) -->
            <tr v-if="expandedDiscounts.has(product.id)" class="bg-green-50/40">
              <td colspan="8" class="px-3 md:px-6 py-3">
                <div class="rounded-xl border border-green-100 bg-white overflow-hidden max-w-[calc(100vw-4rem)] md:max-w-none">
                  <div class="px-4 py-2 bg-green-50 border-b border-green-100">
                    <p class="text-xs font-semibold text-green-800">Descuentos por volumen — {{ product.name }}</p>
                  </div>
                  <div class="px-4">
                    <AdminProductDiscounts
                      :product-id="product.id"
                      @toast="showToast"
                    />
                  </div>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
      </div>
      <p v-if="filteredProducts.length === 0" class="px-4 py-10 text-center text-sm text-[var(--a-muted)]">
        No hay productos que coincidan con el filtro.
      </p>
      <TablePagination v-else v-model:page="page" :total="filteredProducts.length" noun="productos" />
    </div>

    <ProductFormDialog
      :open="showProductDialog"
      :product="editingProduct"
      @update:open="showProductDialog = $event"
      @saved="handleProductSaved"
      @image-changed="({ productId, imageUrl }) => { const p = adminStore.products.find(p => p.id === productId); if (p) p.imageUrl = imageUrl }"
    />

    <VariantFormDialog
      :open="showVariantDialog"
      :product-id="variantProductId"
      @update:open="showVariantDialog = $event"
      @saved="handleVariantSaved"
    />

    <ConfirmDialog
      :open="confirmOpen"
      :message="confirmMessage"
      @update:open="confirmOpen = $event"
      @confirm="confirmCallback()"
    />
  </AdminLayout>
</template>
