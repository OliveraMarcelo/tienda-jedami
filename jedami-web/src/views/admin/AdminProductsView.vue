<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import AppLayout from '@/layouts/AppLayout.vue'
import ProductFormDialog from '@/components/features/admin/ProductFormDialog.vue'
import VariantFormDialog from '@/components/features/admin/VariantFormDialog.vue'
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

// Set de productIds con variantes expandidas
const expandedProducts = ref<Set<number>>(new Set())

// Map de edición inline por variantId: { retailPrice, wholesalePrice, stock }
const editMap = ref<Map<number, { retailPrice: number; wholesalePrice: number | string; stock: number }>>(new Map())

onMounted(() => {
  adminStore.fetchAll()
  productsStore.loadCategories()
})

function toggleVariants(product: Product) {
  if (expandedProducts.value.has(product.id)) {
    expandedProducts.value.delete(product.id)
  } else {
    expandedProducts.value.add(product.id)
    // Inicializar el mapa de edición con los valores actuales
    for (const v of product.variants) {
      if (!editMap.value.has(v.id)) {
        editMap.value.set(v.id, {
          retailPrice: v.retailPrice,
          wholesalePrice: v.wholesalePrice ?? '',
          stock: v.stock.quantity,
        })
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

async function handleDeleteProduct(product: Product) {
  if (!window.confirm(`¿Eliminar el producto "${product.name}"? Esta acción no se puede deshacer.`)) return
  actionError.value = null
  try {
    await adminStore.deleteProduct(product.id)
    expandedProducts.value.delete(product.id)
  } catch (err: unknown) {
    const e = err as { response?: { data?: { detail?: string } } }
    actionError.value = e.response?.data?.detail ?? 'Error al eliminar el producto.'
  }
}

async function handleDeleteVariant(productId: number, variantId: number, label: string) {
  if (!window.confirm(`¿Eliminar la variante "${label}"?`)) return
  actionError.value = null
  try {
    await adminStore.deleteVariant(productId, variantId)
    editMap.value.delete(variantId)
  } catch (err: unknown) {
    const e = err as { response?: { data?: { detail?: string } } }
    actionError.value = e.response?.data?.detail ?? 'Error al eliminar la variante.'
  }
}

async function handleSaveVariant(productId: number, variantId: number) {
  const entry = editMap.value.get(variantId)
  if (!entry) return
  actionError.value = null
  try {
    const wholesalePrice = entry.wholesalePrice === '' ? null : Number(entry.wholesalePrice)
    await adminStore.updateVariantPrices(productId, variantId, {
      retailPrice: entry.retailPrice,
      wholesalePrice,
    })
    await adminStore.updateVariantStock(productId, variantId, entry.stock)
  } catch (err: unknown) {
    const e = err as { response?: { data?: { detail?: string } } }
    actionError.value = e.response?.data?.detail ?? 'Error al guardar la variante.'
  }
}

async function handleProductSaved(data: { name: string; description: string; categoryId: number | null }) {
  actionError.value = null
  try {
    if (editingProduct.value) {
      await adminStore.updateProduct(editingProduct.value.id, data)
    } else {
      await adminStore.createProduct(data.name, data.description || undefined, data.categoryId)
    }
    showProductDialog.value = false
  } catch (err: unknown) {
    const e = err as { response?: { data?: { detail?: string } } }
    actionError.value = e.response?.data?.detail ?? 'Error al guardar el producto.'
  }
}

async function handleVariantSaved(data: { size: string; color: string; retailPrice: number; wholesalePrice: number | null; initialStock: number }) {
  actionError.value = null
  try {
    const newVariant = await adminStore.createVariant(variantProductId.value, data)
    // Inicializar el editMap para la nueva variante
    editMap.value.set(newVariant.id, {
      retailPrice: newVariant.retailPrice,
      wholesalePrice: newVariant.wholesalePrice ?? '',
      stock: newVariant.stock.quantity,
    })
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
            <th class="text-center px-4 py-3 font-semibold text-gray-700">Stock Total</th>
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

            <!-- Subtabla de variantes (expandida) -->
            <tr v-if="expandedProducts.has(product.id)" class="bg-blue-50/40">
              <td colspan="5" class="px-6 py-3">
                <div class="rounded-xl border border-blue-100 overflow-hidden">
                  <table class="w-full text-xs">
                    <thead class="bg-blue-100/60 border-b border-blue-100">
                      <tr>
                        <th class="text-left px-3 py-2 font-semibold text-gray-700">Talle</th>
                        <th class="text-left px-3 py-2 font-semibold text-gray-700">Color</th>
                        <th class="text-left px-3 py-2 font-semibold text-gray-700">Precio minorista</th>
                        <th class="text-left px-3 py-2 font-semibold text-gray-700">Precio mayorista</th>
                        <th class="text-left px-3 py-2 font-semibold text-gray-700">Stock</th>
                        <th class="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-blue-100">
                      <tr v-for="variant in product.variants" :key="variant.id" class="bg-white hover:bg-blue-50/30 transition-colors">
                        <td class="px-3 py-2 text-gray-800 font-medium">{{ variant.size }}</td>
                        <td class="px-3 py-2 text-gray-600">{{ variant.color }}</td>
                        <td class="px-3 py-2">
                          <input
                            v-if="editMap.has(variant.id)"
                            type="number"
                            min="0"
                            step="1"
                            :value="editMap.get(variant.id)!.retailPrice"
                            @input="editMap.get(variant.id)!.retailPrice = Number(($event.target as HTMLInputElement).value)"
                            class="w-24 px-2 py-1 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#E91E8C]"
                          />
                        </td>
                        <td class="px-3 py-2">
                          <input
                            v-if="editMap.has(variant.id)"
                            type="number"
                            min="0"
                            step="1"
                            :value="editMap.get(variant.id)!.wholesalePrice"
                            @input="editMap.get(variant.id)!.wholesalePrice = ($event.target as HTMLInputElement).value === '' ? '' : Number(($event.target as HTMLInputElement).value)"
                            placeholder="—"
                            class="w-24 px-2 py-1 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#E91E8C]"
                          />
                        </td>
                        <td class="px-3 py-2">
                          <input
                            v-if="editMap.has(variant.id)"
                            type="number"
                            min="0"
                            step="1"
                            :value="editMap.get(variant.id)!.stock"
                            @input="editMap.get(variant.id)!.stock = Number(($event.target as HTMLInputElement).value)"
                            class="w-20 px-2 py-1 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#E91E8C]"
                          />
                        </td>
                        <td class="px-3 py-2">
                          <div class="flex gap-2">
                            <button
                              @click="handleSaveVariant(product.id, variant.id)"
                              class="px-2 py-1 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-700 transition-colors"
                            >
                              Guardar
                            </button>
                            <button
                              @click="handleDeleteVariant(product.id, variant.id, `${variant.size} / ${variant.color}`)"
                              class="px-2 py-1 rounded-lg border border-red-300 text-red-600 text-xs font-medium hover:bg-red-50 transition-colors"
                            >
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                      <tr v-if="product.variants.length === 0">
                        <td colspan="6" class="px-3 py-3 text-center text-gray-400 italic">Sin variantes</td>
                      </tr>
                    </tbody>
                  </table>
                  <div class="px-3 py-2 bg-white border-t border-blue-100">
                    <button
                      @click="openAddVariant(product.id)"
                      class="px-3 py-1 rounded-lg border border-[#E91E8C] text-xs font-medium text-[#E91E8C] hover:bg-[#E91E8C] hover:text-white transition-colors"
                    >
                      + Agregar variante
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
  </AppLayout>
</template>
