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
import SidePanel from '@/components/features/admin/SidePanel.vue'
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

// Panel al costado con el stock por talle y color, o los descuentos, de un producto
const panelProductId = ref<number | null>(null)
const panelKind = ref<'variants' | 'discounts'>('variants')
const panelProduct = computed(() => adminStore.products.find(p => p.id === panelProductId.value) ?? null)
const panelOpen = computed({
  get: () => panelProduct.value !== null,
  set: (v) => { if (!v) panelProductId.value = null },
})

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
const editMap = reactive<Map<number, { stock: number }>>(new Map())

// Toast
const toastMessage = ref('')
let toastTimer: ReturnType<typeof setTimeout> | null = null
function showToast(msg: string) {
  toastMessage.value = msg
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toastMessage.value = '' }, 3000)
}

function openDiscounts(product: Product) {
  panelKind.value = 'discounts'
  panelProductId.value = product.id
}

// Confirm dialog
const confirmOpen = ref(false)
const confirmMessage = ref('')
const confirmCallback = ref<() => void>(() => {})

onMounted(() => {
  adminStore.fetchAll()
  productsStore.loadCategories()
})

function openVariants(product: Product) {
  for (const v of product.variants) {
    editMap.set(v.id, { stock: v.stock.quantity })
  }
  panelKind.value = 'variants'
  panelProductId.value = product.id
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
      if (panelProductId.value === product.id) panelProductId.value = null
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

async function saveAllStock(product: Product) {
  await Promise.all(product.variants.map(v => handleSaveVariantStock(product.id, v.id)))
  if (!actionError.value) showToast('Stock guardado')
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
  <AdminLayout title="Productos">
    <!-- Toast -->
    <div
      v-if="toastMessage"
      class="fixed bottom-6 right-6 z-50 bg-green-50 border border-green-200 text-green-900 rounded-xl px-4 py-3 shadow-lg text-sm font-semibold flex items-center gap-2"
    >
      <span class="text-green-600">✓</span> {{ toastMessage }}
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

    <div v-else-if="adminStore.products.length > 0" class="rounded-xl border border-[var(--a-border)] bg-white">
      <!-- Filtros en una sola franja: se aplican al cambiar -->
      <div class="flex flex-wrap items-center gap-2 border-b border-[var(--a-border)] p-3">
        <div role="tablist" aria-label="Visibilidad" class="flex h-10 items-center rounded-lg bg-[var(--a-bg)] p-1">
          <button
            v-for="t in tabs"
            :key="t.id"
            type="button"
            role="tab"
            :aria-selected="tab === t.id"
            :class="[
              'h-8 rounded-md px-3 text-sm font-semibold transition-colors',
              tab === t.id ? 'bg-white text-[var(--a-ink)] shadow-sm' : 'text-[var(--a-muted)] hover:text-[var(--a-ink)]',
            ]"
            @click="tab = t.id"
          >{{ t.label }} <span class="font-medium text-[var(--a-muted)]">{{ tabCounts[t.id] }}</span></button>
        </div>
        <div class="min-w-[200px] flex-[2_1_220px]">
          <SearchField v-model="searchTerm" compact label="Buscar productos" placeholder="Buscar por nombre o categoría" />
        </div>
        <select v-model="filterCategory" aria-label="Categoría" class="h-10 min-w-[150px] flex-[1_1_150px] rounded-lg border border-[#C9CDD2] px-2 text-sm focus:outline-none">
          <option value="">Todas las categorías</option>
          <option v-for="c in productsStore.categories" :key="c.id" :value="String(c.id)">{{ c.name }}</option>
          <option value="none">Sin categoría</option>
        </select>
        <select v-model="filterStock" aria-label="Stock" class="h-10 min-w-[130px] flex-[1_1_130px] rounded-lg border border-[#C9CDD2] px-2 text-sm focus:outline-none">
          <option value="">Todo el stock</option>
          <option value="with">Con stock</option>
          <option value="without">Sin stock</option>
        </select>
        <button
          v-if="hasFilters"
          type="button"
          class="h-10 rounded-lg px-3 text-sm font-medium text-[var(--a-muted)] hover:bg-[var(--a-bg)] hover:text-[var(--a-ink)]"
          @click="clearFilters"
        >Limpiar</button>
        <button
          type="button"
          class="ml-auto inline-flex h-10 items-center gap-1.5 rounded-lg bg-[var(--a-primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--a-primary-hover)]"
          @click="openNewProduct"
        >
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          Agregar producto
        </button>
      </div>

      <div class="overflow-x-auto overflow-y-hidden">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-[var(--a-border)] text-left">
            <th class="w-14 px-4 py-2.5"><span class="sr-only">Foto</span></th>
            <th class="px-2 py-2.5">Nombre</th>
            <th class="hidden px-4 py-2.5 md:table-cell">Categoría</th>
            <th class="hidden px-4 py-2.5 text-right lg:table-cell">Minorista</th>
            <th class="hidden px-4 py-2.5 text-right lg:table-cell">Mayorista</th>
            <th class="hidden px-4 py-2.5 text-right md:table-cell">Stock</th>
            <th class="px-4 py-2.5 text-center">Visible</th>
            <th class="px-4 py-2.5"><span class="sr-only">Acciones</span></th>
          </tr>
        </thead>
        <tbody :key="`${page}-${tab}`" class="jd-stagger">
          <tr
            v-for="product in pagedProducts"
            :key="product.id"
            class="h-14 border-b border-[var(--a-border)] last:border-0 hover:bg-[var(--a-bg)]"
            :class="{ 'opacity-60': product.active === false }"
          >
            <td class="py-2 pl-4 pr-0">
              <img
                v-if="product.imageUrl"
                :src="product.imageUrl"
                :alt="product.name"
                class="h-10 w-10 min-w-10 max-w-none rounded-lg border border-[var(--a-border)] object-cover object-top"
              />
              <div v-else class="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--a-border)] bg-gray-100 text-[var(--a-muted)]">
                <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M3 5h18v14H3zM3 15l5-5 4 4 3-3 6 6" /></svg>
              </div>
            </td>
            <td class="max-w-[280px] px-2">
              <span class="block truncate font-medium" :title="product.name">{{ product.name }}</span>
              <!-- Celular: datos debajo del nombre -->
              <span class="block truncate text-xs text-[var(--a-muted)] md:hidden">
                {{ totalStock(product) }} en stock<template v-if="product.retailPrice != null"> · ${{ product.retailPrice.toLocaleString('es-AR', { maximumFractionDigits: 0 }) }}</template>
              </span>
            </td>
            <td class="hidden whitespace-nowrap px-4 text-[var(--a-muted)] md:table-cell">{{ product.categoryName ?? '—' }}</td>
            <td class="hidden whitespace-nowrap px-4 text-right lg:table-cell">
              {{ product.retailPrice != null ? `$${product.retailPrice.toLocaleString('es-AR', { maximumFractionDigits: 0 })}` : '—' }}
            </td>
            <td class="hidden whitespace-nowrap px-4 text-right text-[var(--a-muted)] lg:table-cell">
              {{ product.wholesalePrice != null ? `$${product.wholesalePrice.toLocaleString('es-AR', { maximumFractionDigits: 0 })}` : '—' }}
            </td>
            <td class="hidden whitespace-nowrap px-4 text-right md:table-cell">
              {{ totalStock(product) }}
              <span
                v-if="product.reserved"
                class="ml-1 text-xs font-semibold text-amber-700"
                title="Unidades de pedidos por curva o cantidad ya pagados, sin despachar: la tienda no las vende"
              >· {{ product.reserved }} res.</span>
            </td>
            <td class="px-4 text-center">
              <button
                type="button"
                role="switch"
                :aria-checked="product.active !== false"
                :aria-label="`Visible en la tienda: ${product.name}`"
                :class="[
                  'relative inline-flex h-6 w-10 shrink-0 rounded-full align-middle transition-colors',
                  product.active === false ? 'bg-[#C9CDD2]' : 'bg-[var(--a-primary)]',
                ]"
                @click="handleToggleActive(product)"
              >
                <span :class="['absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white shadow transition-all', product.active === false ? 'left-[3px]' : 'left-[19px]']" />
              </button>
            </td>
            <td class="px-4">
              <ProductRowActions
                :variants-count="product.variants.length"
                :can-delete="!hasActiveStock(product)"
                @edit="openEditProduct(product)"
                @variants="openVariants(product)"
                @discounts="openDiscounts(product)"
                @delete="handleDeleteProduct(product)"
              />
            </td>
          </tr>
        </tbody>
      </table>
      </div>
      <p v-if="filteredProducts.length === 0" class="px-4 py-10 text-center text-sm text-[var(--a-muted)]">
        No hay productos que coincidan con el filtro.
      </p>
      <TablePagination v-else v-model:page="page" :total="filteredProducts.length" noun="productos" />
    </div>

    <!-- Stock por talle y color, o descuentos, al costado -->
    <SidePanel
      v-model:open="panelOpen"
      size="lg"
      :title="panelProduct ? (panelKind === 'variants' ? 'Stock y variantes' : 'Descuentos por mayor') : ''"
      :subtitle="panelProduct?.name ?? ''"
    >
      <template v-if="panelProduct && panelKind === 'variants'">
        <p v-if="actionError" class="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{{ actionError }}</p>
        <div v-if="panelProduct.variants.length === 0" class="rounded-lg border border-dashed border-[var(--a-border)] px-4 py-8 text-center text-sm text-[var(--a-muted)]">
          Todavía no tiene talles ni colores. Agregá la primera variante.
        </div>
        <div v-else class="overflow-x-auto rounded-xl border border-[var(--a-border)]">
          <table class="w-full border-collapse text-xs">
            <thead>
              <tr class="border-b border-[var(--a-border)]">
                <th class="whitespace-nowrap px-3 py-2 text-left">Talle \ Color</th>
                <th v-for="color in getProductColors(panelProduct)" :key="color.id" class="whitespace-nowrap px-3 py-2 text-center">
                  <span class="inline-flex items-center gap-1">
                    <span v-if="color.hexCode" class="h-2.5 w-2.5 flex-none rounded-full border border-[#C9CDD2]" :style="{ backgroundColor: color.hexCode }" />
                    {{ color.name }}
                  </span>
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[var(--a-border)]">
              <tr v-for="size in getProductSizes(panelProduct)" :key="size.id">
                <td class="whitespace-nowrap px-3 py-2 font-semibold">{{ size.label }}</td>
                <td v-for="color in getProductColors(panelProduct)" :key="color.id" class="px-2 py-1.5 text-center">
                  <div v-if="getVariantByCell(panelProduct, size.id, color.id)" class="flex items-center justify-center gap-1">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      :aria-label="`Stock talle ${size.label} ${color.name}`"
                      :value="editMap.get(getVariantByCell(panelProduct, size.id, color.id)!.id)?.stock ?? getVariantByCell(panelProduct, size.id, color.id)!.stock.quantity"
                      class="w-14 rounded border border-[#C9CDD2] px-1 py-0.5 text-center"
                      @input="editMap.get(getVariantByCell(panelProduct, size.id, color.id)!.id)!.stock = Number(($event.target as HTMLInputElement).value)"
                    />
                    <button
                      type="button"
                      class="leading-none text-gray-300 transition-colors hover:text-red-500"
                      :aria-label="`Eliminar variante ${size.label} / ${color.name}`"
                      @click="handleDeleteVariant(panelProduct.id, getVariantByCell(panelProduct, size.id, color.id)!.id, `${size.label} / ${color.name}`)"
                    >×</button>
                  </div>
                  <button
                    v-else
                    type="button"
                    :disabled="creatingCell.has(`${panelProduct.id}-${size.id}-${color.id}`)"
                    class="h-6 w-14 rounded border border-dashed border-[#C9CDD2] text-xs text-[var(--a-muted)] transition-colors hover:border-[var(--a-primary)] hover:text-[var(--a-primary)] disabled:pointer-events-none disabled:opacity-40"
                    title="Agregar esta combinación con stock 0"
                    @click="handleAddVariantFromCell(panelProduct.id, size.id, color.id)"
                  >{{ creatingCell.has(`${panelProduct.id}-${size.id}-${color.id}`) ? '…' : '+' }}</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="mt-3 text-sm text-[var(--a-muted)]">
          Total de stock: <span class="font-bold text-[var(--a-ink)]">{{ totalStock(panelProduct) }}</span>
          <template v-if="panelProduct.reserved">
            · <span class="font-bold text-amber-700">{{ panelProduct.reserved }} reservadas</span> por pedidos pagados sin despachar (la tienda no las vende hasta que despaches)
          </template>
        </p>
      </template>

      <template v-else-if="panelProduct && panelKind === 'discounts'">
        <AdminProductDiscounts :product-id="panelProduct.id" @toast="showToast" />
      </template>

      <template v-if="panelProduct && panelKind === 'variants'" #footer>
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="h-10 rounded-lg border border-[#C9CDD2] px-4 text-sm font-semibold"
            @click="openAddVariant(panelProduct.id)"
          >+ Agregar variante</button>
          <button
            type="button"
            class="ml-auto h-10 rounded-lg bg-[var(--a-primary)] px-5 text-sm font-semibold text-white"
            @click="saveAllStock(panelProduct)"
          >Guardar stock</button>
        </div>
      </template>
    </SidePanel>

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
