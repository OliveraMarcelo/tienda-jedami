<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import ModeIndicator from '@/components/features/catalog/ModeIndicator.vue'
import { useAuthStore } from '@/stores/auth.store'
import { useConfigStore } from '@/stores/config.store'

const authStore = useAuthStore()
const configStore = useConfigStore()

const menuOpen = ref(false)
</script>

<template>
  <div class="min-h-screen bg-[#F0F8FF] flex flex-col">
    <header class="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <RouterLink to="/catalogo" class="flex items-center gap-2 text-xl font-extrabold text-[var(--color-primary)] tracking-tight">
          <img
            v-if="configStore.branding.logoUrl"
            :src="configStore.branding.logoUrl"
            :alt="configStore.branding.storeName"
            class="h-8 w-auto"
          />
          <span>{{ configStore.branding.storeName }}</span>
        </RouterLink>

        <!-- Nav desktop -->
        <nav class="hidden sm:flex items-center gap-4">
          <RouterLink to="/catalogo" class="text-sm font-medium text-gray-700 hover:text-[var(--color-primary)] transition-colors">
            Catálogo
          </RouterLink>
          <RouterLink v-if="authStore.isAuthenticated" to="/pedidos" class="text-sm font-medium text-gray-700 hover:text-[var(--color-primary)] transition-colors">
            Mis pedidos
          </RouterLink>
          <RouterLink v-if="authStore.isAuthenticated" to="/perfil" class="text-sm font-medium text-gray-700 hover:text-[var(--color-primary)] transition-colors">
            Mi perfil
          </RouterLink>
          <RouterLink v-if="authStore.isAdmin" to="/admin" class="text-sm font-medium text-gray-700 hover:text-[var(--color-primary)] transition-colors">
            Admin
          </RouterLink>
          <ModeIndicator :mode="authStore.mode" @toggle="authStore.toggleMode()" />
          <span v-if="authStore.isAuthenticated" class="hidden md:inline text-xs text-gray-400 max-w-[140px] truncate">{{ authStore.user?.email }}</span>
          <RouterLink v-if="!authStore.isAuthenticated" to="/login" class="text-sm font-medium text-gray-700 hover:text-[var(--color-primary)] transition-colors">
            Ingresar
          </RouterLink>
          <button v-else @click="authStore.logout()" class="text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors">
            Salir
          </button>
        </nav>

        <!-- Hamburger mobile -->
        <div class="flex items-center gap-2 sm:hidden">
          <ModeIndicator :mode="authStore.mode" @toggle="authStore.toggleMode()" />
          <button
            @click="menuOpen = !menuOpen"
            class="p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Menú"
          >
            <svg v-if="!menuOpen" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
            <svg v-else class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- Menú mobile desplegable -->
      <div v-if="menuOpen" class="sm:hidden border-t border-gray-100 bg-white px-4 py-3 flex flex-col gap-3">
        <RouterLink to="/catalogo" @click="menuOpen = false" class="text-sm font-medium text-gray-700 hover:text-[var(--color-primary)] transition-colors py-1">
          Catálogo
        </RouterLink>
        <RouterLink v-if="authStore.isAuthenticated" to="/pedidos" @click="menuOpen = false" class="text-sm font-medium text-gray-700 hover:text-[var(--color-primary)] transition-colors py-1">
          Mis pedidos
        </RouterLink>
        <RouterLink v-if="authStore.isAuthenticated" to="/perfil" @click="menuOpen = false" class="text-sm font-medium text-gray-700 hover:text-[var(--color-primary)] transition-colors py-1">
          Mi perfil
        </RouterLink>
        <RouterLink v-if="authStore.isAdmin" to="/admin" @click="menuOpen = false" class="text-sm font-medium text-gray-700 hover:text-[var(--color-primary)] transition-colors py-1">
          Admin
        </RouterLink>
        <div v-if="authStore.isAuthenticated" class="text-xs text-gray-400 truncate">{{ authStore.user?.email }}</div>
        <RouterLink v-if="!authStore.isAuthenticated" to="/login" @click="menuOpen = false" class="text-sm font-medium text-gray-700 hover:text-[var(--color-primary)] transition-colors py-1">
          Ingresar
        </RouterLink>
        <button v-else @click="authStore.logout(); menuOpen = false" class="text-left text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors py-1">
          Salir
        </button>
      </div>
    </header>
    <main class="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <template v-if="$slots.sidebar">
        <div class="flex flex-col lg:flex-row gap-6">
          <div class="flex-1 min-w-0">
            <slot />
          </div>
          <aside class="w-full lg:w-72 flex-none">
            <slot name="sidebar" />
          </aside>
        </div>
      </template>
      <slot v-else />
    </main>
    <footer class="border-t border-gray-200 bg-white mt-8">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-12 flex items-center justify-between text-xs text-gray-400">
        <span>© {{ new Date().getFullYear() }} {{ configStore.branding.storeName }} — Ropa para bebés y niños</span>
        <span>Hecho con ♥ en Argentina</span>
      </div>
    </footer>
  </div>
</template>
