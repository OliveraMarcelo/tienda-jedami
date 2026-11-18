<script setup lang="ts">
// Filtro por rango de fechas: atajos (hoy, últimos 7 días…) y un calendario donde se marca
// el primer y el último día. Se aplica apenas el rango queda completo.
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { type DateRange, RANGE_PRESETS, fromYmd, rangeLabel, toYmd } from '@/lib/date-range'

const props = withDefaults(defineProps<{ modelValue: DateRange; label?: string; compact?: boolean }>(), {
  label: 'Fechas',
})
const emit = defineEmits<{ 'update:modelValue': [DateRange] }>()

const open = ref(false)
const root = ref<HTMLElement | null>(null)
// Selección en curso (primer clic marca el inicio; el segundo, el fin)
const draft = ref<DateRange>({ ...props.modelValue })
const hover = ref<string | null>(null)
const month = ref(startOfMonth(props.modelValue.from ? fromYmd(props.modelValue.from) : new Date()))

const today = toYmd(new Date())
const hasValue = computed(() => !!(props.modelValue.from || props.modelValue.to))

function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1) }

const monthTitle = computed(() => month.value.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }))
const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

/** Días del mes visible, con huecos al principio para que el lunes quede primero */
const days = computed(() => {
  const first = month.value
  const offset = (first.getDay() + 6) % 7
  const count = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  const cells: (string | null)[] = Array(offset).fill(null)
  for (let d = 1; d <= count; d++) cells.push(toYmd(new Date(first.getFullYear(), first.getMonth(), d)))
  return cells
})

function shiftMonth(n: number) {
  month.value = new Date(month.value.getFullYear(), month.value.getMonth() + n, 1)
}

// En la compu abre hacia el lado donde entra; en el celular ocupa el ancho del campo
const alignRight = ref(false)
const PANEL_WIDTH = 460
const SM = 640

function toggle() {
  open.value = !open.value
  if (open.value) {
    const rect = root.value?.getBoundingClientRect()
    alignRight.value = window.innerWidth >= SM && !!rect && rect.left + PANEL_WIDTH > window.innerWidth - 8
    draft.value = { ...props.modelValue }
    month.value = startOfMonth(props.modelValue.from ? fromYmd(props.modelValue.from) : new Date())
  }
}

function pick(day: string) {
  const d = draft.value
  if (!d.from || d.to) {
    draft.value = { from: day, to: null }
  } else if (day < d.from) {
    draft.value = { from: day, to: d.from }
    apply()
  } else {
    draft.value = { from: d.from, to: day }
    apply()
  }
}

function apply() {
  emit('update:modelValue', { ...draft.value })
  open.value = false
}

function preset(r: DateRange) {
  draft.value = r
  apply()
}

function clear() {
  draft.value = { from: null, to: null }
  apply()
}

// Extremos para pintar: mientras elige el segundo día, el rango sigue al mouse
const span = computed(() => {
  const { from, to } = draft.value
  if (!from) return null
  const end = to ?? hover.value ?? from
  return end < from ? { a: end, b: from } : { a: from, b: end }
})

function dayClass(day: string) {
  const s = span.value
  const edge = s && (day === s.a || day === s.b)
  const inside = s && day > s.a && day < s.b
  return [
    'relative h-9 text-sm tabular-nums transition-colors',
    edge ? 'rounded-lg bg-[var(--a-primary)] font-semibold text-white'
      : inside ? 'bg-[var(--a-primary-soft)] text-[var(--a-primary)]'
      : 'rounded-lg hover:bg-[var(--a-bg)]',
    day === today && !edge ? 'font-bold text-[var(--a-primary)]' : '',
  ]
}

// Cerrar con clic afuera o Escape
function onDocClick(e: MouseEvent) {
  if (open.value && root.value && !root.value.contains(e.target as Node)) open.value = false
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') open.value = false
}
watch(open, (v) => {
  if (v) {
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
  } else {
    document.removeEventListener('mousedown', onDocClick)
    document.removeEventListener('keydown', onKey)
    hover.value = null
  }
})
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocClick)
  document.removeEventListener('keydown', onKey)
})
</script>

