<script setup lang="ts">
import { ref, computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import AppLayout from '@/layouts/AppLayout.vue'

const authStore = useAuthStore()

const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const passwordVisible = ref(false)
const loading = ref(false)
const serverError = ref('')

const emailTouched = ref(false)
const passwordTouched = ref(false)
const confirmTouched = ref(false)

const emailError = computed(() => {
  if (!emailTouched.value) return ''
  if (!email.value) return 'El email es requerido'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) return 'El email no es válido'
  return ''
})

const passwordError = computed(() => {
  if (!passwordTouched.value) return ''
  if (!password.value) return 'La contraseña es requerida'
  if (password.value.length < 8) return 'La contraseña debe tener al menos 8 caracteres'
  return ''
})

const confirmError = computed(() => {
  if (!confirmTouched.value) return ''
  if (!confirmPassword.value) return 'Confirmá tu contraseña'
  if (confirmPassword.value !== password.value) return 'Las contraseñas no coinciden'
  return ''
})

const isValid = computed(() =>
  !emailError.value && !passwordError.value && !confirmError.value &&
  !!email.value && !!password.value && !!confirmPassword.value
)

async function handleSubmit() {
  emailTouched.value = true
  passwordTouched.value = true
  confirmTouched.value = true
  if (!isValid.value) return

  loading.value = true
  serverError.value = ''
  try {
    await authStore.register(email.value, password.value)
  } catch (err: unknown) {
    const e = err as { response?: { data?: { detail?: string } }; __registerOk?: boolean }
    if (e.__registerOk) {
      // Cuenta creada pero el login falló — redirigir al login con mensaje
      serverError.value = 'Cuenta creada. Por favor iniciá sesión.'
    } else {
      serverError.value = (e.response?.data?.detail) ?? 'Error inesperado. Intente nuevamente.'
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AppLayout>
    <div class="min-h-[60vh] flex items-center justify-center">
      <div class="w-full max-w-md">
        <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
          <h1 class="text-2xl font-bold text-gray-900 mb-2">Crear cuenta</h1>
          <p class="text-sm text-gray-500 mb-6">
            Las cuentas nuevas son minoristas.
            <span class="text-blue-600">¿Sos mayorista?</span>
            Registrate y contactá al administrador para activar tu acceso mayorista.
          </p>

          <form @submit.prevent="handleSubmit" novalidate>
            <div class="mb-4">
              <label class="block text-sm font-semibold text-gray-700 mb-1">Email</label>
              <input
                v-model="email"
                type="email"
                autocomplete="email"
                @blur="emailTouched = true"
                :class="[
                  'flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-1',
                  emailError ? 'border-red-400 focus-visible:ring-red-400' : 'border-gray-300 focus-visible:ring-[#E91E8C]'
                ]"
                placeholder="tu@email.com"
              />
              <p v-if="emailError" class="mt-1 text-sm text-red-500">{{ emailError }}</p>
            </div>

            <div class="mb-4">
              <label class="block text-sm font-semibold text-gray-700 mb-1">Contraseña</label>
              <div class="relative">
                <input
                  v-model="password"
                  :type="passwordVisible ? 'text' : 'password'"
                  autocomplete="new-password"
                  @blur="passwordTouched = true"
                  :class="[
                    'flex h-9 w-full rounded-md border px-3 py-1 pr-10 text-sm shadow-sm transition-colors placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-1',
                    passwordError ? 'border-red-400 focus-visible:ring-red-400' : 'border-gray-300 focus-visible:ring-[#E91E8C]'
                  ]"
                  placeholder="Mínimo 8 caracteres"
                />
                <button
                  type="button"
                  @click="passwordVisible = !passwordVisible"
                  class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs px-1"
                  :aria-label="passwordVisible ? 'Ocultar contraseña' : 'Mostrar contraseña'"
                >
                  {{ passwordVisible ? '🙈' : '👁️' }}
                </button>
              </div>
              <p v-if="passwordError" class="mt-1 text-sm text-red-500">{{ passwordError }}</p>
            </div>

            <div class="mb-6">
              <label class="block text-sm font-semibold text-gray-700 mb-1">Confirmar contraseña</label>
              <input
                v-model="confirmPassword"
                :type="passwordVisible ? 'text' : 'password'"
                autocomplete="new-password"
                @blur="confirmTouched = true"
                :class="[
                  'flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-1',
                  confirmError ? 'border-red-400 focus-visible:ring-red-400' : 'border-gray-300 focus-visible:ring-[#E91E8C]'
                ]"
                placeholder="Repetí tu contraseña"
              />
              <p v-if="confirmError" class="mt-1 text-sm text-red-500">{{ confirmError }}</p>
            </div>

            <p v-if="serverError" class="mb-4 text-sm text-red-500">{{ serverError }}</p>

            <button
              type="submit"
              :disabled="loading || !isValid"
              class="inline-flex items-center justify-center gap-2 w-full h-9 rounded-md bg-[#E91E8C] text-white text-sm font-semibold shadow transition-colors hover:opacity-90 disabled:opacity-50 disabled:pointer-events-none"
            >
              <svg v-if="loading" class="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              {{ loading ? 'Creando cuenta…' : 'Crear cuenta' }}
            </button>
          </form>

          <p class="mt-4 text-sm text-center text-gray-500">
            ¿Ya tenés cuenta?
            <RouterLink to="/login" class="font-semibold text-[#E91E8C] hover:underline">
              Ingresá
            </RouterLink>
          </p>
        </div>
      </div>
    </div>
  </AppLayout>
</template>
