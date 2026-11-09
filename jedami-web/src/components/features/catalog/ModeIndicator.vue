<script setup lang="ts">
import { computed } from 'vue'
import { MODES, type Mode } from '@/lib/constants'
import { useConfigStore } from '@/stores/config.store'

const props = defineProps<{ mode: Mode }>()
const emit = defineEmits<{ toggle: [] }>()

const configStore = useConfigStore()

const options = computed(() => [
  { code: MODES.RETAIL, label: configStore.config.priceModes.find(pm => pm.code === MODES.RETAIL)?.label ?? 'Minorista' },
  { code: MODES.WHOLESALE, label: configStore.config.priceModes.find(pm => pm.code === MODES.WHOLESALE)?.label ?? 'Mayorista' },
])

function select(code: Mode) {
  if (code !== props.mode) emit('toggle')
}
</script>

<template>
  <div
    role="group"
    aria-label="Tipo de precio"
    class="inline-flex items-center rounded-full bg-[var(--t-surface)] p-1"
  >
    <button
      v-for="opt in options"
      :key="opt.code"
      type="button"
      :aria-pressed="mode === opt.code"
      @click="select(opt.code)"
      :class="[
        'min-h-9 rounded-full px-3 sm:px-4 text-xs sm:text-[13px] font-semibold transition-colors',
        mode === opt.code
          ? 'bg-[var(--mode-accent)] text-[var(--mode-accent-text)] shadow-sm'
          : 'text-[var(--t-ink)] hover:bg-white/70',
      ]"
    >
      {{ opt.label }}
    </button>
  </div>
</template>
