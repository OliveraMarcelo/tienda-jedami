<script setup lang="ts">
import { computed } from 'vue'
import type { QuantityDiscountRule, CurvaDiscountRule } from '@/types/api'

const props = defineProps<{
  quantityRules: QuantityDiscountRule[]
  curvaRules: CurvaDiscountRule[]
  minQuantityPurchase?: number | null
}>()

const sortedQuantityRules = computed(() =>
  [...props.quantityRules].sort((a, b) => a.min_quantity - b.min_quantity),
)
const sortedCurvaRules = computed(() =>
  [...props.curvaRules].sort((a, b) => a.min_curves - b.min_curves),
)
const hasRules = computed(() => props.quantityRules.length > 0 || props.curvaRules.length > 0)
</script>

<template>
  <div v-if="hasRules || minQuantityPurchase" class="space-y-3">
    <!-- Mínimo de compra -->
    <div
      v-if="minQuantityPurchase"
      class="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold px-3 py-1"
    >
      <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      Mínimo de compra: {{ minQuantityPurchase }} unidades
    </div>

    <!-- Escalones por cantidad -->
    <div v-if="quantityRules.length > 0">
      <p class="text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Descuentos por cantidad</p>
      <table class="w-full text-sm border border-gray-100 rounded-xl overflow-hidden">
        <thead class="bg-gray-50 text-gray-500 text-xs">
          <tr>
            <th class="px-3 py-2 text-left font-medium">Desde (unidades)</th>
            <th class="px-3 py-2 text-right font-medium">Descuento</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="rule in sortedQuantityRules"
            :key="rule.id"
            class="border-t border-gray-100"
          >
            <td class="px-3 py-2 text-gray-700">{{ rule.min_quantity }} uds.</td>
            <td class="px-3 py-2 text-right">
              <span class="inline-block rounded-full bg-green-50 border border-green-200 text-green-700 font-semibold text-xs px-2 py-0.5">
                {{ rule.discount_pct }}% off
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Escalones por curva -->
    <div v-if="curvaRules.length > 0">
      <p class="text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Descuentos por curva</p>
      <table class="w-full text-sm border border-gray-100 rounded-xl overflow-hidden">
        <thead class="bg-gray-50 text-gray-500 text-xs">
          <tr>
            <th class="px-3 py-2 text-left font-medium">Desde (curvas)</th>
            <th class="px-3 py-2 text-right font-medium">Descuento</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="rule in sortedCurvaRules"
            :key="rule.id"
            class="border-t border-gray-100"
          >
            <td class="px-3 py-2 text-gray-700">{{ rule.min_curves }} curvas</td>
            <td class="px-3 py-2 text-right">
              <span class="inline-block rounded-full bg-green-50 border border-green-200 text-green-700 font-semibold text-xs px-2 py-0.5">
                {{ rule.discount_pct }}% off
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
