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
        to="/admin/dashboard"
        class="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 hover:shadow-md hover:border-[#E91E8C] transition-all group"
      >
        <div class="text-3xl mb-3">📊</div>
        <p class="font-bold text-gray-900 group-hover:text-[#E91E8C] transition-colors">Dashboard</p>
        <p class="text-sm text-gray-500 mt-1">Métricas de ventas y pedidos recientes</p>
      </RouterLink>
      <RouterLink
        to="/admin/pagos"
        class="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 hover:shadow-md hover:border-[#E91E8C] transition-all group"
      >
        <div class="text-3xl mb-3">💳</div>
        <p class="font-bold text-gray-900 group-hover:text-[#E91E8C] transition-colors">Pagos</p>
        <p class="text-sm text-gray-500 mt-1">Ver y filtrar todos los pagos</p>
      </RouterLink>
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
      <RouterLink
        to="/admin/configuracion"
        class="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 hover:shadow-md hover:border-[#E91E8C] transition-all group"
      >
        <div class="text-3xl mb-3">⚙️</div>
        <p class="font-bold text-gray-900 group-hover:text-[#E91E8C] transition-colors">Configuración</p>
        <p class="text-sm text-gray-500 mt-1">Tipos, talles, colores y branding</p>
      </RouterLink>
      <RouterLink
        to="/admin/despacho"
        class="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 hover:shadow-md hover:border-[#E91E8C] transition-all group"
      >
        <div class="text-3xl mb-3">🚚</div>
        <p class="font-bold text-gray-900 group-hover:text-[#E91E8C] transition-colors">Despacho curva</p>
        <p class="text-sm text-gray-500 mt-1">Asignar colores y despachar pedidos curva pagados</p>
      </RouterLink>
      <RouterLink
        to="/admin/banners"
        class="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 hover:shadow-md hover:border-[#E91E8C] transition-all group"
      >
        <div class="text-3xl mb-3">🖼️</div>
        <p class="font-bold text-gray-900 group-hover:text-[#E91E8C] transition-colors">Banners</p>
        <p class="text-sm text-gray-500 mt-1">Gestionar el carrusel de imágenes del catálogo</p>
      </RouterLink>
      <RouterLink
        to="/admin/anuncios"
        class="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 hover:shadow-md hover:border-[#E91E8C] transition-all group"
      >
        <div class="text-3xl mb-3">📢</div>
        <p class="font-bold text-gray-900 group-hover:text-[#E91E8C] transition-colors">Anuncios</p>
        <p class="text-sm text-gray-500 mt-1">Anuncios personalizados por audiencia en el sidebar</p>
      </RouterLink>
    </div>
  </AppLayout>
</template>
