<script setup lang="ts">
// Panel que entra desde la derecha con el detalle de una fila (pedido, cliente, stock…).
// Se cierra con la X, con Escape o tocando afuera.
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'

const props = withDefaults(defineProps<{ open: boolean; title: string; subtitle?: string; size?: 'md' | 'lg' }>(), {
  subtitle: '',
  size: 'md',
})
const emit = defineEmits<{ 'update:open': [boolean] }>()

const panel = ref<HTMLElement | null>(null)

function close() {
  emit('update:open', false)
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
}

watch(() => props.open, async (v) => {
  if (v) {
    document.addEventListener('keydown', onKey)
    await nextTick()
    panel.value?.focus()
  } else {
    document.removeEventListener('keydown', onKey)
  }
}, { immediate: true })

onBeforeUnmount(() => document.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <div class="admin-ui">
      <Transition enter-active-class="transition-opacity duration-200" enter-from-class="opacity-0" leave-active-class="transition-opacity duration-150" leave-to-class="opacity-0">
        <div v-if="open" class="fixed inset-0 z-50 bg-[#0B1220]/30 backdrop-blur-[1px]" aria-hidden="true" @click="close" />
      </Transition>
      <Transition
        enter-active-class="transition-transform duration-300 ease-[cubic-bezier(.2,.7,.2,1)]"
        enter-from-class="translate-x-full"
        leave-active-class="transition-transform duration-200 ease-in"
        leave-to-class="translate-x-full"
      >
        <aside
          v-if="open"
          ref="panel"
          role="dialog"
          aria-modal="true"
          :aria-label="title"
          tabindex="-1"
          :class="[
            'fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-white text-[var(--a-ink)] shadow-[var(--a-shadow-lg)] outline-none',
            size === 'lg' ? 'sm:max-w-[760px]' : 'sm:max-w-[460px]',
          ]"
        >
          <header class="flex items-start gap-3 border-b border-[var(--a-border)] px-5 py-4">
            <div class="min-w-0 flex-1">
              <h2 class="truncate text-lg font-semibold tracking-[-0.01em]">{{ title }}</h2>
              <p v-if="subtitle" class="truncate text-sm text-[var(--a-muted)]">{{ subtitle }}</p>
            </div>
            <button
              type="button"
              class="-mr-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--a-muted)] hover:bg-[var(--a-bg)] hover:text-[var(--a-ink)]"
              aria-label="Cerrar"
              @click="close"
            >
              <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </header>
          <div class="flex-1 overflow-y-auto px-5 py-4">
            <slot />
          </div>
          <footer v-if="$slots.footer" class="border-t border-[var(--a-border)] px-5 py-3">
            <slot name="footer" />
          </footer>
        </aside>
      </Transition>
    </div>
  </Teleport>
</template>
