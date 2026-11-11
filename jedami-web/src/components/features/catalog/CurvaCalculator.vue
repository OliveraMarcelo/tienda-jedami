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
  <div class="flex flex-col gap-4">
    <div class="flex items-center gap-4">
      <span id="curvas-label" class="text-sm font-semibold">Curvas</span>
      <div class="inline-flex items-center rounded-full border border-[var(--t-border)]" role="group" aria-labelledby="curvas-label">
        <button type="button" aria-label="Restar curva" class="flex h-11 w-11 items-center justify-center rounded-full text-lg hover:bg-[var(--t-surface)]" @click="curves = Math.max(1, curves - 1)">−</button>
        <span class="min-w-[2rem] text-center font-semibold" aria-live="polite">{{ curves }}</span>
        <button type="button" aria-label="Sumar curva" class="flex h-11 w-11 items-center justify-center rounded-full text-lg hover:bg-[var(--t-surface)]" @click="curves++">+</button>
      </div>
    </div>

    <p class="text-sm text-[var(--t-muted)]">Una curva es una unidad de cada talle.</p>

    <div class="overflow-hidden rounded-2xl border border-[var(--t-border)]">
      <table class="w-full text-sm">
        <thead class="bg-[var(--t-surface)] text-xs text-[var(--t-muted)]">
          <tr>
            <th class="px-4 py-2.5 text-left font-semibold">Talle</th>
            <th class="px-4 py-2.5 text-right font-semibold">Unidades</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="size in uniqueSizes" :key="size.id" class="border-t border-[var(--t-border)]">
            <td class="px-4 py-2.5 font-medium">{{ size.label }}</td>
            <td class="px-4 py-2.5 text-right">{{ curves }}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr class="border-t border-[var(--t-border)] bg-[var(--t-surface)] font-semibold">
            <td class="px-4 py-2.5">Total</td>
            <td class="px-4 py-2.5 text-right">
              {{ totalUnits }} uds. · <span class="text-[var(--t-price)]">${{ totalAmount.toLocaleString('es-AR', { maximumFractionDigits: 0 }) }}</span>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>

    <button
      type="button"
      :disabled="!canConfirm"
      class="min-h-12 w-full rounded-full bg-[var(--t-ink)] px-6 text-base font-semibold text-white transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-40"
      @click="emit('confirm', curves)"
    >
      Agregar {{ totalUnits }} unidades al pedido
    </button>
  </div>
</template>
