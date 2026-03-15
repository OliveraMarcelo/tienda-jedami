<script setup lang="ts">
import { ref, onMounted } from 'vue'
import AppLayout from '@/layouts/AppLayout.vue'
import { fetchMe, type MeResponse } from '@/api/profile.api'
import { ROLES, CUSTOMER_TYPES } from '@/lib/constants'
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
    <div class="max-w-xl mx-auto">
      <h1 class="text-2xl font-bold text-gray-900 mb-6">Mi perfil</h1>

      <div v-if="loading" class="animate-pulse space-y-4">
        <div class="h-5 bg-gray-200 rounded w-48"></div>
        <div class="h-5 bg-gray-200 rounded w-32"></div>
      </div>

      <div v-else-if="error" class="text-red-500 text-sm">{{ error }}</div>

      <div v-else-if="profile" class="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
        <div>
          <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Email</p>
          <p class="text-gray-800 font-medium">{{ profile.email }}</p>
        </div>

        <div>
          <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Roles</p>
          <div class="flex flex-wrap gap-2">
            <span
              v-for="role in profile.roles"
              :key="role"
              class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border"
              :class="role === ROLES.ADMIN ? 'bg-purple-50 text-purple-700 border-purple-200' :
                      role === ROLES.WHOLESALE ? 'bg-blue-50 text-blue-700 border-blue-200' :
                      'bg-gray-50 text-gray-700 border-gray-200'"
            >
              {{ role }}
            </span>
          </div>
        </div>

        <div v-if="profile.customer">
          <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Tipo de cuenta</p>
          <div
            class="inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold"
            :class="profile.customer.customerType === CUSTOMER_TYPES.WHOLESALE
              ? 'bg-blue-600 text-white'
              : 'bg-[#E91E8C] text-white'"
          >
            <span>{{ configStore.customerTypeLabel[profile.customer.customerType] ?? profile.customer.customerType }}</span>
          </div>
          <p v-if="profile.customer.customerType === CUSTOMER_TYPES.RETAIL" class="mt-2 text-xs text-gray-500">
            ¿Querés comprar al por mayor? Contactá a un administrador para activar tu cuenta mayorista.
          </p>
        </div>
      </div>
    </div>
  </AppLayout>
</template>
