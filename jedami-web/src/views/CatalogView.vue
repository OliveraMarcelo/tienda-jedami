<script setup lang="ts">
import { onMounted } from 'vue'
import AppLayout from '@/layouts/AppLayout.vue'
import ProductCard from '@/components/features/catalog/ProductCard.vue'
import { useProductsStore } from '@/stores/products.store'
import { useAuthStore } from '@/stores/auth.store'

const productsStore = useProductsStore()
const authStore = useAuthStore()

onMounted(() => {
  productsStore.loadCategories()
  if (productsStore.products.length === 0) {
    productsStore.fetchCatalog(true)
  }
})

function loadMore() {
  productsStore.fetchCatalog()
}
</script>

<template>
  <AppLayout>
    <h1 class="text-2xl font-bold text-gray-900 mb-6">Catálogo</h1>

    <!-- Filtro de categorías -->
    <div v-if="productsStore.categories.length > 0" class="flex gap-2 flex-wrap mb-6">
      <button
        @click="productsStore.filterByCategory(null)"
        :class="[
          'px-4 py-1.5 rounded-full text-sm font-semibold transition-colors border',
          productsStore.selectedCategoryId === null
            ? 'bg-[#E91E8C] text-white border-[#E91E8C]'
            : 'bg-white text-gray-700 border-gray-300 hover:border-[#E91E8C] hover:text-[#E91E8C]',
        ]"
      >
        Todas
      </button>
      <button
        v-for="cat in productsStore.categories"
        :key="cat.id"
        @click="productsStore.filterByCategory(cat.id)"
        :class="[
          'px-4 py-1.5 rounded-full text-sm font-semibold transition-colors border',
          productsStore.selectedCategoryId === cat.id
            ? 'bg-[#E91E8C] text-white border-[#E91E8C]'
            : 'bg-white text-gray-700 border-gray-300 hover:border-[#E91E8C] hover:text-[#E91E8C]',
        ]"
      >
        {{ cat.name }}
      </button>
    </div>

    <div class="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      <ProductCard
        v-for="product in productsStore.products"
        :key="product.id"
        :product="product"
        :mode="authStore.mode"
      />
      <template v-if="productsStore.loading">
        <div
          v-for="n in 8"
          :key="`sk-${n}`"
          class="rounded-2xl bg-gray-200 animate-pulse aspect-[3/4]"
        />
      </template>
    </div>

    <div
      v-if="productsStore.error"
      class="text-center py-16"
    >
      <p class="text-red-500 font-semibold mb-2">{{ productsStore.error }}</p>
      <button
        @click="productsStore.fetchCatalog(true)"
        class="text-sm text-[#E91E8C] hover:underline font-semibold"
      >
        Reintentar
      </button>
    </div>

    <div
      v-else-if="!productsStore.loading && productsStore.products.length === 0"
      class="text-center py-16 text-gray-400"
    >
      No hay productos disponibles.
    </div>

    <div
      v-if="productsStore.products.length < productsStore.total && !productsStore.loading"
      class="mt-8 flex justify-center"
    >
      <button
        @click="loadMore"
        class="px-6 py-2 rounded-full border border-gray-300 text-sm font-semibold text-gray-700 hover:border-[#E91E8C] hover:text-[#E91E8C] transition-colors"
      >
        Cargar más
      </button>
    </div>
  </AppLayout>
</template>
