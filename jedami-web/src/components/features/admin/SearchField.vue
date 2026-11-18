<script setup lang="ts">
// Buscador de las tablas del panel: filtra mientras escribís
defineProps<{ modelValue: string; label?: string; placeholder?: string; compact?: boolean }>()
defineEmits<{ 'update:modelValue': [string] }>()
</script>

<template>
  <label class="block min-w-0">
    <span :class="compact ? 'sr-only' : 'mb-1 block text-xs text-[var(--a-muted)]'">{{ label ?? 'Buscar' }}</span>
    <span class="relative block">
      <svg class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--a-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
      <input
        :value="modelValue"
        type="search"
        :placeholder="placeholder"
        class="h-10 w-full rounded-lg border border-[#C9CDD2] pl-9 pr-3 text-sm focus:outline-none"
        @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      />
    </span>
  </label>
</template>
