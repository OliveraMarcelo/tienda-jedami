<script setup lang="ts">
import AuthShell from '@/components/features/auth/AuthShell.vue'
import { ref, computed, watchEffect } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { apiErrorDetail } from '@/lib/auth-errors'
import { useConfigStore } from '@/stores/config.store'
import type { CustomerType } from '@/lib/constants'

const authStore = useAuthStore()
const configStore = useConfigStore()
const route = useRoute()
const router = useRouter()

const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const customerType = ref<string>('')

// Seleccionar el primer tipo de cliente activo por defecto cuando cargue el config
watchEffect(() => {
  if (!customerType.value && configStore.config.customerTypes.length > 0) {
    customerType.value = configStore.config.customerTypes[0]!.code
  }
})
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
    const { verificationRequired } = await authStore.register(email.value, password.value, customerType.value as CustomerType)
    if (verificationRequired) {
      router.push({ name: 'verificarEmail', query: { ...route.query, email: email.value.trim() } })
    }
  } catch (err: unknown) {
    if ((err as { __registerOk?: boolean }).__registerOk) {
      // Cuenta creada pero el login falló — redirigir al login con mensaje
      serverError.value = 'Cuenta creada. Por favor iniciá sesión.'
    } else {
      serverError.value = apiErrorDetail(err)
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthShell title="Crear cuenta" subtitle="Registrate para hacer pedidos y seguir tus compras.">
    <form class="flex flex-col gap-4" novalidate @submit.prevent="handleSubmit">
      <fieldset>
        <legend class="mb-2 text-sm font-semibold">¿Cómo vas a comprar?</legend>
        <div class="grid grid-cols-2 gap-3">
          <button
            v-for="ct in configStore.config.customerTypes"
            :key="ct.id"
            type="button"
            :aria-pressed="customerType === ct.code"
            :class="[
              'flex flex-col items-start gap-0.5 rounded-2xl border-2 px-4 py-3 text-left transition-colors',
              customerType === ct.code ? 'border-[var(--t-ink)] bg-[var(--t-surface)]' : 'border-[var(--t-border)] hover:border-[var(--t-muted)]',
            ]"
            @click="customerType = ct.code"
          >
            <span class="text-[15px] font-semibold">{{ ct.label }}</span>
            <span class="text-xs text-[var(--t-muted)]">{{ ct.code === 'wholesale' ? 'Tengo un comercio' : 'Compro para mi familia' }}</span>
          </button>
        </div>
      </fieldset>

      <div>
        <label for="reg-email" class="mb-1.5 block text-sm font-semibold">Email</label>
        <input
              id="reg-email"
              v-model="email"
              :type="'email'"
              autocomplete="email"
              :aria-invalid="!!emailError"
              :aria-describedby="emailError ? 'reg-email-error' : undefined"
              :class="['h-12 w-full rounded-full border bg-white px-5 text-[15px] outline-none transition-colors placeholder:text-[var(--t-muted)]/70', emailError ? 'border-red-400 focus:border-red-500' : 'border-[var(--t-border)] focus:border-[var(--t-ink)]']"
              placeholder="tu@email.com"
              @blur="emailTouched = true"
            />
        <p v-if="emailError" id="reg-email-error" class="mt-1.5 px-2 text-sm text-red-700">{{ emailError }}</p>
      </div>

      <div>
        <label for="reg-password" class="mb-1.5 block text-sm font-semibold">Contraseña</label>
        <div class="relative">
          <input
              id="reg-password"
              v-model="password"
              :type="passwordVisible ? 'text' : 'password'"
              autocomplete="new-password"
              :aria-invalid="!!passwordError"
              :aria-describedby="passwordError ? 'reg-password-error' : undefined"
              :class="['h-12 w-full rounded-full border bg-white px-5 text-[15px] outline-none transition-colors placeholder:text-[var(--t-muted)]/70 pr-24', passwordError ? 'border-red-400 focus:border-red-500' : 'border-[var(--t-border)] focus:border-[var(--t-ink)]']"
              placeholder="Mínimo 8 caracteres"
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
        <p v-if="passwordError" id="reg-password-error" class="mt-1.5 px-2 text-sm text-red-700">{{ passwordError }}</p>
      </div>

      <div>
        <label for="reg-confirm" class="mb-1.5 block text-sm font-semibold">Repetí la contraseña</label>
        <input
              id="reg-confirm"
              v-model="confirmPassword"
              :type="passwordVisible ? 'text' : 'password'"
              autocomplete="new-password"
              :aria-invalid="!!confirmError"
              :aria-describedby="confirmError ? 'reg-confirm-error' : undefined"
              :class="['h-12 w-full rounded-full border bg-white px-5 text-[15px] outline-none transition-colors placeholder:text-[var(--t-muted)]/70', confirmError ? 'border-red-400 focus:border-red-500' : 'border-[var(--t-border)] focus:border-[var(--t-ink)]']"
              placeholder="Repetí tu contraseña"
              @blur="confirmTouched = true"
            />
        <p v-if="confirmError" id="reg-confirm-error" class="mt-1.5 px-2 text-sm text-red-700">{{ confirmError }}</p>
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
            {{ loading ? 'Creando cuenta…' : 'Crear cuenta' }}
          </button>
    </form>

    <p class="mt-6 text-center text-sm text-[var(--t-muted)]">
      ¿Ya tenés cuenta?
      <RouterLink :to="{ name: 'login', query: route.query }" class="font-semibold text-[var(--t-ink)] underline underline-offset-4">Ingresá</RouterLink>
    </p>
  </AuthShell>
</template>
