<script setup lang="ts">
// Pie de tabla: "1–10 de 42 pedidos" y los números de página
import { computed } from 'vue'
import { PAGE_SIZE } from '@/lib/date-range'

const props = withDefaults(defineProps<{ page: number; total: number; pageSize?: number; noun?: string }>(), {
  pageSize: PAGE_SIZE,
  noun: 'resultados',
})
const emit = defineEmits<{ 'update:page': [number] }>()

const pages = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)))
const first = computed(() => (props.total === 0 ? 0 : (props.page - 1) * props.pageSize + 1))
const last = computed(() => Math.min(props.total, props.page * props.pageSize))

/** Páginas a mostrar: primera, última y las vecinas de la actual; '…' en los saltos */
const items = computed<(number | '…')[]>(() => {
  const n = pages.value
  const p = props.page
  const set = new Set([1, n, p - 1, p, p + 1].filter(x => x >= 1 && x <= n))
  const sorted = [...set].sort((a, b) => a - b)
  const out: (number | '…')[] = []
  sorted.forEach((x, i) => {
    if (i > 0 && x - sorted[i - 1]! > 1) out.push('…')
    out.push(x)
  })
  return out
})

function go(p: number) {
  if (p >= 1 && p <= pages.value && p !== props.page) emit('update:page', p)
}

const btn = 'flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-sm transition-colors disabled:pointer-events-none disabled:opacity-40'
</script>

<template>
  <div class="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--a-border)] px-4 py-3 text-sm text-[var(--a-muted)]">
    <span class="tabular-nums">
      <template v-if="total">{{ first }}–{{ last }} de {{ total }} {{ noun }}</template>
      <template v-else>Sin {{ noun }}</template>
    </span>
    <nav v-if="pages > 1" aria-label="Paginación" class="flex items-center gap-1">
      <button type="button" :class="[btn, 'hover:bg-[var(--a-bg)]']" :disabled="page <= 1" aria-label="Página anterior" @click="go(page - 1)">
        <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
      </button>
      <template v-for="(it, i) in items" :key="`${it}-${i}`">
        <span v-if="it === '…'" class="px-1">…</span>
        <button
          v-else
          type="button"
          :aria-current="it === page ? 'page' : undefined"
          :class="[btn, 'tabular-nums', it === page ? 'bg-[var(--a-primary-soft)] font-semibold text-[var(--a-primary)]' : 'hover:bg-[var(--a-bg)] hover:text-[var(--a-ink)]']"
          @click="go(it)"
        >{{ it }}</button>
      </template>
      <button type="button" :class="[btn, 'hover:bg-[var(--a-bg)]']" :disabled="page >= pages" aria-label="Página siguiente" @click="go(page + 1)">
        <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
      </button>
    </nav>
  </div>
</template>
