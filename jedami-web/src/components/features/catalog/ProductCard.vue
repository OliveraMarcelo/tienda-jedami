<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import type { Product } from '@/types/api'
import { MODES, type Mode } from '@/lib/constants'

const props = defineProps<{
  product: Product
  mode: Mode
}>()

const uniqueColors = computed(() => {
  const seen = new Set<number>()
  const result: { name: string; hexCode: string | null }[] = []
  for (const v of props.product.variants) {
    if (!seen.has(v.colorId)) {
      seen.add(v.colorId)
      result.push({ name: v.color, hexCode: v.hexCode })
    }
  }
  return result
})

const displayPrice = computed(() => {
  if (props.mode === MODES.WHOLESALE) {
    return props.product.wholesalePrice ?? props.product.retailPrice
  }
  return props.product.retailPrice
})

const stockBadge = computed(() => {
  const variants = props.product.variants
  if (!variants.length) return null
  const totalStock = variants.reduce((sum, v) => sum + v.stock.quantity, 0)
  if (totalStock === 0) return { text: 'Sin stock', cls: 'bg-[var(--t-ink)] text-white' }
  if (variants.some(v => v.stock.quantity > 0 && v.stock.quantity <= 3))
    return { text: 'Últimas unidades', cls: 'bg-[var(--t-sun)] text-[var(--t-ink)]' }
  return null
})

const formatPrice = (n: number) => `$${n.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`
</script>

<template>
  <RouterLink :to="`/catalogo/${product.id}`" class="group flex flex-col gap-2.5">
    <div class="relative aspect-[3/4] overflow-hidden rounded-[var(--t-radius-card)] bg-[var(--t-surface)]">
      <img
        v-if="product.imageUrl"
        :src="product.imageUrl"
        :alt="product.name"
        class="absolute inset-0 h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-105"
        loading="lazy"
      />
      <div v-else class="absolute inset-0 flex items-center justify-center text-[var(--t-muted)]">
        <svg class="h-12 w-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M3 5h18v14H3z" /><path d="M3 15l5-5 4 4 3-3 6 6" /></svg>
      </div>

      <span
        v-if="stockBadge"
        :class="['absolute left-3.5 top-3.5 rounded-full px-2.5 py-1 text-xs font-bold', stockBadge.cls]"
      >
        {{ stockBadge.text }}
      </span>
    </div>

    <p class="mt-1 text-sm sm:text-[15px] font-medium uppercase tracking-[0.3px] line-clamp-2">{{ product.name }}</p>

    <div v-if="displayPrice !== null" class="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
      <span class="text-lg sm:text-xl font-bold text-[var(--t-price)]">{{ formatPrice(displayPrice!) }}</span>
      <span v-if="mode === MODES.WHOLESALE" class="text-xs text-[var(--t-muted)]">Precio mayorista</span>
    </div>

    <div v-if="uniqueColors.length" class="flex flex-wrap gap-1.5" :aria-label="`Colores: ${uniqueColors.map(c => c.name).join(', ')}`">
      <span
        v-for="c in uniqueColors"
        :key="c.name"
        class="h-4 w-4 rounded-full border border-[var(--t-border)]"
        :style="{ backgroundColor: c.hexCode ?? '#E5E7EB' }"
        :title="c.name"
      />
    </div>
  </RouterLink>
</template>
