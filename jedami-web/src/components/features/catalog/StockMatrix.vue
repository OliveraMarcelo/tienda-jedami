<script setup lang="ts">
import { computed } from 'vue'
import type { Variant } from '@/types/api'

const props = defineProps<{ variants: Variant[] }>()

const colors = computed(() => [...new Set(props.variants.map(v => v.color))])
const sizes = computed(() => [...new Set(props.variants.map(v => v.size))])

function getVariant(color: string, size: string) {
  return props.variants.find(v => v.color === color && v.size === size)
}

function stockClass(qty: number | undefined): string {
  if (qty === undefined) return 'bg-gray-100 text-gray-300'
  if (qty === 0) return 'bg-red-100 text-red-700'
  if (qty <= 3) return 'bg-orange-100 text-orange-700'
  return 'bg-green-100 text-green-700'
}

function stockLabel(qty: number | undefined): string {
  if (qty === undefined) return '—'
  if (qty === 0) return '0'
  return String(qty)
}
</script>

<template>
  <div>
    <div class="overflow-x-auto">
      <table class="w-full text-sm border-collapse">
        <thead>
          <tr>
            <th class="text-left p-2 text-gray-500 font-medium">Color \ Talle</th>
            <th
              v-for="size in sizes"
              :key="size"
              class="p-2 text-center text-gray-700 font-semibold"
            >
              {{ size }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="color in colors" :key="color">
            <td class="p-2 font-medium text-gray-700 capitalize">{{ color }}</td>
            <td
              v-for="size in sizes"
              :key="size"
              class="p-2 text-center"
            >
              <span
                :class="['inline-block min-w-[2rem] rounded px-1 py-0.5 font-semibold text-xs', stockClass(getVariant(color, size)?.stock.quantity)]"
              >
                {{ stockLabel(getVariant(color, size)?.stock.quantity) }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="mt-2 flex gap-4 text-xs text-gray-500">
      <span><span class="inline-block w-2 h-2 rounded-full bg-green-500 mr-1"></span>Disponible (&gt;3)</span>
      <span><span class="inline-block w-2 h-2 rounded-full bg-orange-400 mr-1"></span>Últimas unidades (1–3)</span>
      <span><span class="inline-block w-2 h-2 rounded-full bg-red-500 mr-1"></span>Sin stock</span>
    </div>
  </div>
</template>
