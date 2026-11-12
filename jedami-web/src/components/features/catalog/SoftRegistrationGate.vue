<script setup lang="ts">
import { ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import Sheet from '@/components/ui/Sheet.vue'
import EmailCodeForm from '@/components/features/auth/EmailCodeForm.vue'
import { useAuthStore } from '@/stores/auth.store'
import { CUSTOMER_TYPES } from '@/lib/constants'
import { apiErrorDetail, isEmailNotVerified } from '@/lib/auth-errors'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{
  'update:open': [value: boolean]
  'authenticated': []
}>()

const authStore = useAuthStore()
// 'codigo': se creó la cuenta (o se intentó entrar) y falta confirmar el email
const step = ref<'login' | 'registro' | 'codigo'>('registro')
const email = ref('')
const password = ref('')
const errorMsg = ref('')
const loading = ref(false)

// Al reabrir el panel, volver al formulario (salvo que esté esperando el código)
watch(() => props.open, (open) => {
  if (open && step.value !== 'codigo') errorMsg.value = ''
})

function finish() {
  emit('update:open', false)
  emit('authenticated')
}

async function submit() {
  errorMsg.value = ''
  if (step.value === 'registro' && password.value.length < 8) {
    errorMsg.value = 'La contraseña debe tener al menos 8 caracteres'
    return
  }
  loading.value = true
  try {
    if (step.value === 'login') {
      await authStore.login(email.value, password.value, false)
    } else {
      const { verificationRequired } = await authStore.register(email.value, password.value, CUSTOMER_TYPES.RETAIL, false)
      if (verificationRequired) {
        step.value = 'codigo'
        return
      }
    }
    finish()
  } catch (err: unknown) {
    if (isEmailNotVerified(err)) {
      step.value = 'codigo'
      return
    }
    errorMsg.value = apiErrorDetail(err, 'Error al procesar. Intentá de nuevo.')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <Sheet :open="open" side="bottom" @update:open="emit('update:open', $event)">
    <div class="mx-auto max-w-sm">
      <template v-if="step === 'codigo'">
        <h2 class="mb-1 text-xl font-bold">Confirmá tu email</h2>
        <p class="mb-5 text-sm text-[var(--t-muted)]">Es el último paso: después seguís con tu compra.</p>
        <EmailCodeForm :email="email.trim()" :navigate="false" @verified="finish" />
        <button
          type="button"
          class="mt-2 min-h-10 w-full text-sm text-[var(--t-muted)] hover:text-[var(--t-ink)]"
          @click="step = 'registro'"
        >
          Usar otro email
        </button>
      </template>

      <template v-else>
        <h2 class="mb-1 text-xl font-bold">Ingresá para comprar</h2>
        <p class="mb-5 text-sm text-[var(--t-muted)]">Creá tu cuenta en un minuto o ingresá si ya tenés una.</p>

        <div role="tablist" class="mb-5 inline-flex w-full rounded-full bg-[var(--t-surface)] p-1">
          <button
            type="button"
            role="tab"
            :aria-selected="step === 'registro'"
            :class="['min-h-10 flex-1 rounded-full text-sm font-semibold transition-colors', step === 'registro' ? 'bg-[var(--t-ink)] text-white' : 'hover:bg-white']"
            @click="step = 'registro'"
          >
            Crear cuenta
          </button>
          <button
            type="button"
            role="tab"
            :aria-selected="step === 'login'"
            :class="['min-h-10 flex-1 rounded-full text-sm font-semibold transition-colors', step === 'login' ? 'bg-[var(--t-ink)] text-white' : 'hover:bg-white']"
            @click="step = 'login'"
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
            <div class="mb-1.5 flex items-baseline justify-between gap-3">
              <label for="gate-password" class="block text-sm font-medium">Contraseña</label>
              <RouterLink
                v-if="step === 'login'"
                :to="{ name: 'olvideContrasena', query: email ? { email } : {} }"
                class="text-xs font-semibold text-[var(--t-muted)] underline underline-offset-4 hover:text-[var(--t-ink)]"
              >¿La olvidaste?</RouterLink>
            </div>
            <input
              id="gate-password"
              v-model="password"
              type="password"
              required
              :minlength="step === 'registro' ? 8 : undefined"
              :placeholder="step === 'registro' ? 'Mínimo 8 caracteres' : undefined"
              :autocomplete="step === 'login' ? 'current-password' : 'new-password'"
              class="h-12 w-full rounded-full border border-[var(--t-border)] px-5 text-sm outline-none focus:border-[var(--t-ink)]"
            />
          </div>

          <p v-if="errorMsg" role="alert" class="text-sm text-red-700">{{ errorMsg }}</p>

          <button
            type="submit"
            :disabled="loading"
            class="min-h-12 w-full rounded-full bg-[var(--t-ink)] text-base font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {{ loading ? 'Procesando…' : step === 'registro' ? 'Crear cuenta y comprar' : 'Ingresar y comprar' }}
          </button>
        </form>
      </template>
    </div>
  </Sheet>
</template>
