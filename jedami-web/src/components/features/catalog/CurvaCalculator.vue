<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Product } from '@/types/api'

const props = defineProps<{
  product: Product
}>()

const emit = defineEmits<{
  confirm: [curves: number]
}>()

const curves = ref(1)

interface CurvaRow {
  size: string
  color: string
  requested: number
  available: number
  hasStock: boolean
  subtotal: number
}

// Precio unitario: usa precio mayorista si existe, sino minorista
const unitPrice = computed(() =>
  props.product.wholesalePrice ?? props.product.retailPrice ?? 0
)

const rows = computed<CurvaRow[]>(() =>
  props.product.variants.map(v => ({
    size: v.size,
    color: v.color,
    requested: curves.value,
    available: v.stock.quantity,
    hasStock: v.stock.quantity >= curves.value,
    subtotal: curves.value * unitPrice.value,
  }))
)

const totalUnits = computed(() => rows.value.reduce((s, r) => s + r.requested, 0))
const totalAmount = computed(() => rows.value.reduce((s, r) => s + r.subtotal, 0))
const allHaveStock = computed(() => rows.value.every(r => r.hasStock))
const canConfirm = computed(() => curves.value > 0 && allHaveStock.value && rows.value.length > 0)
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center gap-3">
      <label class="text-sm font-semibold text-gray-700 whitespace-nowrap">Número de curvas</label>
      <input
        v-model.number="curves"
        type="number"
        min="1"
        class="w-24 h-9 rounded-md border border-gray-300 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#E91E8C]"
      />
    </div>

    <div class="overflow-x-auto rounded-xl border border-gray-200">
      <table class="w-full text-sm">
        <thead>
          <tr class="bg-gray-50 text-gray-600">
            <th class="px-3 py-2 text-left font-semibold">Talle</th>
            <th class="px-3 py-2 text-left font-semibold">Color</th>
            <th class="px-3 py-2 text-right font-semibold">Cant.</th>
            <th class="px-3 py-2 text-right font-semibold">Stock</th>
            <th class="px-3 py-2 text-right font-semibold">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in rows"
            :key="`${row.size}-${row.color}`"
            :class="row.hasStock ? 'border-t border-gray-100' : 'border-t border-red-100 bg-red-50'"
          >
            <td class="px-3 py-2 font-medium" :class="row.hasStock ? 'text-gray-800' : 'text-red-700'">{{ row.size }}</td>
            <td class="px-3 py-2" :class="row.hasStock ? 'text-gray-600' : 'text-red-600'">{{ row.color }}</td>
            <td class="px-3 py-2 text-right">{{ row.requested }}</td>
            <td class="px-3 py-2 text-right">
              <span v-if="row.hasStock" class="text-gray-600">{{ row.available }}</span>
              <span v-else class="text-red-600 font-medium text-xs">Sin stock suficiente (disponibles: {{ row.available }})</span>
            </td>
            <td class="px-3 py-2 text-right" :class="row.hasStock ? 'text-gray-800' : 'text-red-600'">
              ${{ row.subtotal.toLocaleString('es-AR') }}
            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr class="border-t-2 border-gray-200 bg-gray-50 font-semibold">
            <td colspan="2" class="px-3 py-2 text-gray-700">Total</td>
            <td class="px-3 py-2 text-right text-gray-700">{{ totalUnits }} uds.</td>
            <td></td>
            <td class="px-3 py-2 text-right text-[#E91E8C]">${{ totalAmount.toLocaleString('es-AR') }}</td>
          </tr>
        </tfoot>
      </table>
    </div>

    <p v-if="!allHaveStock" class="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
      Algunas variantes no tienen stock suficiente para {{ curves }} curvas.
    </p>

    <button
      :disabled="!canConfirm"
      @click="emit('confirm', curves)"
      class="w-full h-10 rounded-xl bg-[#E91E8C] text-white font-semibold text-sm shadow hover:opacity-90 transition-opacity disabled:opacity-40 disabled:pointer-events-none"
    >
      Agregar {{ totalUnits }} uds. al pedido · ${{ totalAmount.toLocaleString('es-AR') }}
    </button>
  </div>
</template>
