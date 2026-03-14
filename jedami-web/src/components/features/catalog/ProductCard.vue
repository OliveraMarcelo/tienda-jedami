<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import type { Product } from '@/types/api'

const props = defineProps<{
  product: Product
  mode: 'retail' | 'wholesale'
}>()

const hovered = ref(false)

const uniqueColors = computed(() =>
  [...new Set(props.product.variants.map(v => v.color))]
)

const minPrice = computed(() => {
  if (!props.product.variants.length) return null
  if (props.mode === 'wholesale') {
    // Mostrar el menor precio mayorista disponible (o retail como fallback)
    return Math.min(
      ...props.product.variants.map(v => v.wholesalePrice ?? v.retailPrice)
    )
  }
  return Math.min(...props.product.variants.map(v => v.retailPrice))
})

const stockBadge = computed(() => {
  const variants = props.product.variants
  if (!variants.length) return null
  const totalStock = variants.reduce((sum, v) => sum + v.stock.quantity, 0)
  if (totalStock === 0) return { text: 'Sin stock', bg: 'bg-[#F44336]' }
  if (variants.some(v => v.stock.quantity > 0 && v.stock.quantity <= 3))
    return { text: 'Últimas unidades', bg: 'bg-[#FF9800]' }
  return null
})
</script>

<template>
  <RouterLink :to="`/catalogo/${product.id}`" class="group block">
    <div
      class="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm transition-shadow hover:shadow-md"
      @mouseenter="hovered = true"
      @mouseleave="hovered = false"
    >
      <div class="relative aspect-[3/4] bg-gray-100 overflow-hidden">
        <!-- Imagen real del producto -->
        <img
          v-if="product.imageUrl"
          :src="product.imageUrl"
          :alt="product.name"
          class="absolute inset-0 w-full h-full object-cover transition-transform duration-200"
          :class="hovered ? 'scale-105' : 'scale-100'"
          loading="lazy"
        />
        <!-- Placeholder si no hay imagen -->
        <div
          v-else
          class="absolute inset-0 flex items-center justify-center text-gray-300 text-4xl transition-transform duration-200"
          :class="hovered ? 'scale-105' : 'scale-100'"
        >
          🧸
        </div>

        <span
          v-if="stockBadge"
          :class="['absolute top-2 left-2 text-white text-xs font-semibold px-2 py-0.5 rounded-full', stockBadge.bg]"
        >
          {{ stockBadge.text }}
        </span>

        <!-- Badge de categoría -->
        <span
          v-if="product.categoryName"
          class="absolute bottom-2 right-2 bg-white/80 backdrop-blur-sm text-gray-700 text-xs font-medium px-2 py-0.5 rounded-full border border-gray-200"
        >
          {{ product.categoryName }}
        </span>
      </div>

      <div class="p-3">
        <p class="font-semibold text-gray-900 text-sm line-clamp-2 mb-1">{{ product.name }}</p>

        <div class="flex gap-1 mb-2 flex-wrap">
          <span
            v-for="color in uniqueColors"
            :key="color"
            class="w-4 h-4 rounded-full border border-gray-300 inline-block"
            :style="{ backgroundColor: color }"
            :title="color"
          />
        </div>

        <p v-if="minPrice !== null" class="text-sm text-gray-700">
          <span class="text-xs text-gray-500 mr-1">{{ mode === 'wholesale' ? 'Precio mayorista' : 'Precio' }}</span>
          <span class="font-bold text-gray-900">${{ minPrice.toLocaleString('es-AR') }}</span>
        </p>
      </div>
    </div>
  </RouterLink>
</template>
