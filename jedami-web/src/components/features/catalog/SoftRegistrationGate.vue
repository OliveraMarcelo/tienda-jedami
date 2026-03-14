<script setup lang="ts">
import { ref } from 'vue'
import Sheet from '@/components/ui/Sheet.vue'
import { useAuthStore } from '@/stores/auth.store'

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
      await authStore.register(email.value, password.value, false)
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
    <div class="max-w-sm mx-auto">
      <h2 class="text-lg font-bold text-gray-900 mb-1">Crear cuenta para comprar</h2>
      <p class="text-sm text-gray-500 mb-5">Registrate o ingresá para continuar con tu compra.</p>

      <!-- Tabs -->
      <div class="flex gap-4 mb-5 border-b border-gray-200">
        <button
          @click="tab = 'registro'"
          :class="[
            'pb-2 text-sm font-semibold border-b-2 transition-colors',
            tab === 'registro' ? 'border-[#E91E8C] text-[#E91E8C]' : 'border-transparent text-gray-500'
          ]"
        >
          Crear cuenta
        </button>
        <button
          @click="tab = 'login'"
          :class="[
            'pb-2 text-sm font-semibold border-b-2 transition-colors',
            tab === 'login' ? 'border-[#E91E8C] text-[#E91E8C]' : 'border-transparent text-gray-500'
          ]"
        >
          Ya tengo cuenta
        </button>
      </div>

      <form @submit.prevent="submit" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            v-model="email"
            type="email"
            required
            autocomplete="email"
            class="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#E91E8C]"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
          <input
            v-model="password"
            type="password"
            required
            autocomplete="current-password"
            class="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#E91E8C]"
          />
        </div>

        <p v-if="errorMsg" class="text-sm text-red-600">{{ errorMsg }}</p>

        <button
          type="submit"
          :disabled="loading"
          class="w-full h-10 rounded-xl bg-[#E91E8C] text-white font-semibold text-sm shadow hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {{ loading ? 'Procesando…' : tab === 'registro' ? 'Crear cuenta y comprar' : 'Ingresar y comprar' }}
        </button>
      </form>
    </div>
  </Sheet>
</template>
