<script setup lang="ts">
import { computed } from 'vue'
import type { Variant } from '@/types/api'

const props = defineProps<{ variants: Variant[] }>()

// Talles únicos ordenados por sizeId (refleja sort_order de la DB)
const sizes = computed(() => {
  const seen = new Set<number>()
  const result: { id: number; label: string }[] = []
  for (const v of [...props.variants].sort((a, b) => a.sizeId - b.sizeId)) {
    if (!seen.has(v.sizeId)) {
      seen.add(v.sizeId)
      result.push({ id: v.sizeId, label: v.size })
    }
  }
  return result
})

// Colores únicos en orden de aparición
const colors = computed(() => {
  const seen = new Set<number>()
  const result: { id: number; name: string }[] = []
  for (const v of props.variants) {
    if (!seen.has(v.colorId)) {
      seen.add(v.colorId)
      result.push({ id: v.colorId, name: v.color })
    }
  }
  return result
})

function getQty(sizeId: number, colorId: number): number | undefined {
  return props.variants.find(v => v.sizeId === sizeId && v.colorId === colorId)?.stock.quantity
}

function stockClass(qty: number | undefined): string {
  if (qty === undefined) return 'text-gray-300'
  if (qty === 0) return 'text-red-600 font-semibold'
  if (qty <= 3) return 'text-orange-600 font-semibold'
  return 'text-gray-800'
}

function stockLabel(qty: number | undefined): string {
  if (qty === undefined) return '—'
  return String(qty)
}

const totalStock = computed(() =>
  props.variants.reduce((sum, v) => sum + v.stock.quantity, 0)
)
</script>

<template>
  <div class="space-y-3">
    <div class="overflow-x-auto rounded-xl border border-gray-200">
      <table class="w-full text-sm border-collapse">
        <thead>
          <tr class="bg-gray-50">
            <th class="px-3 py-2 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">
              Talle \ Color
            </th>
            <th
              v-for="color in colors"
              :key="color.id"
              class="px-3 py-2 text-center text-xs font-semibold text-gray-700 whitespace-nowrap"
            >
              {{ color.name }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="size in sizes"
            :key="size.id"
            class="border-t border-gray-100 hover:bg-gray-50 transition-colors"
          >
            <td class="px-3 py-2 font-semibold text-gray-700 whitespace-nowrap">
              {{ size.label }}
            </td>
            <td
              v-for="color in colors"
              :key="color.id"
              class="px-3 py-2 text-center"
              :class="stockClass(getQty(size.id, color.id))"
            >
              {{ stockLabel(getQty(size.id, color.id)) }}
            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr class="border-t-2 border-gray-200 bg-gray-50">
            <td class="px-3 py-2 text-xs font-semibold text-gray-500" :colspan="colors.length + 1">
              Total de stock: <span class="text-gray-800 font-bold">{{ totalStock }}</span>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>

    <div class="flex gap-4 text-xs text-gray-500">
      <span><span class="inline-block w-2 h-2 rounded-full bg-gray-600 mr-1"></span>Disponible (&gt;3)</span>
      <span><span class="inline-block w-2 h-2 rounded-full bg-orange-400 mr-1"></span>Últimas (1–3)</span>
      <span><span class="inline-block w-2 h-2 rounded-full bg-red-500 mr-1"></span>Sin stock (0)</span>
      <span><span class="text-gray-300 mr-1">—</span>No aplica</span>
    </div>
  </div>
</template>
