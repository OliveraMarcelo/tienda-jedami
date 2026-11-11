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
  <div v-if="hasRules || minQuantityPurchase" class="flex flex-col gap-3">
    <p
      v-if="minQuantityPurchase"
      class="inline-flex items-center gap-2 self-start rounded-full bg-[var(--t-sun)] px-4 py-1.5 text-xs font-bold"
    >
      Compra mínima: {{ minQuantityPurchase }} unidades
    </p>

    <div v-if="quantityRules.length > 0" class="rounded-2xl bg-[var(--t-surface)] p-4">
      <p class="mb-2 text-sm font-semibold">Descuentos por cantidad</p>
      <ul class="flex flex-col gap-1.5 text-sm">
        <li v-for="rule in sortedQuantityRules" :key="rule.id" class="flex items-center justify-between">
          <span>Desde {{ rule.min_quantity }} unidades</span>
          <span class="rounded-full bg-[var(--t-highlight)] px-2.5 py-0.5 text-xs font-bold text-[var(--t-highlight-ink)]">{{ rule.discount_pct }}% OFF</span>
        </li>
      </ul>
    </div>

    <div v-if="curvaRules.length > 0" class="rounded-2xl bg-[var(--t-surface)] p-4">
      <p class="mb-2 text-sm font-semibold">Descuentos por curva</p>
      <ul class="flex flex-col gap-1.5 text-sm">
        <li v-for="rule in sortedCurvaRules" :key="rule.id" class="flex items-center justify-between">
          <span>Desde {{ rule.min_curves }} curvas</span>
          <span class="rounded-full bg-[var(--t-highlight)] px-2.5 py-0.5 text-xs font-bold text-[var(--t-highlight-ink)]">{{ rule.discount_pct }}% OFF</span>
        </li>
      </ul>
    </div>
  </div>
</template>
