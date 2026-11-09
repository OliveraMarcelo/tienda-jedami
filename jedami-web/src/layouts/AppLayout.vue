<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import ModeIndicator from '@/components/features/catalog/ModeIndicator.vue'
import { useAuthStore } from '@/stores/auth.store'
import { useConfigStore } from '@/stores/config.store'
import { useProductsStore } from '@/stores/products.store'

const authStore = useAuthStore()
const configStore = useConfigStore()
const productsStore = useProductsStore()
const route = useRoute()
const router = useRouter()

const menuOpen = ref(false)
const searchTerm = ref((route.query.search as string) ?? '')

onMounted(() => {
  if (productsStore.categories.length === 0) productsStore.loadCategories()
})

// Mantener el buscador sincronizado con la URL (ej. al volver atrás)
watch(() => route.query.search, (val) => {
  searchTerm.value = (val as string) ?? ''
})

// Cerrar el menú mobile al navegar
watch(() => route.fullPath, () => { menuOpen.value = false })

function submitSearch() {
  const term = searchTerm.value.trim()
  router.push({ path: '/catalogo', query: term ? { search: term } : {} })
}

const whatsappLink = computed(() => {
  const n = configStore.branding.whatsappNumber?.replace(/\D/g, '')
  // Mismo formato que el checkout: el número se configura completo en branding
  return n ? `https://wa.me/${n}` : null
})

// En la navegación solo se muestran categorías con productos visibles
const navCategories = computed(() => productsStore.categories.filter(c => (c.productCount ?? 1) > 0))

const storeName = computed(() => configStore.branding.storeName)
const year = new Date().getFullYear()

function isCategoryActive(id: number) {
  return route.path === '/catalogo' && Number(route.query.categoria) === id
}
</script>

