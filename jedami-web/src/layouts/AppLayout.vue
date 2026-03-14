<script setup lang="ts">
import { RouterLink } from 'vue-router'
import ModeIndicator from '@/components/features/catalog/ModeIndicator.vue'
import { useAuthStore } from '@/stores/auth.store'

const authStore = useAuthStore()
</script>

<template>
  <div class="min-h-screen bg-[#F0F8FF]">
    <header class="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <RouterLink to="/catalogo" class="text-xl font-extrabold text-[#E91E8C] tracking-tight">
          JEDAMI
        </RouterLink>
        <nav class="flex items-center gap-4">
          <RouterLink to="/catalogo" class="text-sm font-medium text-gray-700 hover:text-[#E91E8C] transition-colors">
            Catálogo
          </RouterLink>
          <RouterLink v-if="authStore.isAuthenticated" to="/pedidos" class="text-sm font-medium text-gray-700 hover:text-[#E91E8C] transition-colors">
            Mis pedidos
          </RouterLink>
          <RouterLink v-if="authStore.isAuthenticated" to="/perfil" class="text-sm font-medium text-gray-700 hover:text-[#E91E8C] transition-colors">
            Mi perfil
          </RouterLink>
          <RouterLink v-if="authStore.isAdmin" to="/admin" class="text-sm font-medium text-gray-700 hover:text-[#E91E8C] transition-colors">
            Admin
          </RouterLink>
          <ModeIndicator :mode="authStore.mode" />
          <RouterLink v-if="!authStore.isAuthenticated" to="/login" class="text-sm font-medium text-gray-700 hover:text-[#E91E8C] transition-colors">
            Ingresar
          </RouterLink>
          <button v-else @click="authStore.logout()" class="text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors">
            Salir
          </button>
        </nav>
      </div>
    </header>
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <slot />
    </main>
  </div>
</template>
