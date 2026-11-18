<script setup lang="ts">
// Acciones de un producto en la lista del admin: "Editar" a la vista y el resto en el menú "⋯",
// así la fila entra en una sola línea. "Eliminar" va al final para no tocarlo sin querer.
// El menú se posiciona fijo en la pantalla para que no lo corte el contenedor de la tabla.
import { ref, onBeforeUnmount } from 'vue'

defineProps<{
  variantsCount: number
  /** Con stock no se puede eliminar (se explica en el menú) */
  canDelete: boolean
}>()
const emit = defineEmits<{ edit: []; variants: []; discounts: []; delete: [] }>()

const menuOpen = ref(false)
const root = ref<HTMLElement | null>(null)
const trigger = ref<HTMLElement | null>(null)
const pos = ref({ top: 0, right: 0, up: false })

function onDocClick(e: Event) {
  if (root.value && !root.value.contains(e.target as Node)) close()
}
function listen(on: boolean) {
  const m = on ? 'addEventListener' : 'removeEventListener'
  document[m]('click', onDocClick)
  window[m]('scroll', close, true)
  window[m]('resize', close)
}
function toggleMenu() {
  if (menuOpen.value) return close()
  const r = trigger.value!.getBoundingClientRect()
  // Abre hacia arriba si no entra abajo
  const up = r.bottom + 190 > window.innerHeight
  pos.value = { top: up ? r.top - 6 : r.bottom + 6, right: window.innerWidth - r.right, up }
  menuOpen.value = true
  listen(true)
}
function close() {
  menuOpen.value = false
  listen(false)
}
function pick(action: 'variants' | 'discounts' | 'delete') {
  close()
  if (action === 'variants') emit('variants')
  else if (action === 'discounts') emit('discounts')
  else emit('delete')
}
onBeforeUnmount(close)

const btn = 'inline-flex h-8 items-center whitespace-nowrap rounded-lg border border-[#C9CDD2] px-3 text-xs font-semibold text-[var(--a-ink)] transition-colors hover:bg-[var(--a-bg)]'
const item = 'flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--a-bg)]'
</script>

<template>
  <div ref="root" class="flex items-center justify-end gap-1.5">
    <button type="button" :class="btn" @click="emit('edit')">Editar</button>
    <button
      ref="trigger"
      type="button"
      :class="[btn, 'px-2.5']"
      aria-label="Más acciones"
      aria-haspopup="menu"
      :aria-expanded="menuOpen"
      @click.stop="toggleMenu"
    >⋯</button>

    <Teleport to="body">
      <Transition name="jd-pop">
        <div
          v-if="menuOpen"
          role="menu"
          class="admin-ui fixed z-50 w-60 rounded-xl border border-[var(--a-border)] bg-white p-1.5 shadow-[var(--a-shadow-lg)]"
          :style="{ right: `${pos.right}px`, top: `${pos.top}px`, transform: pos.up ? 'translateY(-100%)' : undefined }"
          @click.stop
        >
          <button type="button" role="menuitem" :class="item" @click="pick('variants')">
            Stock y variantes <span class="text-xs text-[var(--a-muted)]">{{ variantsCount }}</span>
          </button>
          <button type="button" role="menuitem" :class="item" @click="pick('discounts')">Descuentos por mayor</button>
          <div class="my-1 border-t border-[var(--a-border)]"></div>
          <button
            v-if="canDelete"
            type="button"
            role="menuitem"
            :class="[item, 'font-semibold text-red-700 hover:bg-red-50']"
            @click="pick('delete')"
          >Eliminar producto</button>
          <p v-else class="px-3 py-2 text-xs text-[var(--a-muted)]">
            No se puede eliminar porque tiene stock. Podés ocultarlo de la tienda con el interruptor "Visible".
          </p>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
