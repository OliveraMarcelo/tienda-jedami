<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import {
  fetchAiStatus,
  generateProductDescription,
  updateGeneration,
  composeDescriptionText,
  type ProductDescriptionResult,
} from '@/api/admin.ai.api'

const props = defineProps<{
  name: string
  categoryName?: string | null
  sizes?: string[]
  colors?: string[]
  productId?: number | null
}>()

const emit = defineEmits<{
  use: [value: { generationId: number; text: string }]
}>()

const enabled = ref(false)
const open = ref(false)
const notes = ref('')
const loading = ref(false)
const elapsed = ref(0)
const error = ref('')
const result = ref<ProductDescriptionResult | null>(null)
let timer: ReturnType<typeof setInterval> | null = null

onMounted(async () => {
  enabled.value = (await fetchAiStatus()).enabled
})

onBeforeUnmount(stopTimer)

function stopTimer() {
  if (timer) clearInterval(timer)
  timer = null
}

// Lo que el admin no usó también sirve de dato para mejorar el modelo
function discardCurrent() {
  if (result.value) {
    updateGeneration(result.value.generationId, { status: 'discarded', productId: props.productId ?? null }).catch(() => {})
  }
  result.value = null
}

async function generate() {
  if (props.name.trim().length < 2) {
    error.value = 'Escribí el nombre del producto primero.'
    return
  }
  discardCurrent()
  error.value = ''
  loading.value = true
  elapsed.value = 0
  timer = setInterval(() => { elapsed.value++ }, 1000)
  try {
    result.value = await generateProductDescription({
      name: props.name,
      categoryName: props.categoryName ?? null,
      sizes: props.sizes ?? [],
      colors: props.colors ?? [],
      notes: notes.value.trim() || null,
      productId: props.productId ?? null,
    })
  } catch (e: unknown) {
    const err = e as { response?: { data?: { detail?: string } } }
    error.value = err?.response?.data?.detail ?? 'No se pudo generar la descripción. Probá de nuevo.'
  } finally {
    loading.value = false
    stopTimer()
  }
}

function useResult() {
  if (!result.value) return
  emit('use', { generationId: result.value.generationId, text: composeDescriptionText(result.value) })
  result.value = null
  open.value = false
}

function discard() {
  discardCurrent()
  open.value = false
}
</script>

<template>
  <div v-if="enabled" class="mt-2">
    <button
      v-if="!open"
      type="button"
      class="inline-flex items-center gap-1.5 rounded-md border border-[var(--a-primary)]/40 px-3 py-1.5 text-xs font-semibold text-[var(--a-primary)] transition-colors hover:bg-[var(--a-primary)]/5"
      @click="open = true"
    >
      ✨ Generar con IA
    </button>

    <div v-else class="space-y-3 rounded-lg border border-[var(--a-border)] bg-[var(--a-bg)] p-3">
      <div>
        <label class="mb-1 block text-xs font-semibold text-[#45494E]" for="ai-notes">
          Datos extra para la IA <span class="font-normal text-[var(--a-muted)]">(opcional)</span>
        </label>
        <input
          id="ai-notes"
          v-model="notes"
          type="text"
          maxlength="500"
          placeholder="Ej: algodón peinado, buzo con capucha, puño en el pantalón"
          class="flex h-9 w-full rounded-md border border-[#C9CDD2] bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--a-primary)]"
        />
        <p class="mt-1 text-[11px] text-[var(--a-muted)]">
          La IA usa el nombre, la categoría, los talles y los colores. Solo menciona la tela o detalles si los escribís acá.
        </p>
      </div>

      <div v-if="loading" class="flex items-center gap-2 text-sm text-[var(--a-muted)]" aria-live="polite">
        <svg class="h-4 w-4 animate-spin text-[var(--a-primary)]" viewBox="0 0 24 24" fill="none">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
        Generando… puede tardar hasta un minuto ({{ elapsed }} s)
      </div>

      <div v-else-if="result" class="space-y-2 rounded-md border border-[var(--a-border)] bg-white p-3">
        <p v-if="result.title" class="text-sm font-semibold text-[var(--a-ink)]">{{ result.title }}</p>
        <p class="whitespace-pre-line text-sm text-[#45494E]">{{ result.description }}</p>
        <ul v-if="result.highlights.length" class="list-disc space-y-0.5 pl-5 text-sm text-[#45494E]">
          <li v-for="h in result.highlights" :key="h">{{ h }}</li>
        </ul>
        <p class="text-[11px] text-[var(--a-muted)]">
          Revisalo antes de usarlo: la IA puede equivocarse. · {{ result.model }} · {{ (result.durationMs / 1000).toFixed(1) }} s
        </p>
      </div>

      <p v-if="error" role="alert" class="text-xs text-red-600">{{ error }}</p>

      <div class="flex flex-wrap gap-2">
        <button
          v-if="result && !loading"
          type="button"
          class="rounded-md bg-[var(--a-primary)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
          @click="useResult"
        >
          Usar
        </button>
        <button
          type="button"
          :disabled="loading"
          class="rounded-md border border-[#C9CDD2] bg-white px-3 py-1.5 text-xs font-medium text-[#45494E] hover:border-[var(--a-primary)] hover:text-[var(--a-primary)] disabled:pointer-events-none disabled:opacity-50"
          @click="generate"
        >
          {{ result ? 'Regenerar' : 'Generar' }}
        </button>
        <button
          type="button"
          :disabled="loading"
          class="px-2 py-1.5 text-xs text-[var(--a-muted)] hover:text-[#45494E] disabled:opacity-50"
          @click="discard"
        >
          Descartar
        </button>
      </div>
    </div>
  </div>
</template>
