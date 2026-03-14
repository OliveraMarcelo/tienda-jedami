<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'
import ProductFormDialog from '@/components/features/admin/ProductFormDialog.vue'
import VariantFormDialog from '@/components/features/admin/VariantFormDialog.vue'
import { useAdminProductsStore } from '@/stores/admin.products.store'
import { useAuthStore } from '@/stores/auth.store'
import type { Product } from '@/types/api'

const router = useRouter()
const authStore = useAuthStore()
const adminStore = useAdminProductsStore()

const showProductDialog = ref(false)
const editingProduct = ref<Product | undefined>(undefined)
const showVariantDialog = ref(false)
const variantProductId = ref<number>(0)

if (!authStore.isAdmin) {
  router.push('/catalogo')
}

onMounted(() => {
  adminStore.fetchAll()
})

function openNewProduct() {
  editingProduct.value = undefined
  showProductDialog.value = true
}

function openEditProduct(product: Product) {
  editingProduct.value = product
  showProductDialog.value = true
}

function openAddVariant(productId: number) {
  variantProductId.value = productId
  showVariantDialog.value = true
}

async function handleProductSaved(data: { name: string; description: string }) {
  if (editingProduct.value) {
    await adminStore.updateProduct(editingProduct.value.id, data)
  } else {
    await adminStore.createProduct(data.name, data.description || undefined)
  }
}

async function handleVariantSaved(data: { size: string; color: string; retailPrice: number; initialStock: number }) {
  await adminStore.createVariant(variantProductId.value, data)
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

    <div v-if="adminStore.loading" class="space-y-2">
      <div v-for="n in 5" :key="n" class="h-12 bg-gray-200 rounded-xl animate-pulse" />
    </div>

    <div v-else-if="adminStore.products.length === 0" class="text-center py-16 text-gray-400">
      No hay productos. Creá el primero.
    </div>

    <div v-else class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-gray-50 border-b border-gray-200">
          <tr>
            <th class="text-left px-4 py-3 font-semibold text-gray-700">Nombre</th>
            <th class="text-left px-4 py-3 font-semibold text-gray-700 hidden md:table-cell">Descripción</th>
            <th class="text-center px-4 py-3 font-semibold text-gray-700">Variantes</th>
            <th class="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-for="product in adminStore.products" :key="product.id" class="hover:bg-gray-50 transition-colors">
            <td class="px-4 py-3 font-medium text-gray-900">{{ product.name }}</td>
            <td class="px-4 py-3 text-gray-500 hidden md:table-cell max-w-xs truncate">
              {{ product.description ?? '—' }}
            </td>
            <td class="px-4 py-3 text-center text-gray-600">{{ product.variants.length }}</td>
            <td class="px-4 py-3">
              <div class="flex gap-2 justify-end">
                <button
                  @click="openEditProduct(product)"
                  class="px-3 py-1 rounded-lg border border-gray-300 text-xs font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  Editar
                </button>
                <button
                  @click="openAddVariant(product.id)"
                  class="px-3 py-1 rounded-lg border border-[#E91E8C] text-xs font-medium text-[#E91E8C] hover:bg-[#E91E8C] hover:text-white transition-colors"
                >
                  + Variante
                </button>
              </div>
            </td>
          </tr>
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
