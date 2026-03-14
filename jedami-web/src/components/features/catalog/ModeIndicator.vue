<script setup lang="ts">
defineProps<{ mode: 'retail' | 'wholesale' }>()
</script>

<template>
  <span
    :class="[
      'inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold text-white',
      mode === 'retail' ? 'bg-[#E91E8C]' : 'bg-[#1565C0]'
    ]"
    :aria-label="`Modo de compra activo: ${mode === 'retail' ? 'Minorista' : 'Mayorista'}`"
  >
    {{ mode === 'retail' ? '🛍️ Minorista' : '🏭 Mayorista' }}
  </span>
</template>
