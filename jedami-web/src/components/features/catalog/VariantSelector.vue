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

const uniqueColors = computed(() =>
  [...new Set(props.variants.map(v => v.color))]
)

const sizesForColor = computed(() => {
  if (!props.selectedColor) return []
  return props.variants
    .filter(v => v.color === props.selectedColor)
    .map(v => ({ size: v.size, inStock: v.stock.quantity > 0, quantity: v.stock.quantity }))
})

const selectedVariant = computed(() =>
  props.variants.find(v => v.color === props.selectedColor && v.size === props.selectedSize) ?? null
)

function selectColor(color: string) {
  emit('update:selectedColor', color)
  emit('update:selectedSize', null)
}
</script>

<template>
  <div class="space-y-4">
    <div>
      <p class="text-sm font-semibold text-gray-700 mb-2">Color</p>
      <div class="flex gap-2 flex-wrap">
        <button
          v-for="color in uniqueColors"
          :key="color"
          @click="selectColor(color)"
          :aria-label="`Color ${color}`"
          :class="[
            'w-8 h-8 rounded-full border-2 transition-all',
            selectedColor === color ? 'border-[#E91E8C] scale-110 shadow' : 'border-gray-300 hover:border-gray-400'
          ]"
          :style="{ backgroundColor: color }"
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
