<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth.store'
import { useConfigStore } from '@/stores/config.store'
import { apiErrorDetail } from '@/lib/auth-errors'
import type { CustomerType } from '@/lib/constants'

/**
 * Botón oficial de Google ("Continuar con Google").
 * Solo se muestra si el servidor tiene GOOGLE_CLIENT_ID configurado.
 */
const props = withDefaults(defineProps<{
  text?: 'signin_with' | 'signup_with' | 'continue_with'
  /** Tipo de cliente para cuentas nuevas */
  customerType?: CustomerType
  /** Navegar después de entrar (en el flujo de compra se queda en la página) */
  navigate?: boolean
}>(), { text: 'continue_with', navigate: true })

const emit = defineEmits<{
  success: []
  error: [message: string]
}>()

const authStore = useAuthStore()
const configStore = useConfigStore()

const container = ref<HTMLDivElement | null>(null)
const loading = ref(false)

interface GoogleCredentialResponse { credential: string }
interface GoogleAccountsId {
  initialize(config: { client_id: string; callback: (r: GoogleCredentialResponse) => void; ux_mode?: 'popup' | 'redirect' }): void
  renderButton(el: HTMLElement, options: Record<string, unknown>): void
}
declare global {
  interface Window { google?: { accounts: { id: GoogleAccountsId } } }
}

const SCRIPT_SRC = 'https://accounts.google.com/gsi/client'
let scriptPromise: Promise<void> | null = null

function loadScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve()
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement('script')
    s.src = SCRIPT_SRC
    s.async = true
    s.defer = true
    s.onload = () => resolve()
    s.onerror = () => { scriptPromise = null; reject(new Error('No se pudo cargar Google')) }
    document.head.appendChild(s)
  })
  return scriptPromise
}

async function onCredential(response: GoogleCredentialResponse) {
  loading.value = true
  try {
    await authStore.loginWithGoogle(response.credential, props.customerType, props.navigate)
    emit('success')
  } catch (err) {
    emit('error', apiErrorDetail(err, 'No pudimos ingresar con Google. Probá de nuevo.'))
  } finally {
    loading.value = false
  }
}

async function render() {
  const clientId = configStore.googleClientId
  if (!clientId) return
  await nextTick()
  if (!container.value) return
  try {
    await loadScript()
    const gid = window.google!.accounts.id
    gid.initialize({ client_id: clientId, callback: onCredential, ux_mode: 'popup' })
    // Google pide un ancho fijo en px (máximo 400)
    const width = Math.min(400, Math.max(200, Math.floor(container.value.clientWidth)))
    gid.renderButton(container.value, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      shape: 'pill',
      text: props.text,
      locale: 'es',
      width,
    })
  } catch {
    // Sin Google (bloqueado por el navegador o sin conexión) queda el formulario de email
  }
}

onMounted(render)
watch(() => configStore.googleClientId, render)
</script>

<template>
  <div v-if="configStore.googleClientId">
    <div class="relative flex min-h-11 justify-center" :aria-busy="loading">
      <!-- Google limita el botón a 400 px: centrarlo cuando el formulario es más ancho -->
      <div ref="container" class="w-full [&>div]:mx-auto" :class="{ 'pointer-events-none opacity-50': loading }" />
    </div>
    <div class="mt-5 flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-[var(--t-muted)]" aria-hidden="true">
      <span class="h-px flex-1 bg-[var(--t-border)]" />
      o con tu email
      <span class="h-px flex-1 bg-[var(--t-border)]" />
    </div>
  </div>
</template>
