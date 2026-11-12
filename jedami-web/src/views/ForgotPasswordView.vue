<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import AuthShell from '@/components/features/auth/AuthShell.vue'
import { forgotPasswordApi } from '@/api/auth.api'
import { apiErrorDetail } from '@/lib/auth-errors'
import { useConfigStore } from '@/stores/config.store'

const route = useRoute()
const configStore = useConfigStore()

const email = ref(typeof route.query.email === 'string' ? route.query.email : '')
const touched = ref(false)
const loading = ref(false)
const sent = ref(false)
const error = ref('')

const emailError = computed(() => {
  if (!touched.value) return ''
  if (!email.value) return 'El email es requerido'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) return 'El email no es válido'
  return ''
})

async function submit() {
  touched.value = true
  if (emailError.value || !email.value) return
  loading.value = true
  error.value = ''
  try {
    await forgotPasswordApi(email.value.trim())
    sent.value = true
  } catch (err) {
    error.value = apiErrorDetail(err)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthShell title="Recuperá tu contraseña" subtitle="Te mandamos un link para elegir una nueva.">
    <!-- Sin envío de emails configurado no hay forma de recuperar por esta vía -->
    <div v-if="configStore.loaded && !configStore.emailEnabled" class="flex flex-col gap-3 text-[15px] leading-relaxed">
      <p>Por ahora no podemos mandar emails desde la tienda.</p>
      <p>
        Escribinos
        <a
          v-if="configStore.branding.whatsappNumber"
          :href="`https://wa.me/${configStore.branding.whatsappNumber.replace(/\D/g, '')}`"
          target="_blank"
          rel="noopener"
          class="font-semibold underline underline-offset-4"
        >por WhatsApp</a>
        <span v-else>por WhatsApp</span>
        y te ayudamos a recuperar el acceso.
      </p>
    </div>

    <div v-else-if="sent" role="status" class="flex flex-col gap-3 text-[15px] leading-relaxed">
      <p class="rounded-2xl bg-[var(--t-surface)] px-4 py-3">
        Si <strong class="[overflow-wrap:anywhere]">{{ email }}</strong> tiene una cuenta, te llega un email con el link en unos minutos.
      </p>
      <p class="text-sm text-[var(--t-muted)]">El link vence en 1 hora. Si no lo ves, revisá spam o volvé a pedirlo en un minuto.</p>
      <button type="button" class="self-start text-sm font-semibold underline underline-offset-4" @click="sent = false">
        Probar con otro email
      </button>
    </div>

    <form v-else class="flex flex-col gap-4" novalidate @submit.prevent="submit">
      <div>
        <label for="forgot-email" class="mb-1.5 block text-sm font-semibold">Email de tu cuenta</label>
        <input
          id="forgot-email"
          v-model="email"
          type="email"
          autocomplete="email"
          :aria-invalid="!!emailError"
          :aria-describedby="emailError ? 'forgot-email-error' : undefined"
          :class="['h-12 w-full rounded-full border bg-white px-5 text-[15px] outline-none transition-colors placeholder:text-[var(--t-muted)]/70', emailError ? 'border-red-400 focus:border-red-500' : 'border-[var(--t-border)] focus:border-[var(--t-ink)]']"
          placeholder="tu@email.com"
          @blur="touched = true"
        />
        <p v-if="emailError" id="forgot-email-error" class="mt-1.5 px-2 text-sm text-red-700">{{ emailError }}</p>
      </div>

      <p v-if="error" role="alert" class="rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{{ error }}</p>

      <button
        type="submit"
        :disabled="loading"
        class="mt-2 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[var(--t-ink)] text-base font-semibold text-white transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-40"
      >
        {{ loading ? 'Enviando…' : 'Mandarme el link' }}
      </button>
    </form>

    <p class="mt-6 text-center text-sm text-[var(--t-muted)]">
      ¿Te acordaste?
      <RouterLink to="/login" class="font-semibold text-[var(--t-ink)] underline underline-offset-4">Ingresá</RouterLink>
    </p>
  </AuthShell>
</template>