<template>
  <div ref="root" class="relative">
    <span :class="compact ? 'sr-only' : 'mb-1 block text-xs text-[var(--a-muted)]'">{{ label }}</span>
    <div class="flex">
      <button
        type="button"
        :aria-expanded="open"
        aria-haspopup="dialog"
        :class="[
          'flex h-10 w-full items-center gap-2 border border-[#C9CDD2] px-3 text-left text-sm',
          compact ? 'min-w-0' : 'min-w-[210px]',
          hasValue ? 'rounded-l-lg text-[var(--a-ink)]' : 'rounded-lg text-[var(--a-muted)]',
        ]"
        @click="toggle"
      >
        <svg class="h-4 w-4 shrink-0 text-[var(--a-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" /></svg>
        <span class="truncate">{{ compact && !hasValue ? label : rangeLabel(modelValue) }}</span>
      </button>
      <button
        v-if="hasValue"
        type="button"
        class="flex h-10 w-9 shrink-0 items-center justify-center rounded-r-lg border border-l-0 border-[#C9CDD2] text-[var(--a-muted)] hover:text-[var(--a-ink)]"
        aria-label="Quitar filtro de fechas"
        @click="clear"
      >
        <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>
    </div>

    <Transition name="jd-pop">
      <div
        v-if="open"
        role="dialog"
        aria-label="Elegir rango de fechas"
        :class="[
          'absolute top-full z-40 mt-2 flex w-full flex-col sm:w-[460px] overflow-hidden rounded-xl border border-[var(--a-border)] bg-white shadow-[var(--a-shadow-lg)] sm:flex-row',
          alignRight ? 'right-0' : 'left-0',
        ]"
      >
        <!-- Atajos -->
        <div class="flex gap-1 overflow-x-auto [scrollbar-width:none] border-b border-[var(--a-border)] p-2 sm:w-[150px] sm:shrink-0 sm:flex-col sm:border-b-0 sm:border-r">
          <button
            v-for="p in RANGE_PRESETS"
            :key="p.label"
            type="button"
            class="shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm text-[#3A3F47] hover:bg-[var(--a-bg)] hover:text-[var(--a-ink)]"
            @click="preset(p.range())"
          >{{ p.label }}</button>
          <button
            type="button"
            class="shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm text-[var(--a-muted)] hover:bg-[var(--a-bg)]"
            @click="clear"
          >Todas las fechas</button>
        </div>

        <!-- Calendario -->
        <div class="flex-1 p-3" @mouseleave="hover = null">
          <div class="mb-2 flex items-center justify-between">
            <button type="button" class="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-[var(--a-bg)]" aria-label="Mes anterior" @click="shiftMonth(-1)">
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
            </button>
            <span class="inline-block text-sm font-semibold first-letter:uppercase">{{ monthTitle }}</span>
            <button type="button" class="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-[var(--a-bg)]" aria-label="Mes siguiente" @click="shiftMonth(1)">
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
            </button>
          </div>
          <div class="grid grid-cols-7 text-center text-[11px] font-semibold text-[var(--a-muted)]">
            <span v-for="(w, i) in WEEKDAYS" :key="i" class="py-1">{{ w }}</span>
          </div>
          <Transition name="jd-fade" mode="out-in">
            <div :key="monthTitle" class="grid grid-cols-7 gap-y-0.5">
              <template v-for="(day, i) in days" :key="day ?? `e${i}`">
                <span v-if="!day" />
                <button
                  v-else
                  type="button"
                  :class="dayClass(day)"
                  :aria-label="fromYmd(day).toLocaleDateString('es-AR', { dateStyle: 'full' })"
                  @click="pick(day)"
                  @mouseenter="hover = day"
                >{{ Number(day.slice(8)) }}</button>
              </template>
            </div>
          </Transition>
          <p class="mt-2 text-xs text-[var(--a-muted)]">
            {{ draft.from && !draft.to ? 'Ahora elegí el último día' : 'Elegí el primer día y después el último' }}
          </p>
        </div>
      </div>
    </Transition>
  </div>
</template>
