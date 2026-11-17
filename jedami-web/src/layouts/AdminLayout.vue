<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { useConfigStore } from '@/stores/config.store'

const authStore = useAuthStore()
const configStore = useConfigStore()
const route = useRoute()

const menuOpen = ref(false)
watch(() => route.fullPath, () => { menuOpen.value = false })

interface NavItem { to: string; label: string; icon: string }
interface NavGroup { title?: string; items: NavItem[] }

// Íconos: paths SVG (stroke) para no depender de una librería en el menú
const ICONS: Record<string, string> = {
  home: 'M3 11l9-7 9 7v9h-6v-6H9v6H3z',
  sales: 'M5 8h14l-1 12H6L5 8zM9 8V6a3 3 0 0 1 6 0v2',
  truck: 'M2 7h11v9H2zM13 10h4l3 3v3h-7zM6 18a1.8 1.8 0 1 0 0 .1M17 18a1.8 1.8 0 1 0 0 .1',
  pos: 'M4 4h16v10H4zM8 20h8M12 14v6',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  box: 'M12 3l8 4v10l-8 4-8-4V7zM4 7l8 4 8-4M12 11v10',
  users: 'M9 4.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM2.5 20c.8-3.5 3.3-5.5 6.5-5.5s5.7 2 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c2 .8 3.2 2.6 3.6 5.2',
  image: 'M3 5h18v14H3zM3 15l5-5 4 4 3-3 6 6',
  megaphone: 'M4 10v4h3l6 4V6L7 10zM17 9a4 4 0 0 1 0 6',
  settings: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1',
}

const groups: NavGroup[] = [
  { items: [{ to: '/admin/dashboard', label: 'Inicio', icon: 'home' }] },
  {
    title: 'Ventas',
    items: [
      { to: '/admin/pagos', label: 'Pagos', icon: 'sales' },
      { to: '/admin/despacho', label: 'Despacho', icon: 'truck' },
      { to: '/admin/usuarios', label: 'Clientes', icon: 'users' },
      // Punto de venta (Mercado Pago Point) oculto hasta tener el dispositivo: la ruta /admin/point sigue andando
    ],
  },
  {
    title: 'Catálogo',
    items: [
      { to: '/admin/productos', label: 'Productos', icon: 'box' },
    ],
  },
  {
    title: 'Mi tienda',
    items: [
      { to: '/admin/banners', label: 'Banners', icon: 'image' },
      { to: '/admin/anuncios', label: 'Anuncios', icon: 'megaphone' },
      { to: '/admin/configuracion', label: 'Configuración', icon: 'settings' },
    ],
  },
]

function isActive(to: string) {
  return route.path === to || route.path.startsWith(`${to}/`)
}

const storeName = computed(() => configStore.branding.storeName)
const initials = computed(() => (authStore.user?.email ?? 'A').slice(0, 2).toUpperCase())
</script>

