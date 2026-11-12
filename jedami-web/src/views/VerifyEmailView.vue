<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import AuthShell from '@/components/features/auth/AuthShell.vue'
import EmailCodeForm from '@/components/features/auth/EmailCodeForm.vue'

const route = useRoute()
const email = computed(() => (typeof route.query.email === 'string' ? route.query.email : ''))
</script>

<template>
  <AuthShell title="Confirmá tu email" subtitle="Es el último paso para usar tu cuenta.">
    <EmailCodeForm v-if="email" :email="email" />
    <p v-else class="text-[15px]">
      Falta el email a confirmar.
      <RouterLink to="/login" class="font-semibold underline underline-offset-4">Ingresá</RouterLink>
      y te mandamos un código nuevo.
    </p>

    <p class="mt-6 text-center text-sm text-[var(--t-muted)]">
      ¿Te equivocaste de email?
      <RouterLink to="/registro" class="font-semibold text-[var(--t-ink)] underline underline-offset-4">Creá la cuenta de nuevo</RouterLink>
    </p>
  </AuthShell>
</template>
