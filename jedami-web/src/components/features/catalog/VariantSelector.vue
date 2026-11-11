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
  <div class="flex flex-col gap-5">
    <fieldset>
      <legend class="mb-2.5 text-sm font-semibold">
        Color<span v-if="selectedColor" class="font-normal text-[var(--t-muted)]">: {{ selectedColor }}</span>
      </legend>
      <div class="flex flex-wrap gap-2.5">
        <button
          v-for="c in uniqueColors"
          :key="c.name"
          type="button"
          :aria-label="`Color ${c.name}`"
          :aria-pressed="selectedColor === c.name"
          :title="c.name"
          :class="[
            'flex h-11 w-11 items-center justify-center rounded-full border-2 transition-colors',
            selectedColor === c.name ? 'border-[var(--t-ink)]' : 'border-transparent hover:border-[var(--t-border)]',
          ]"
          @click="selectColor(c.name)"
        >
          <span
            class="h-8 w-8 rounded-full border"
            :class="needsDarkBorder(c.hexCode) ? 'border-gray-400' : 'border-black/10'"
            :style="{ backgroundColor: c.hexCode ?? '#BDBDBD' }"
          />
        </button>
      </div>
    </fieldset>

    <fieldset v-if="selectedColor">
      <legend class="mb-2.5 text-sm font-semibold">Talle</legend>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="item in sizesForColor"
          :key="item.size"
          type="button"
          :disabled="!item.inStock"
          :aria-pressed="selectedSize === item.size"
          :class="[
            'min-h-11 min-w-[3.25rem] rounded-full border px-4 text-sm font-medium transition-colors',
            selectedSize === item.size
              ? 'border-[var(--t-ink)] bg-[var(--t-ink)] text-white'
              : 'border-[var(--t-border)] bg-white hover:border-[var(--t-ink)]',
            !item.inStock ? 'cursor-not-allowed text-[var(--t-muted)] line-through opacity-50 hover:border-[var(--t-border)]' : '',
          ]"
          @click="emit('update:selectedSize', item.size)"
        >
          {{ item.size }}
        </button>
      </div>

      <p v-if="selectedVariant" class="mt-2.5 text-sm" aria-live="polite">
        <span v-if="selectedVariant.stock.quantity === 0" class="text-red-700">Sin stock</span>
        <span v-else-if="selectedVariant.stock.quantity <= 3" class="font-semibold text-[#B45309]">
          ¡Quedan {{ selectedVariant.stock.quantity }}!
        </span>
        <span v-else class="text-[var(--t-price)]">En stock</span>
      </p>
    </fieldset>
  </div>
</template>