<template>
  <div class="min-h-screen flex flex-col bg-[var(--t-bg)] text-[var(--t-ink)]">
    <!-- Barra de anuncios -->
    <div class="bg-[var(--t-announce-bg)] text-[var(--t-announce-ink)] text-xs sm:text-[13px] font-medium text-center px-4 py-2">
      Envíos a todo el país · Venta minorista y mayorista<span v-if="whatsappLink"> · Atención por WhatsApp</span>
    </div>

    <!-- Header flotante -->
    <div class="sticky top-0 z-40 px-3 sm:px-4 pt-3">
      <header class="mx-auto max-w-[1376px] rounded-2xl bg-white shadow-[0_6px_24px_rgba(51,54,58,0.08)] px-4 sm:px-6">
        <div class="flex items-center gap-4 lg:gap-8 min-h-16 py-2">
          <RouterLink to="/catalogo" class="flex items-center gap-2 shrink-0" :aria-label="`${storeName} — inicio`">
            <img
              v-if="configStore.branding.logoUrl"
              :src="configStore.branding.logoUrl"
              :alt="storeName"
              class="h-9 w-auto"
            />
            <span v-else class="text-2xl sm:text-[28px] font-extrabold tracking-wide uppercase text-[var(--color-primary,#E91E8C)]">
              {{ storeName }}
            </span>
          </RouterLink>

          <!-- Navegación desktop -->
          <nav aria-label="Principal" class="hidden lg:flex flex-wrap items-center gap-x-6 gap-y-1 text-[15px] font-semibold uppercase flex-1">
            <RouterLink
              to="/catalogo"
              class="transition-colors hover:text-[var(--t-highlight)]"
              :class="route.path === '/catalogo' && !route.query.categoria ? 'text-[var(--t-highlight)]' : ''"
            >
              Novedades
            </RouterLink>
            <RouterLink
              v-for="cat in navCategories"
              :key="cat.id"
              :to="{ path: '/catalogo', query: { categoria: cat.id } }"
              class="transition-colors hover:text-[var(--t-highlight)]"
              :class="isCategoryActive(cat.id) ? 'text-[var(--t-highlight)]' : ''"
            >
              {{ cat.name }}
            </RouterLink>
          </nav>

          <div class="ml-auto flex items-center gap-1 sm:gap-2">
            <ModeIndicator :mode="authStore.mode" @toggle="authStore.toggleMode()" />

            <form role="search" class="hidden md:flex items-center gap-2 border-b border-[var(--t-ink)] px-1 py-1 ml-2" @submit.prevent="submitSearch">
              <label for="header-search" class="sr-only">Buscar productos</label>
              <svg class="h-[18px] w-[18px] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
              <input
                id="header-search"
                v-model="searchTerm"
                type="search"
                placeholder="¿Qué estás buscando?"
                class="w-40 xl:w-48 bg-transparent text-sm outline-none placeholder:text-[var(--t-muted)]"
              />
            </form>

            <RouterLink
              v-if="authStore.isAdmin"
              to="/admin"
              class="hidden sm:inline-flex items-center min-h-9 rounded-full border border-[var(--t-border)] px-3 text-xs font-semibold hover:bg-[var(--t-surface)] transition-colors"
            >
              Admin
            </RouterLink>

            <RouterLink
              v-if="authStore.isAuthenticated && !authStore.isAdmin"
              to="/pedidos"
              class="hidden sm:flex h-11 w-11 items-center justify-center rounded-full hover:bg-[var(--t-surface)] transition-colors"
              aria-label="Mis pedidos"
              title="Mis pedidos"
            >
              <svg class="h-[22px] w-[22px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M5 8h14l-1 12H6L5 8z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></svg>
            </RouterLink>

            <RouterLink
              :to="authStore.isAuthenticated ? '/perfil' : '/login'"
              class="hidden sm:flex h-11 w-11 items-center justify-center rounded-full hover:bg-[var(--t-surface)] transition-colors"
              :aria-label="authStore.isAuthenticated ? 'Mi perfil' : 'Ingresar'"
              :title="authStore.isAuthenticated ? (authStore.user?.email ?? 'Mi perfil') : 'Ingresar'"
            >
              <svg class="h-[22px] w-[22px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></svg>
            </RouterLink>

            <button
              v-if="authStore.isAuthenticated"
              type="button"
              class="hidden sm:inline-flex min-h-9 items-center px-2 text-xs font-medium text-[var(--t-muted)] hover:text-[var(--t-ink)] transition-colors"
              @click="authStore.logout()"
            >
              Salir
            </button>

            <!-- Hamburguesa mobile -->
            <button
              type="button"
              class="lg:hidden flex h-11 w-11 items-center justify-center rounded-full hover:bg-[var(--t-surface)] transition-colors"
              :aria-expanded="menuOpen"
              aria-controls="mobile-menu"
              :aria-label="menuOpen ? 'Cerrar menú' : 'Abrir menú'"
              @click="menuOpen = !menuOpen"
            >
              <svg v-if="!menuOpen" class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
              <svg v-else class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        <!-- Menú mobile -->
        <div v-if="menuOpen" id="mobile-menu" class="lg:hidden border-t border-[var(--t-border)] py-4 flex flex-col gap-1">
          <form role="search" class="flex items-center gap-2 rounded-full bg-[var(--t-surface)] px-4 py-2.5 mb-2 md:hidden" @submit.prevent="submitSearch">
            <label for="mobile-search" class="sr-only">Buscar productos</label>
            <svg class="h-[18px] w-[18px] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
            <input id="mobile-search" v-model="searchTerm" type="search" placeholder="¿Qué estás buscando?" class="flex-1 bg-transparent text-sm outline-none" />
          </form>
          <RouterLink to="/catalogo" class="py-2.5 text-sm font-semibold uppercase">Novedades</RouterLink>
          <RouterLink
            v-for="cat in navCategories"
            :key="cat.id"
            :to="{ path: '/catalogo', query: { categoria: cat.id } }"
            class="py-2.5 text-sm font-semibold uppercase"
          >
            {{ cat.name }}
          </RouterLink>
          <div class="my-2 border-t border-[var(--t-border)]" />
          <RouterLink v-if="authStore.isAuthenticated && !authStore.isAdmin" to="/pedidos" class="py-2.5 text-sm">Mis pedidos</RouterLink>
          <RouterLink v-if="authStore.isAuthenticated" to="/perfil" class="py-2.5 text-sm">Mi perfil</RouterLink>
          <RouterLink v-if="authStore.isAdmin" to="/admin" class="py-2.5 text-sm">Administración</RouterLink>
          <p v-if="authStore.isAuthenticated" class="py-1 text-xs text-[var(--t-muted)] truncate">{{ authStore.user?.email }}</p>
          <RouterLink v-if="!authStore.isAuthenticated" to="/login" class="py-2.5 text-sm font-semibold">Ingresar</RouterLink>
          <button v-else type="button" class="py-2.5 text-left text-sm text-[var(--t-muted)]" @click="authStore.logout()">Salir</button>
        </div>
      </header>
    </div>

    <main class="flex-1 w-full max-w-[1376px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
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

    <!-- Footer -->
    <footer class="bg-[var(--t-footer-bg)] mt-10">
      <div class="max-w-[1376px] mx-auto px-4 sm:px-6 lg:px-8 py-12 flex flex-wrap gap-10">
        <div class="flex-[1_1_220px] flex flex-col gap-3">
          <p class="text-xl font-bold">{{ storeName }}</p>
          <p class="text-sm text-[var(--t-muted)] max-w-xs">Ropa para bebés y niños. Venta minorista y mayorista con envíos a todo el país.</p>
        </div>
        <nav aria-label="Tienda" class="flex-[1_1_160px] flex flex-col gap-2.5 text-sm">
          <p class="text-xl font-bold mb-1">Tienda</p>
          <RouterLink to="/catalogo" class="hover:underline">Catálogo</RouterLink>
          <RouterLink
            v-for="cat in navCategories.slice(0, 4)"
            :key="cat.id"
            :to="{ path: '/catalogo', query: { categoria: cat.id } }"
            class="hover:underline"
          >
            {{ cat.name }}
          </RouterLink>
        </nav>
        <nav aria-label="Mi cuenta" class="flex-[1_1_160px] flex flex-col gap-2.5 text-sm">
          <p class="text-xl font-bold mb-1">Mi cuenta</p>
          <template v-if="authStore.isAuthenticated">
            <RouterLink v-if="!authStore.isAdmin" to="/pedidos" class="hover:underline">Mis pedidos</RouterLink>
            <RouterLink to="/perfil" class="hover:underline">Mi perfil</RouterLink>
          </template>
          <template v-else>
            <RouterLink to="/login" class="hover:underline">Ingresar</RouterLink>
            <RouterLink to="/registro" class="hover:underline">Crear cuenta</RouterLink>
          </template>
        </nav>
        <div class="flex-[1_1_200px] flex flex-col gap-2.5 text-sm">
          <p class="text-xl font-bold mb-1">Contacto</p>
          <a v-if="whatsappLink" :href="whatsappLink" target="_blank" rel="noopener" class="inline-flex items-center gap-2 hover:underline">
            <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M4 20l1.3-3.9A8 8 0 1 1 8 19z" /></svg>
            WhatsApp
          </a>
          <p class="text-[var(--t-muted)]">Escribinos y te ayudamos con tu compra.</p>
        </div>
      </div>
      <div class="max-w-[1376px] mx-auto px-4 sm:px-6 lg:px-8 pb-8 text-xs text-[var(--t-muted)]">
        {{ storeName }} © {{ year }}. Todos los derechos reservados.
      </div>
    </footer>
  </div>
</template>
