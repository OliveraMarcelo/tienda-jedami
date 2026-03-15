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
        <div class="absolute inset-0 bg-black/50" @click="emit('update:open', false)" />
        <div class="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
          <h3 class="text-base font-bold text-gray-900 mb-2">{{ title ?? 'Confirmar acción' }}</h3>
          <p class="text-sm text-gray-600 mb-6">{{ message }}</p>
          <div class="flex gap-2 justify-end">
            <button
              type="button"
              @click="emit('update:open', false)"
              class="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              @click="emit('confirm'); emit('update:open', false)"
              :class="[
                'px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors',
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
