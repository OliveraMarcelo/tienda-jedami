<script setup lang="ts">
import { computed } from 'vue'
import { MODES, type Mode } from '@/lib/constants'
import { useConfigStore } from '@/stores/config.store'

const props = defineProps<{ mode: Mode }>()
defineEmits<{ toggle: [] }>()

const configStore = useConfigStore()

const currentPriceMode = computed(() =>
  configStore.config.priceModes.find(pm => pm.code === props.mode)
)
const otherPriceMode = computed(() =>
  configStore.config.priceModes.find(pm => pm.code !== props.mode)
)
</script>

<template>
  <button
    type="button"
    @click="$emit('toggle')"
    :class="[
      'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold text-white transition-opacity hover:opacity-80',
      mode === MODES.RETAIL ? 'bg-[#E91E8C]' : 'bg-[#1565C0]'
    ]"
    :title="`Ver precios ${otherPriceMode?.label ?? ''}`"
    :aria-label="`Modo activo: ${currentPriceMode?.label ?? mode}. Clic para cambiar.`"
  >
    <span v-if="currentPriceMode?.icon">{{ currentPriceMode.icon }}</span>
    {{ currentPriceMode?.label ?? mode }}
    <svg class="w-3 h-3 opacity-70" viewBox="0 0 20 20" fill="currentColor">
      <path fill-rule="evenodd" d="M10 3a1 1 0 01.707.293l3 3a1 1 0 01-1.414 1.414L10 5.414 7.707 7.707a1 1 0 01-1.414-1.414l3-3A1 1 0 0110 3zm-3.707 9.293a1 1 0 011.414 0L10 14.586l2.293-2.293a1 1 0 011.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" />
    </svg>
  </button>
</template>
