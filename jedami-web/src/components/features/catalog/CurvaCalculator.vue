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

const unitPrice = computed(() =>
  props.product.wholesalePrice ?? props.product.retailPrice ?? 0
)

// Talles únicos ordenados por sort_order implícito (orden de aparición en variants)
const uniqueSizes = computed(() => {
  const seen = new Set<number>()
  const result: { id: number; label: string }[] = []
  for (const v of props.product.variants) {
    if (!seen.has(v.sizeId)) {
      seen.add(v.sizeId)
      result.push({ id: v.sizeId, label: v.size })
    }
  }
  return result
})

const totalUnits = computed(() => uniqueSizes.value.length * curves.value)
const totalAmount = computed(() => totalUnits.value * unitPrice.value)
const canConfirm = computed(() => curves.value > 0 && props.product.variants.length > 0)
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center gap-3">
      <label class="text-sm font-semibold text-gray-700 whitespace-nowrap">Número de curvas</label>
      <div class="flex items-center border border-gray-300 rounded-lg overflow-hidden">
        <button
          type="button"
          @click="curves = Math.max(1, curves - 1)"
          class="px-3 py-1.5 text-gray-600 hover:bg-gray-50 transition-colors"
        >−</button>
        <span class="px-3 py-1.5 text-sm font-semibold min-w-[2rem] text-center">{{ curves }}</span>
        <button
          type="button"
          @click="curves++"
          class="px-3 py-1.5 text-gray-600 hover:bg-gray-50 transition-colors"
        >+</button>
      </div>
    </div>

    <!-- Tabla Talle × Unidades -->
    <div class="overflow-x-auto rounded-xl border border-blue-100">
      <table class="w-full text-xs border-collapse">
        <thead class="bg-blue-50 border-b border-blue-100">
          <tr>
            <th class="px-3 py-2 text-left font-semibold text-gray-700">Talle</th>
            <th class="px-3 py-2 text-center font-semibold text-gray-700">Uds. por curva</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-blue-100 bg-white">
          <tr
            v-for="size in uniqueSizes"
            :key="size.id"
            class="hover:bg-blue-50/30 transition-colors"
          >
            <td class="px-3 py-2 font-semibold text-gray-700">{{ size.label }}</td>
            <td class="px-3 py-2 text-center text-gray-700">{{ curves }}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr class="border-t-2 border-blue-100 bg-blue-50/60 font-semibold text-sm">
            <td class="px-3 py-2 text-gray-700">Total</td>
            <td class="px-3 py-2 text-right text-[var(--color-primary)]">
              {{ totalUnits }} uds. · ${{ totalAmount.toLocaleString('es-AR', { maximumFractionDigits: 0 }) }}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>

    <button
      :disabled="!canConfirm"
      @click="emit('confirm', curves)"
      class="w-full h-10 rounded-xl bg-[var(--color-primary)] text-white font-semibold text-sm shadow hover:opacity-90 transition-opacity disabled:opacity-40 disabled:pointer-events-none"
    >
      Agregar {{ totalUnits }} uds. al pedido · ${{ totalAmount.toLocaleString('es-AR', { maximumFractionDigits: 0 }) }}
    </button>
  </div>
</template>
