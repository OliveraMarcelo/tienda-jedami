<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth.store'
import { resendVerificationApi } from '@/api/auth.api'
import { apiErrorDetail } from '@/lib/auth-errors'

const props = withDefaults(defineProps<{
  email: string
  /** Navegar después de confirmar (en el flujo de compra se queda en la página) */
  navigate?: boolean
}>(), { navigate: true })

const emit = defineEmits<{ verified: [] }>()

const authStore = useAuthStore()

const code = ref('')
const loading = ref(false)
const error = ref('')
const info = ref('')

// El servidor manda un código al registrarse o al intentar entrar: arrancar con la espera
const RESEND_SECONDS = 60
const cooldown = ref(RESEND_SECONDS)
let timer: ReturnType<typeof setInterval> | null = null

function startCooldown() {
  cooldown.value = RESEND_SECONDS
  if (timer) clearInterval(timer)
  timer = setInterval(() => {
    cooldown.value -= 1
    if (cooldown.value <= 0 && timer) {
      clearInterval(timer)
      timer = null
    }
  }, 1000)
}

onMounted(startCooldown)
onBeforeUnmount(() => { if (timer) clearInterval(timer) })

const isComplete = computed(() => /^\d{6}$/.test(code.value))

function onInput(e: Event) {
  code.value = (e.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 6)
  error.value = ''
  if (isComplete.value) submit()
}

async function submit() {
  if (!isComplete.value || loading.value) return
  loading.value = true
  error.value = ''
  info.value = ''
  try {
    await authStore.verifyEmail(props.email, code.value, props.navigate)
    emit('verified')
  } catch (err) {
    error.value = apiErrorDetail(err, 'No pudimos verificar el código. Intentá de nuevo.')
    code.value = ''
  } finally {
    loading.value = false
  }
}

async function resend() {
  if (cooldown.value > 0) return
  error.value = ''
  try {
    await resendVerificationApi(props.email)
    info.value = 'Te mandamos un código nuevo. Revisá también la carpeta de spam.'
    code.value = ''
    startCooldown()
  } catch (err) {
    error.value = apiErrorDetail(err, 'No pudimos reenviar el código. Intentá en un rato.')
  }
}
</script>

<template>
  <form class="flex flex-col gap-4" novalidate @submit.prevent="submit">
    <p class="text-[15px] leading-relaxed">
      Te mandamos un código de 6 números a <strong class="[overflow-wrap:anywhere]">{{ email }}</strong>.
      Puede tardar un minuto; revisá también spam.
    </p>

    <div>
      <label for="email-code" class="mb-1.5 block text-sm font-semibold">Código</label>
      <input
        id="email-code"
        :value="code"
        type="text"
        inputmode="numeric"
        autocomplete="one-time-code"
        maxlength="6"
        placeholder="000000"
        :aria-invalid="!!error"
        :aria-describedby="error ? 'email-code-error' : undefined"
        :disabled="loading"
        :class="['h-14 w-full rounded-full border bg-white px-5 text-center text-2xl font-bold tracking-[0.5em] outline-none transition-colors placeholder:text-[var(--t-muted)]/40', error ? 'border-red-400 focus:border-red-500' : 'border-[var(--t-border)] focus:border-[var(--t-ink)]']"
        @input="onInput"
      />
      <p v-if="error" id="email-code-error" role="alert" class="mt-1.5 px-2 text-sm text-red-700">{{ error }}</p>
      <p v-else-if="info" role="status" class="mt-1.5 px-2 text-sm text-[var(--t-muted)]">{{ info }}</p>
    </div>

    <button
      type="submit"
      :disabled="loading || !isComplete"
      class="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--t-ink)] text-base font-semibold text-white transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-40"
    >
      {{ loading ? 'Verificando…' : 'Confirmar email' }}
    </button>

    <button
      type="button"
      class="min-h-10 text-sm font-semibold text-[var(--t-ink)] underline underline-offset-4 disabled:text-[var(--t-muted)] disabled:no-underline"
      :disabled="cooldown > 0"
      @click="resend"
    >
      {{ cooldown > 0 ? `Reenviar código en ${cooldown} s` : 'Reenviar código' }}
    </button>
  </form>
</template>
