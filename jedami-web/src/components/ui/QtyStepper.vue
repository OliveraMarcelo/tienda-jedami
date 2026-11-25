<script setup lang="ts">
// Contador de cantidad: botones − y + y un número que también se puede escribir (ej. 100).
// Mientras se escribe se acepta cualquier número; al salir del campo (o con Enter) se ajusta a min/max.
import { ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  min?: number
  max?: number
  /** Texto para lectores de pantalla, ej. "Cantidad total" */
  label: string
  size?: 'md' | 'lg'
}>(), { min: 1, max: undefined, size: 'md' })

const model = defineModel<number>({ required: true })
const text = ref(String(model.value))
watch(model, (v) => { if (Number(text.value) !== v) text.value = String(v) })

const clamp = (n: number) => {
  const hi = props.max ?? Number.POSITIVE_INFINITY
  return Math.min(hi, Math.max(props.min, Math.floor(n)))
}

function onInput(e: Event) {
  const digits = (e.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 5)
  text.value = digits
  ;(e.target as HTMLInputElement).value = digits
  // Se actualiza en vivo si está en rango, para que el resto de la ficha acompañe
  const n = Number(digits)
  if (digits && n >= props.min && (props.max === undefined || n <= props.max)) model.value = n
}

function commit() {
  const n = clamp(Number(text.value) || props.min)
  model.value = n
  text.value = String(n)
}

function step(d: number) {
  model.value = clamp((Number(text.value) || model.value) + d)
  text.value = String(model.value)
}
</script>

<template>
  <div class="inline-flex items-center rounded-full border border-[var(--t-border)]" role="group" :aria-label="label">
    <button
      type="button"
      :aria-label="`Restar (${label})`"
      :disabled="model <= min"
      :class="['flex items-center justify-center rounded-full text-lg hover:bg-[var(--t-surface)] disabled:opacity-30', size === 'lg' ? 'h-12 w-12' : 'h-11 w-11']"
      @click="step(-1)"
    >−</button>
    <input
      :value="text"
      type="text"
      inputmode="numeric"
      pattern="[0-9]*"
      :aria-label="label"
      class="w-14 bg-transparent text-center font-semibold tabular-nums focus:outline-none focus:ring-2 focus:ring-[var(--t-ink)]/20 rounded-md"
      @input="onInput"
      @blur="commit"
      @keydown.enter.prevent="commit"
      @focus="($event.target as HTMLInputElement).select()"
    />
    <button
      type="button"
      :aria-label="`Sumar (${label})`"
      :disabled="max !== undefined && model >= max"
      :class="['flex items-center justify-center rounded-full text-lg hover:bg-[var(--t-surface)] disabled:opacity-30', size === 'lg' ? 'h-12 w-12' : 'h-11 w-11']"
      @click="step(1)"
    >+</button>
  </div>
</template>
