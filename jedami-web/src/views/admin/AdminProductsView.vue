<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import AppLayout from '@/layouts/AppLayout.vue'
import ProductFormDialog from '@/components/features/admin/ProductFormDialog.vue'
import VariantFormDialog from '@/components/features/admin/VariantFormDialog.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
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
const editMap = reactive<Map<number, { stock: number }>>(new Map())

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
    } else {
      const newProduct = await adminStore.createProduct(data.name, data.description || undefined, data.categoryId)
      await adminStore.updateProductPrices(newProduct.id, {
        retailPrice: data.retailPrice,
        wholesalePrice: data.wholesalePrice,
      })
    }
    showProductDialog.value = false
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
  <AppLayout>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-gray-900">Productos</h1>
      <button
        @click="openNewProduct"
        class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#E91E8C] text-white text-sm font-semibold shadow hover:opacity-90 transition-opacity"
      >
        + Nuevo producto
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

    <div v-else-if="!adminStore.error && adminStore.products.length === 0" class="text-center py-16 text-gray-400">
      No hay productos. Creá el primero.
    </div>

    <div v-else-if="adminStore.products.length > 0" class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-gray-50 border-b border-gray-200">
          <tr>
            <th class="text-left px-4 py-3 font-semibold text-gray-700 w-12">Foto</th>
            <th class="text-left px-4 py-3 font-semibold text-gray-700">Nombre</th>
            <th class="text-left px-4 py-3 font-semibold text-gray-700 hidden md:table-cell">Categoría</th>
            <th class="text-right px-4 py-3 font-semibold text-gray-700 hidden lg:table-cell">Min.</th>
            <th class="text-right px-4 py-3 font-semibold text-gray-700 hidden lg:table-cell">May.</th>
            <th class="text-center px-4 py-3 font-semibold text-gray-700">Stock</th>
            <th class="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          <template v-for="product in adminStore.products" :key="product.id">
            <!-- Fila principal del producto -->
            <tr class="border-b border-gray-100 hover:bg-gray-50 transition-colors">
              <td class="px-4 py-3">
                <img
                  v-if="product.imageUrl"
                  :src="product.imageUrl"
                  :alt="product.name"
                  class="w-10 h-10 object-cover rounded-lg border border-gray-200"
                />
                <div v-else class="w-10 h-10 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 text-xs">
                  Sin foto
                </div>
              </td>
              <td class="px-4 py-3 font-medium text-gray-900">{{ product.name }}</td>
              <td class="px-4 py-3 text-gray-500 hidden md:table-cell">{{ product.categoryName ?? '—' }}</td>
              <td class="px-4 py-3 text-right text-gray-700 hidden lg:table-cell">
                {{ product.retailPrice != null ? `$${product.retailPrice.toLocaleString('es-AR')}` : '—' }}
              </td>
              <td class="px-4 py-3 text-right text-gray-500 hidden lg:table-cell">
                {{ product.wholesalePrice != null ? `$${product.wholesalePrice.toLocaleString('es-AR')}` : '—' }}
              </td>
              <td class="px-4 py-3 text-center text-gray-600">{{ totalStock(product) }}</td>
              <td class="px-4 py-3">
                <div class="flex gap-2 justify-end flex-wrap">
                  <button
                    @click="openEditProduct(product)"
                    class="px-3 py-1 rounded-lg border border-gray-300 text-xs font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                  >
                    Editar
                  </button>
                  <button
                    @click="toggleVariants(product)"
                    class="px-3 py-1 rounded-lg border border-blue-300 text-xs font-medium text-blue-700 hover:bg-blue-50 transition-colors"
                  >
                    {{ expandedProducts.has(product.id) ? '▲' : '▶' }} Variantes ({{ product.variants.length }})
                  </button>
                  <span
                    v-if="hasActiveStock(product)"
                    class="px-3 py-1 rounded-lg border border-gray-200 text-xs font-medium text-gray-400 cursor-not-allowed"
                    title="Tiene stock activo"
                  >
                    Eliminar
                  </span>
                  <button
                    v-else
                    @click="handleDeleteProduct(product)"
                    class="px-3 py-1 rounded-lg border border-red-300 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
                  >
                    Eliminar
                  </button>
                </div>
              </td>
            </tr>

            <!-- Subtabla de variantes (expandida) — matriz Talle × Color -->
            <tr v-if="expandedProducts.has(product.id)" class="bg-blue-50/40">
              <td colspan="7" class="px-6 py-3">
                <div class="rounded-xl border border-blue-100 overflow-hidden">
                  <div v-if="product.variants.length === 0" class="px-4 py-4 text-center text-gray-400 italic text-xs bg-white">
                    Sin variantes
                  </div>
                  <div v-else class="overflow-x-auto">
                    <table class="w-full text-xs border-collapse">
                      <thead class="bg-blue-100/60 border-b border-blue-100">
                        <tr>
                          <th class="px-3 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">Talle \ Color</th>
                          <th
                            v-for="color in getProductColors(product)"
                            :key="color.id"
                            class="px-3 py-2 text-center font-semibold text-gray-700 whitespace-nowrap"
                          >
                            <div class="flex items-center justify-center gap-1">
                              <span
                                v-if="color.hexCode"
                                class="w-2.5 h-2.5 rounded-full border border-gray-300 flex-none"
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
                          <td class="px-3 py-2 font-semibold text-gray-700 whitespace-nowrap">{{ size.label }}</td>
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
                                class="w-14 px-1 py-0.5 border border-gray-300 rounded text-center focus:outline-none focus:ring-1 focus:ring-[#1565C0]"
                              />
                              <button
                                @click="handleDeleteVariant(product.id, getVariantByCell(product, size.id, color.id)!.id, `${size.label} / ${color.name}`)"
                                class="text-gray-300 hover:text-red-500 transition-colors leading-none"
                                title="Eliminar variante"
                              >×</button>
                            </div>
                            <span v-else class="text-gray-300">—</span>
                          </td>
                        </tr>
                      </tbody>
                      <tfoot>
                        <tr class="border-t-2 border-blue-100 bg-blue-50/60">
                          <td class="px-3 py-2 text-gray-500 font-semibold" :colspan="getProductColors(product).length + 1">
                            Total de stock: <span class="text-gray-800 font-bold">{{ totalStock(product) }}</span>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  <div class="px-3 py-2 bg-white border-t border-blue-100 flex items-center gap-3">
                    <button
                      @click="openAddVariant(product.id)"
                      class="px-3 py-1 rounded-lg border border-[#E91E8C] text-xs font-medium text-[#E91E8C] hover:bg-[#E91E8C] hover:text-white transition-colors"
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
          </template>
        </tbody>
      </table>
    </div>

    <ProductFormDialog
      :open="showProductDialog"
      :product="editingProduct"
      @update:open="showProductDialog = $event"
      @saved="handleProductSaved"
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
  </AppLayout>
</template>
