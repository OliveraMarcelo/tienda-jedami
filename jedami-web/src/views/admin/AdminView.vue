<script setup lang="ts">
import { RouterLink } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'
import { useAuthStore } from '@/stores/auth.store'
import { useRouter } from 'vue-router'

const authStore = useAuthStore()
const router = useRouter()

if (!authStore.isAdmin) {
  router.push('/catalogo')
}
</script>

<template>
  <AppLayout>
    <h1 class="text-2xl font-bold text-gray-900 mb-6">Panel de administración</h1>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
      <RouterLink
        to="/admin/productos"
        class="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 hover:shadow-md hover:border-[#E91E8C] transition-all group"
      >
        <div class="text-3xl mb-3">📦</div>
        <p class="font-bold text-gray-900 group-hover:text-[#E91E8C] transition-colors">Productos</p>
        <p class="text-sm text-gray-500 mt-1">Gestionar catálogo de productos y variantes</p>
      </RouterLink>
      <RouterLink
        to="/admin/usuarios"
        class="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 hover:shadow-md hover:border-[#E91E8C] transition-all group"
      >
        <div class="text-3xl mb-3">👥</div>
        <p class="font-bold text-gray-900 group-hover:text-[#E91E8C] transition-colors">Usuarios</p>
        <p class="text-sm text-gray-500 mt-1">Ver usuarios y asignar roles</p>
      </RouterLink>
    </div>
  </AppLayout>
</template>
