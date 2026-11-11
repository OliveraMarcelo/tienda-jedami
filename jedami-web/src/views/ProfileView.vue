<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'
import { fetchMe, type MeResponse } from '@/api/profile.api'
import { ROLES, CUSTOMER_TYPES, ROLE_LABELS } from '@/lib/constants'
import { useConfigStore } from '@/stores/config.store'

const configStore = useConfigStore()

const profile = ref<MeResponse | null>(null)
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  try {
    profile.value = await fetchMe()
  } catch {
    error.value = 'No se pudo cargar el perfil.'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <AppLayout>
    <div class="mx-auto max-w-xl">
      <h1 class="mb-6 text-[28px] font-bold sm:text-[32px]">Mi perfil</h1>

      <div v-if="loading" class="h-48 animate-pulse rounded-[var(--t-radius-card)] bg-[var(--t-surface)]"></div>

      <p v-else-if="error" role="alert" class="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{{ error }}</p>

      <div v-else-if="profile" class="flex flex-col gap-4">
        <section class="flex items-center gap-4 rounded-[var(--t-radius-card)] bg-[var(--t-surface)] p-6">
          <span class="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[var(--t-ink)] text-lg font-bold uppercase text-white" aria-hidden="true">
            {{ profile.email.slice(0, 2) }}
          </span>
          <div class="min-w-0">
            <p class="truncate text-lg font-semibold">{{ profile.email }}</p>
            <div class="mt-1.5 flex flex-wrap gap-2">
              <span
                v-for="role in profile.roles"
                :key="role"
                :class="[
                  'rounded-full px-3 py-0.5 text-xs font-semibold',
                  role === ROLES.ADMIN ? 'bg-[#EDE7F6] text-[#4527A0]' : role === ROLES.WHOLESALE ? 'bg-[#E3EEFB] text-[#0B4A9C]' : 'bg-white text-[var(--t-ink)]',
                ]"
              >
                {{ ROLE_LABELS[role] ?? role }}
              </span>
            </div>
          </div>
        </section>

        <section v-if="profile.customer" class="rounded-[var(--t-radius-card)] border border-[var(--t-border)] p-6">
          <h2 class="mb-1 text-sm font-semibold text-[var(--t-muted)]">Tipo de cuenta</h2>
          <p class="text-xl font-bold">
            {{ configStore.customerTypeLabel[profile.customer.customerType] ?? profile.customer.customerType }}
          </p>
          <p v-if="profile.customer.customerType === CUSTOMER_TYPES.RETAIL" class="mt-2 text-sm text-[var(--t-muted)]">
            ¿Tenés un comercio y querés comprar por mayor? Escribinos y activamos tu cuenta mayorista.
          </p>
        </section>

        <RouterLink
          to="/pedidos"
          class="flex items-center justify-between rounded-[var(--t-radius-card)] border border-[var(--t-border)] p-6 font-semibold hover:bg-[var(--t-surface)]"
        >
          Mis pedidos
          <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg>
        </RouterLink>
      </div>
    </div>
  </AppLayout>
</template>
