<script setup lang="ts">
import AuthShell from '@/components/features/auth/AuthShell.vue'
import { ref, computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'

const authStore = useAuthStore()

const email = ref('')
const password = ref('')
const passwordVisible = ref(false)
const loading = ref(false)
const serverError = ref('')

const emailTouched = ref(false)
const passwordTouched = ref(false)

const emailError = computed(() => {
  if (!emailTouched.value) return ''
  if (!email.value) return 'El email es requerido'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) return 'El email no es válido'
  return ''
})

const passwordError = computed(() => {
  if (!passwordTouched.value) return ''
  if (!password.value) return 'La contraseña es requerida'
  return ''
})

const isValid = computed(() => !emailError.value && !passwordError.value && !!email.value && !!password.value)

async function handleSubmit() {
  emailTouched.value = true
  passwordTouched.value = true
  if (!isValid.value) return

  loading.value = true
  serverError.value = ''
  try {
    await authStore.login(email.value, password.value)
  } catch (err: unknown) {
    const e = err as { response?: { data?: { detail?: string } } }
    serverError.value = e.response?.data?.detail ?? 'Error inesperado. Intente nuevamente.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthShell title="Ingresar" subtitle="Qué bueno verte de nuevo.">
    <form class="flex flex-col gap-4" novalidate @submit.prevent="handleSubmit">
      <div>
        <label for="login-email" class="mb-1.5 block text-sm font-semibold">Email</label>
        <input
              id="login-email"
              v-model="email"
              :type="'email'"
              autocomplete="email"
              :aria-invalid="!!emailError"
              :aria-describedby="emailError ? 'login-email-error' : undefined"
              :class="['h-12 w-full rounded-full border bg-white px-5 text-[15px] outline-none transition-colors placeholder:text-[var(--t-muted)]/70', emailError ? 'border-red-400 focus:border-red-500' : 'border-[var(--t-border)] focus:border-[var(--t-ink)]']"
              placeholder="tu@email.com"
              @blur="emailTouched = true"
            />
        <p v-if="emailError" id="login-email-error" class="mt-1.5 px-2 text-sm text-red-700">{{ emailError }}</p>
      </div>

      <div>
        <label for="login-password" class="mb-1.5 block text-sm font-semibold">Contraseña</label>
        <div class="relative">
          <input
              id="login-password"
              v-model="password"
              :type="passwordVisible ? 'text' : 'password'"
              autocomplete="current-password"
              :aria-invalid="!!passwordError"
              :aria-describedby="passwordError ? 'login-password-error' : undefined"
              :class="['h-12 w-full rounded-full border bg-white px-5 text-[15px] outline-none transition-colors placeholder:text-[var(--t-muted)]/70 pr-24', passwordError ? 'border-red-400 focus:border-red-500' : 'border-[var(--t-border)] focus:border-[var(--t-ink)]']"
              placeholder="••••••••"
              @blur="passwordTouched = true"
            />
          <button
                type="button"
                class="absolute right-2 top-1/2 flex h-9 -translate-y-1/2 items-center rounded-full px-3 text-xs font-semibold text-[var(--t-muted)] hover:text-[var(--t-ink)]"
                :aria-label="passwordVisible ? 'Ocultar contraseña' : 'Mostrar contraseña'"
                @click="passwordVisible = !passwordVisible"
              >
                {{ passwordVisible ? 'Ocultar' : 'Mostrar' }}
              </button>
        </div>
        <p v-if="passwordError" id="login-password-error" class="mt-1.5 px-2 text-sm text-red-700">{{ passwordError }}</p>
      </div>

      <p v-if="serverError" role="alert" class="rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{{ serverError }}</p>

      <button
            type="submit"
            :disabled="loading || !isValid"
            class="mt-2 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--t-ink)] text-base font-semibold text-white transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-40"
          >
            <svg v-if="loading" class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            {{ loading ? 'Ingresando…' : 'Ingresar' }}
          </button>
    </form>

    <p class="mt-6 text-center text-sm text-[var(--t-muted)]">
      ¿No tenés cuenta?
      <RouterLink to="/registro" class="font-semibold text-[var(--t-ink)] underline underline-offset-4">Creá una</RouterLink>
    </p>
  </AuthShell>
</template>
