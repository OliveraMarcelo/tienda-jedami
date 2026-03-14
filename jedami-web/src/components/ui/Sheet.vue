<script setup lang="ts">
import { cn } from '@/lib/utils'

interface Props {
  open?: boolean
  side?: 'left' | 'right' | 'bottom'
  class?: string
}

const props = withDefaults(defineProps<Props>(), { open: false, side: 'right' })
const emit = defineEmits<{ 'update:open': [value: boolean] }>()

function close() {
  emit('update:open', false)
}

const sideClasses = {
  left: 'inset-y-0 left-0 h-full w-3/4 max-w-sm border-r',
  right: 'inset-y-0 right-0 h-full w-3/4 max-w-sm border-l',
  bottom: 'inset-x-0 bottom-0 w-full max-h-[80vh] rounded-t-2xl border-t',
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-300"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-200"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="open" class="fixed inset-0 z-50">
        <div class="absolute inset-0 bg-black/50" @click="close" />
        <div
          :class="cn(
            'fixed z-10 bg-white p-6 shadow-xl overflow-y-auto',
            sideClasses[side],
            props.class
          )"
        >
          <slot />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
