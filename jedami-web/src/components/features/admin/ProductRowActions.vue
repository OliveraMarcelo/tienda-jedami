<script setup lang="ts">
// Acciones de un producto en la lista del admin. "Eliminar" queda en un menú aparte para no tocarlo sin querer.
import { ref, onBeforeUnmount } from 'vue'

defineProps<{
  variantsCount: number
  variantsOpen: boolean
  discountsOpen: boolean
  /** Con stock no se puede eliminar (se explica en el menú) */
  canDelete: boolean
}>()
const emit = defineEmits<{ edit: []; variants: []; discounts: []; delete: [] }>()

const menuOpen = ref(false)
const root = ref<HTMLElement | null>(null)
function onDocClick(e: MouseEvent) {
  if (root.value && !root.value.contains(e.target as Node)) close()
}
function toggleMenu() {
  menuOpen.value = !menuOpen.value
  if (menuOpen.value) document.addEventListener('click', onDocClick)
  else document.removeEventListener('click', onDocClick)
}
function close() {
  menuOpen.value = false
  document.removeEventListener('click', onDocClick)
}
onBeforeUnmount(close)

const btn = 'whitespace-nowrap h-9 px-3 rounded-lg border text-xs font-semibold transition-colors'
const idle = 'border-[#C9CDD2] text-[var(--a-ink)] hover:bg-[var(--a-bg)]'
const active = 'border-[var(--a-primary)] bg-blue-50 text-[var(--a-primary)]'
</script>

<template>
  <div ref="root" class="relative flex flex-wrap gap-1.5 md:justify-end">
    <button type="button" :class="[btn, idle]" @click="emit('edit')">Editar</button>
    <button type="button" :class="[btn, variantsOpen ? active : idle]" :aria-expanded="variantsOpen" @click="emit('variants')">
      Stock y variantes ({{ variantsCount }})
    </button>
    <button type="button" :class="[btn, discountsOpen ? active : idle]" :aria-expanded="discountsOpen" @click="emit('discounts')">
      Descuentos
    </button>
    <button type="button" :class="[btn, idle, 'px-2.5']" aria-label="Más acciones" :aria-expanded="menuOpen" @click.stop="toggleMenu">⋯</button>

    <div
      v-if="menuOpen"
      role="menu"
      class="absolute right-0 top-10 z-20 w-56 rounded-xl border border-[var(--a-border)] bg-white p-1.5 shadow-lg"
    >
      <button
        v-if="canDelete"
        type="button"
        role="menuitem"
        class="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-red-700 hover:bg-red-50"
        @click="close(); emit('delete')"
      >Eliminar producto</button>
      <p v-else class="px-3 py-2 text-xs text-[var(--a-muted)]">
        No se puede eliminar porque tiene stock. Podés ocultarlo de la tienda con el interruptor "Visible".
      </p>
    </div>
  </div>
</template>
