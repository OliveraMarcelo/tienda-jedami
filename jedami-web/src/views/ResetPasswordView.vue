<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import AuthShell from '@/components/features/auth/AuthShell.vue'
import { useAuthStore } from '@/stores/auth.store'
import { apiErrorDetail } from '@/lib/auth-errors'

const route = useRoute()
const authStore = useAuthStore()

const token = computed(() => (typeof route.query.token === 'string' ? route.query.token : ''))
const password = ref('')
const confirmPassword = ref('')
const visible = ref(false)
const touched = ref(false)
const loading = ref(false)
const error = ref('')

const passwordError = computed(() => {
  if (!touched.value) return ''
  if (password.value.length < 8) return 'La contraseña debe tener al menos 8 caracteres'
  return ''
})
const confirmError = computed(() => {
  if (!touched.value) return ''
  if (confirmPassword.value !== password.value) return 'Las contraseñas no coinciden'
  return ''
})

async function submit() {
  touched.value = true
  if (passwordError.value || confirmError.value) return
  loading.value = true
  error.value = ''
  try {
    // Al terminar queda la sesión iniciada y se va al catálogo (o al admin)
    await authStore.resetPassword(token.value, password.value)
  } catch (err) {
    error.value = apiErrorDetail(err)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthShell title="Elegí tu contraseña nueva" subtitle="Usá al menos 8 caracteres.">
    <div v-if="!token" class="text-[15px] leading-relaxed">
      <p>El link no es válido.</p>
      <RouterLink to="/olvide-contrasena" class="mt-3 inline-block font-semibold underline underline-offset-4">Pedí uno nuevo</RouterLink>
    </div>

    <form v-else class="flex flex-col gap-4" novalidate @submit.prevent="submit">
      <div>
        <label for="reset-password" class="mb-1.5 block text-sm font-semibold">Contraseña nueva</label>
        <div class="relative">
          <input
            id="reset-password"
            v-model="password"
            :type="visible ? 'text' : 'password'"
            autocomplete="new-password"
            :aria-invalid="!!passwordError"
            :aria-describedby="passwordError ? 'reset-password-error' : undefined"
            :class="['h-12 w-full rounded-full border bg-white px-5 pr-24 text-[15px] outline-none transition-colors placeholder:text-[var(--t-muted)]/70', passwordError ? 'border-red-400 focus:border-red-500' : 'border-[var(--t-border)] focus:border-[var(--t-ink)]']"
            placeholder="Mínimo 8 caracteres"
          />
          <button
            type="button"
            class="absolute right-2 top-1/2 flex h-9 -translate-y-1/2 items-center rounded-full px-3 text-xs font-semibold text-[var(--t-muted)] hover:text-[var(--t-ink)]"
            :aria-label="visible ? 'Ocultar contraseña' : 'Mostrar contraseña'"
            @click="visible = !visible"
          >
            {{ visible ? 'Ocultar' : 'Mostrar' }}
          </button>
        </div>
        <p v-if="passwordError" id="reset-password-error" class="mt-1.5 px-2 text-sm text-red-700">{{ passwordError }}</p>
      </div>

      <div>
        <label for="reset-confirm" class="mb-1.5 block text-sm font-semibold">Repetí la contraseña</label>
        <input
          id="reset-confirm"
          v-model="confirmPassword"
          :type="visible ? 'text' : 'password'"
          autocomplete="new-password"
          :aria-invalid="!!confirmError"
          :aria-describedby="confirmError ? 'reset-confirm-error' : undefined"
          :class="['h-12 w-full rounded-full border bg-white px-5 text-[15px] outline-none transition-colors placeholder:text-[var(--t-muted)]/70', confirmError ? 'border-red-400 focus:border-red-500' : 'border-[var(--t-border)] focus:border-[var(--t-ink)]']"
          placeholder="Repetí tu contraseña"
        />
        <p v-if="confirmError" id="reset-confirm-error" class="mt-1.5 px-2 text-sm text-red-700">{{ confirmError }}</p>
      </div>

      <div v-if="error" role="alert" class="rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
        {{ error }}
        <RouterLink to="/olvide-contrasena" class="ml-1 font-semibold underline underline-offset-4">Pedir otro link</RouterLink>
      </div>

      <button
        type="submit"
        :disabled="loading"
        class="mt-2 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[var(--t-ink)] text-base font-semibold text-white transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-40"
      >
        {{ loading ? 'Guardando…' : 'Guardar e ingresar' }}
      </button>
    </form>
  </AuthShell>
</template>