<template>
  <div class="admin-ui min-h-screen bg-[var(--a-bg)] text-[var(--a-ink)] lg:flex">
    <!-- Fondo del menú en el celular -->
    <Transition enter-active-class="transition-opacity duration-200" enter-from-class="opacity-0" leave-active-class="transition-opacity duration-150" leave-to-class="opacity-0">
      <div v-if="menuOpen" class="fixed inset-0 z-40 bg-[#0B1220]/40 backdrop-blur-[2px] lg:hidden" aria-hidden="true" @click="menuOpen = false" />
    </Transition>

    <!-- Menú lateral: fijo en la compu, panel deslizable en el celular -->
    <aside
      id="admin-sidebar"
      :class="[
        'fixed inset-y-0 left-0 z-50 flex w-[264px] flex-col border-r border-[var(--a-border)] bg-[var(--a-surface)] transition-transform duration-200 ease-out',
        'lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:w-[248px] lg:shrink-0 lg:translate-x-0',
        menuOpen ? 'translate-x-0 shadow-[var(--a-shadow-lg)]' : '-translate-x-full',
      ]"
    >
      <div class="flex items-center gap-3 px-5 pb-4 pt-5">
        <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary,#E91E8C)] text-[15px] font-bold text-white shadow-sm">
          {{ storeName.charAt(0).toUpperCase() }}
        </span>
        <div class="flex min-w-0 flex-col leading-tight">
          <span class="truncate text-[15px] font-semibold tracking-[-0.01em]">{{ storeName }}</span>
          <span class="text-xs text-[var(--a-muted)]">Panel de la tienda</span>
        </div>
        <button
          type="button"
          class="ml-auto flex h-9 w-9 items-center justify-center rounded-lg text-[var(--a-muted)] hover:bg-[var(--a-bg)] lg:hidden"
          aria-label="Cerrar menú"
          @click="menuOpen = false"
        >
          <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>

      <nav aria-label="Administración" class="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-4 text-[14px]">
        <template v-for="(group, gi) in groups" :key="gi">
          <p v-if="group.title" class="mx-3 mb-1 mt-5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8A909B]">
            {{ group.title }}
          </p>
          <RouterLink
            v-for="item in group.items"
            :key="item.to"
            :to="item.to"
            :aria-current="isActive(item.to) ? 'page' : undefined"
            :class="[
              'group flex min-h-10 items-center gap-3 rounded-[10px] px-3 font-medium transition-colors',
              isActive(item.to)
                ? 'bg-[var(--a-primary-soft)] text-[var(--a-primary)]'
                : 'text-[#3A3F47] hover:bg-[var(--a-bg)] hover:text-[var(--a-ink)]',
            ]"
          >
            <svg
              :class="['h-[18px] w-[18px] shrink-0', isActive(item.to) ? 'text-[var(--a-primary)]' : 'text-[#8A909B] group-hover:text-[var(--a-ink)]']"
              viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
            >
              <path :d="ICONS[item.icon]" />
            </svg>
            {{ item.label }}
          </RouterLink>
        </template>
      </nav>

      <RouterLink
        to="/catalogo"
        class="mx-3 mb-4 flex items-center gap-3 rounded-[10px] border border-[var(--a-border)] px-3 py-2.5 text-sm font-medium text-[#3A3F47] hover:bg-[var(--a-bg)]"
      >
        <svg class="h-[18px] w-[18px] text-[#8A909B]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>
        Ver mi tienda
      </RouterLink>
    </aside>

    <!-- Contenido -->
    <div class="flex min-w-0 flex-1 flex-col">
      <header class="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-[var(--a-border)] bg-white/80 px-4 backdrop-blur-md sm:px-8">
        <button
          type="button"
          class="-ml-1.5 flex h-11 w-11 items-center justify-center rounded-[10px] hover:bg-[var(--a-bg)] lg:hidden"
          :aria-expanded="menuOpen"
          aria-controls="admin-sidebar"
          aria-label="Abrir menú"
          @click="menuOpen = true"
        >
          <svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
        </button>
        <span class="truncate font-semibold lg:hidden">{{ storeName }}</span>

        <div class="ml-auto flex items-center gap-1.5">
          <div class="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-1 sm:pr-3">
            <span class="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#2457E6] to-[#7C3AED] text-xs font-semibold text-white">{{ initials }}</span>
            <span class="hidden max-w-[200px] truncate text-sm font-medium text-[#3A3F47] md:inline">{{ authStore.user?.email }}</span>
          </div>
          <button
            type="button"
            class="flex min-h-10 items-center gap-2 rounded-[10px] px-3 text-sm font-medium text-[var(--a-muted)] hover:bg-[var(--a-bg)] hover:text-[var(--a-ink)]"
            @click="authStore.logout()"
          >
            <svg class="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l4-4-4-4M14 12H4" /></svg>
            <span>Salir</span>
          </button>
        </div>
      </header>

      <!-- Ocupa todo el ancho disponible: sin franjas vacías a los costados -->
      <main class="jd-page w-full px-4 py-6 sm:px-6 sm:py-8 xl:px-10">
        <slot />
      </main>
    </div>
  </div>
</template>
