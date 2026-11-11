<script setup lang="ts">
import { ref } from 'vue'
import Sheet from '@/components/ui/Sheet.vue'
import { useAuthStore } from '@/stores/auth.store'
import { CUSTOMER_TYPES } from '@/lib/constants'

defineProps<{ open: boolean }>()
const emit = defineEmits<{
  'update:open': [value: boolean]
  'authenticated': []
}>()

const authStore = useAuthStore()
const tab = ref<'login' | 'registro'>('registro')
const email = ref('')
const password = ref('')
const errorMsg = ref('')
const loading = ref(false)

async function submit() {
  errorMsg.value = ''
  loading.value = true
  try {
    if (tab.value === 'login') {
      await authStore.login(email.value, password.value, false)
    } else {
      await authStore.register(email.value, password.value, CUSTOMER_TYPES.RETAIL, false)
    }
    emit('update:open', false)
    emit('authenticated')
  } catch (err: unknown) {
    const e = err as { response?: { data?: { detail?: string } } }
    errorMsg.value = e.response?.data?.detail ?? 'Error al procesar. Intentá de nuevo.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <Sheet :open="open" side="bottom" @update:open="emit('update:open', $event)">
    <div class="mx-auto max-w-sm">
      <h2 class="mb-1 text-xl font-bold">Ingresá para comprar</h2>
      <p class="mb-5 text-sm text-[var(--t-muted)]">Creá tu cuenta en un minuto o ingresá si ya tenés una.</p>

      <div role="tablist" class="mb-5 inline-flex w-full rounded-full bg-[var(--t-surface)] p-1">
        <button
          type="button"
          role="tab"
          :aria-selected="tab === 'registro'"
          :class="['min-h-10 flex-1 rounded-full text-sm font-semibold transition-colors', tab === 'registro' ? 'bg-[var(--t-ink)] text-white' : 'hover:bg-white']"
          @click="tab = 'registro'"
        >
          Crear cuenta
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="tab === 'login'"
          :class="['min-h-10 flex-1 rounded-full text-sm font-semibold transition-colors', tab === 'login' ? 'bg-[var(--t-ink)] text-white' : 'hover:bg-white']"
          @click="tab = 'login'"
        >
          Ya tengo cuenta
        </button>
      </div>

      <form class="flex flex-col gap-4" @submit.prevent="submit">
        <div>
          <label for="gate-email" class="mb-1.5 block text-sm font-medium">Email</label>
          <input
            id="gate-email"
            v-model="email"
            type="email"
            required
            autocomplete="email"
            class="h-12 w-full rounded-full border border-[var(--t-border)] px-5 text-sm outline-none focus:border-[var(--t-ink)]"
          />
        </div>
        <div>
          <label for="gate-password" class="mb-1.5 block text-sm font-medium">Contraseña</label>
          <input
            id="gate-password"
            v-model="password"
            type="password"
            required
            :autocomplete="tab === 'login' ? 'current-password' : 'new-password'"
            class="h-12 w-full rounded-full border border-[var(--t-border)] px-5 text-sm outline-none focus:border-[var(--t-ink)]"
          />
        </div>

        <p v-if="errorMsg" role="alert" class="text-sm text-red-700">{{ errorMsg }}</p>

        <button
          type="submit"
          :disabled="loading"
          class="min-h-12 w-full rounded-full bg-[var(--t-ink)] text-base font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {{ loading ? 'Procesando…' : tab === 'registro' ? 'Crear cuenta y comprar' : 'Ingresar y comprar' }}
        </button>
      </form>
    </div>
  </Sheet>
</template>
