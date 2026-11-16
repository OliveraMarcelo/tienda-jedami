<script setup lang="ts">
defineProps<{
  open: boolean
  title?: string
  message: string
  confirmLabel?: string
  confirmClass?: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'confirm': []
}>()
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center">
        <div class="absolute inset-0 bg-[#0B1220]/45 backdrop-blur-[2px]" @click="emit('update:open', false)" />
        <div class="admin-ui relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-[var(--a-shadow-lg)]">
          <h3 class="text-base font-semibold tracking-[-0.01em] text-[var(--a-ink)] mb-1.5">{{ title ?? 'Confirmar acción' }}</h3>
          <p class="text-sm leading-relaxed text-[var(--a-muted)] mb-6">{{ message }}</p>
          <div class="flex gap-2 justify-end">
            <button
              type="button"
              @click="emit('update:open', false)"
              class="h-10 px-4 rounded-[10px] border border-[var(--a-border-strong)] bg-white text-sm font-medium text-[var(--a-ink)] hover:bg-[var(--a-bg)] transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              @click="emit('confirm'); emit('update:open', false)"
              :class="[
                'h-10 px-4 rounded-[10px] text-sm font-semibold text-white shadow-sm transition-colors',
                confirmClass ?? 'bg-red-600 hover:bg-red-700'
              ]"
            >
              {{ confirmLabel ?? 'Eliminar' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
