<script setup lang="ts">
import { computed } from 'vue'
import type { Variant } from '@/types/api'

const props = defineProps<{
  variants: Variant[]
  selectedColor: string | null
  selectedSize: string | null
}>()

const emit = defineEmits<{
  'update:selectedColor': [value: string]
  'update:selectedSize': [value: string | null]
}>()

function needsDarkBorder(hexCode: string | null): boolean {
  if (!hexCode) return false
  const light = ['#FFFFFF', '#FFF', '#FFFDE7', '#FFF176', '#F5F5DC', '#D7CCC8', '#F48FB1', '#81D4FA', '#A5D6A7', '#EF9A9A', '#FFCC80', '#CE93D8', '#FFF176']
  return light.some(c => hexCode.toUpperCase().startsWith(c.toUpperCase()))
}

const uniqueColors = computed(() => {
  const seen = new Set<number>()
  const result: { name: string; hexCode: string | null }[] = []
  for (const v of props.variants) {
    if (!seen.has(v.colorId)) {
      seen.add(v.colorId)
      result.push({ name: v.color, hexCode: v.hexCode })
    }
  }
  return result
})

const sizesForColor = computed(() => {
  if (!props.selectedColor) return []
  return props.variants
    .filter(v => v.color === props.selectedColor)
    .map(v => ({ size: v.size, inStock: v.stock.quantity > 0, quantity: v.stock.quantity }))
})

const selectedVariant = computed(() =>
  props.variants.find(v => v.color === props.selectedColor && v.size === props.selectedSize) ?? null
)

function selectColor(colorName: string) {
  emit('update:selectedColor', colorName)
  emit('update:selectedSize', null)
}
</script>

<template>
  <div class="space-y-4">
    <div>
      <p class="text-sm font-semibold text-gray-700 mb-2">Color</p>
      <div class="flex gap-2 flex-wrap">
        <button
          v-for="c in uniqueColors"
          :key="c.name"
          @click="selectColor(c.name)"
          :aria-label="`Color ${c.name}`"
          :title="c.name"
          :class="[
            'w-8 h-8 rounded-full border-2 transition-all',
            selectedColor === c.name ? 'border-[#E91E8C] scale-110 shadow' : needsDarkBorder(c.hexCode) ? 'border-gray-400' : 'border-gray-300 hover:border-gray-400'
          ]"
          :style="c.hexCode ? { backgroundColor: c.hexCode } : { backgroundColor: '#BDBDBD' }"
        />
      </div>
    </div>

    <div v-if="selectedColor">
      <p class="text-sm font-semibold text-gray-700 mb-2">Talle</p>
      <div class="flex gap-2 flex-wrap">
        <button
          v-for="item in sizesForColor"
          :key="item.size"
          @click="item.inStock && emit('update:selectedSize', item.size)"
          :aria-disabled="!item.inStock"
          :class="[
            'px-3 py-1 rounded-md border text-sm font-medium transition-all',
            selectedSize === item.size
              ? 'border-[#E91E8C] bg-[#E91E8C] text-white'
              : 'border-gray-300 bg-white text-gray-900',
            !item.inStock
              ? 'line-through opacity-50 cursor-not-allowed'
              : 'hover:border-[#E91E8C] cursor-pointer'
          ]"
        >
          {{ item.size }}
        </button>
      </div>

      <p v-if="selectedVariant" class="mt-2 text-sm text-gray-500">
        <span v-if="selectedVariant.stock.quantity === 0" class="text-[#F44336]">Sin stock</span>
        <span v-else-if="selectedVariant.stock.quantity <= 3" class="text-[#FF9800]">
          Últimas {{ selectedVariant.stock.quantity }} unidades
        </span>
        <span v-else class="text-[#4CAF50]">{{ selectedVariant.stock.quantity }} disponibles</span>
      </p>
    </div>
  </div>
</template>
