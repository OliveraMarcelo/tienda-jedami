<script setup lang="ts">
// Grilla talle × color para repartir unidades (estilo compacto): cada casillero lleva la cantidad y,
// pegado, el stock disponible. A la derecha, cuánto lleva cargado cada talle.
import type { PendingProduct } from '@/api/admin.fulfillment.api'
import { type Cells, freeUnits, gridSizes, rowAssigned, sizeTargets } from '@/lib/fulfillment'

const props = defineProps<{ product: PendingProduct; cells: Cells }>()
const emit = defineEmits<{ set: [variantId: number, value: number] }>()

const variantAt = (sizeId: number, colorId: number) =>
  props.product.variants.find(v => v.sizeId === sizeId && v.colorId === colorId)

const qtyOf = (variantId: number) => props.cells[variantId] ?? 0

function onInput(variantId: number, e: Event) {
  const el = e.target as HTMLInputElement
  const n = Math.max(0, Math.floor(Number(el.value.replace(/\D/g, '')) || 0))
  emit('set', variantId, n)
}

/** Lo que pidió el talle (si tiene unidades fijas): para marcar ✓ al completarlo */
const targetOf = (sizeId: number) => sizeTargets(props.product).get(sizeId) ?? 0

/** Estado de la columna "Cargado": justo lo pedido (ok), de más (con o sin sueltas para cubrirlo) o en curso */
function rowState(sizeId: number): 'ok' | 'extra' | 'over' | 'none' {
  const got = rowAssigned(props.product, props.cells, sizeId)
  const target = targetOf(sizeId)
  if (target === 0) return 'none'
  if (got === target) return 'ok'
  if (got > target) return freeUnits(props.product) > 0 ? 'extra' : 'over'
  return 'none'
}
</script>

<template>
  <div class="overflow-x-auto -mx-1 px-1">
    <table class="w-full border-separate border-spacing-0 text-sm">
      <thead>
        <tr>
          <th class="sticky left-0 rounded-l-lg bg-[var(--a-bg)] py-2 pl-3 pr-2 text-left text-[11px] font-semibold uppercase tracking-wide text-[var(--a-muted)]">Talle</th>
          <th
            v-for="c in product.colors"
            :key="c.id"
            class="whitespace-nowrap bg-[var(--a-bg)] px-1.5 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-[var(--a-muted)]"
          >
            <span class="inline-flex items-center gap-1.5">
              <span class="h-3.5 w-3.5 rounded-full border border-black/10" :style="{ backgroundColor: c.hexCode ?? '#ccc' }"></span>
              {{ c.name }}
            </span>
          </th>
          <th class="rounded-r-lg bg-[var(--a-bg)] px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-[var(--a-muted)]">Cargado</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="s in gridSizes(product)" :key="s.id">
          <td class="sticky left-0 border-b border-[var(--a-border)] bg-white py-1.5 pl-3 pr-2 font-bold text-[var(--a-ink)]">{{ s.label }}</td>
          <td v-for="c in product.colors" :key="c.id" class="border-b border-[var(--a-border)] px-1.5 py-1.5 text-center">
            <template v-if="variantAt(s.id, c.id)">
              <span
                class="inline-flex h-9 items-stretch overflow-hidden rounded-[10px] border transition-colors"
                :class="qtyOf(variantAt(s.id, c.id)!.id) > variantAt(s.id, c.id)!.stock
                  ? 'border-red-400'
                  : qtyOf(variantAt(s.id, c.id)!.id) > 0 ? 'border-[var(--a-primary)]' : 'border-[#D1D5DB]'"
              >
                <input
                  type="text"
                  inputmode="numeric"
                  :value="qtyOf(variantAt(s.id, c.id)!.id) || ''"
                  :disabled="variantAt(s.id, c.id)!.stock === 0"
                  :aria-label="`Talle ${s.label} ${c.name}`"
                  placeholder="0"
                  class="w-11 bg-white text-center font-bold outline-none disabled:bg-gray-50 disabled:opacity-50"
                  :class="qtyOf(variantAt(s.id, c.id)!.id) > variantAt(s.id, c.id)!.stock
                    ? 'text-red-600'
                    : qtyOf(variantAt(s.id, c.id)!.id) > 0 ? 'bg-[var(--a-primary-soft)] text-[var(--a-primary)]' : 'text-[var(--a-ink)]'"
                  @input="onInput(variantAt(s.id, c.id)!.id, $event)"
                  @focus="($event.target as HTMLInputElement).select()"
                />
                <span class="flex items-center whitespace-nowrap border-l border-[var(--a-border)] bg-[var(--a-bg)] px-2 text-[11px] text-[var(--a-muted)]">de {{ variantAt(s.id, c.id)!.stock }}</span>
              </span>
            </template>
            <span v-else class="text-[var(--a-muted)]">—</span>
          </td>
          <td
            class="whitespace-nowrap border-b border-[var(--a-border)] px-3 py-1.5 text-right text-xs font-bold"
            :class="{
              'text-green-600': rowState(s.id) === 'ok',
              'text-amber-700': rowState(s.id) === 'extra',
              'text-red-600': rowState(s.id) === 'over',
              'text-[var(--a-muted)]': rowState(s.id) === 'none',
            }"
          >
            {{ rowAssigned(product, cells, s.id) }}<template v-if="rowState(s.id) === 'ok'"> ✓</template>
            <span v-else-if="rowState(s.id) === 'extra'" class="block text-[10px] font-normal">+{{ rowAssigned(product, cells, s.id) - targetOf(s.id) }} suelta</span>
            <span v-else-if="rowState(s.id) === 'over'" class="block text-[10px] font-normal">pide {{ targetOf(s.id) }}</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
