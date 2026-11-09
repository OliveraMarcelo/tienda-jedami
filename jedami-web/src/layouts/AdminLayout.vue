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
      { to: '/admin/point', label: 'Punto de venta', icon: 'pos' },
      { to: '/admin/reportes', label: 'Estadísticas', icon: 'chart' },
    ],
  },
  {
    title: 'Catálogo',
    items: [
      { to: '/admin/productos', label: 'Productos', icon: 'box' },
      { to: '/admin/usuarios', label: 'Clientes y usuarios', icon: 'users' },
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
    <!-- Sidebar -->
    <aside
      id="admin-sidebar"
      :class="[
        'bg-[var(--a-surface)] border-[var(--a-border)] lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:shrink-0 lg:overflow-y-auto lg:border-r lg:block',
        menuOpen ? 'block border-b' : 'hidden',
      ]"
    >
      <div class="flex items-center gap-3 px-5 py-5">
        <span class="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[var(--color-primary,#E91E8C)] font-bold text-white">
          {{ storeName.charAt(0).toUpperCase() }}
        </span>
        <div class="flex min-w-0 flex-col">
          <span class="truncate text-[15px] font-bold">{{ storeName }}</span>
          <RouterLink to="/catalogo" class="text-[13px] font-medium text-[var(--a-primary)] hover:text-[var(--a-primary-hover)]">Ver mi tienda</RouterLink>
        </div>
      </div>

      <nav aria-label="Administración" class="flex flex-col gap-0.5 px-3 pb-6 text-sm">
        <template v-for="(group, gi) in groups" :key="gi">
          <p v-if="group.title" class="mx-3 mb-1.5 mt-4 text-xs font-semibold uppercase tracking-wide text-[var(--a-muted)]">
            {{ group.title }}
          </p>
          <RouterLink
            v-for="item in group.items"
            :key="item.to"
            :to="item.to"
            :aria-current="isActive(item.to) ? 'page' : undefined"
            :class="[
              'flex min-h-10 items-center gap-3 rounded-lg px-3 transition-colors',
              isActive(item.to)
                ? 'bg-[var(--a-primary-soft)] font-semibold text-[var(--a-primary)]'
                : 'text-[var(--a-ink)] hover:bg-[var(--a-bg)]',
            ]"
          >
            <svg class="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path :d="ICONS[item.icon]" />
            </svg>
            {{ item.label }}
          </RouterLink>
        </template>
      </nav>
    </aside>

    <!-- Contenido -->
    <div class="flex min-w-0 flex-1 flex-col">
      <header class="sticky top-0 z-30 flex min-h-16 items-center gap-3 border-b border-[var(--a-border)] bg-[var(--a-surface)] px-4 sm:px-8">
        <button
          type="button"
          class="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-[var(--a-bg)] lg:hidden"
          :aria-expanded="menuOpen"
          aria-controls="admin-sidebar"
          :aria-label="menuOpen ? 'Cerrar menú' : 'Abrir menú'"
          @click="menuOpen = !menuOpen"
        >
          <svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        <span class="font-semibold lg:hidden">{{ storeName }}</span>

        <div class="ml-auto flex items-center gap-2">
          <RouterLink
            to="/catalogo"
            class="hidden sm:inline-flex min-h-10 items-center rounded-lg border border-[#C9CDD2] px-3.5 text-sm font-semibold hover:bg-[var(--a-bg)]"
          >
            Ver mi tienda
          </RouterLink>
          <div class="flex items-center gap-2.5 px-2">
            <span class="flex h-8 w-8 items-center justify-center rounded-full bg-[#FDE2EF] text-xs font-bold text-[#B0135F]">{{ initials }}</span>
            <span class="hidden md:inline max-w-[180px] truncate text-sm">{{ authStore.user?.email }}</span>
          </div>
          <button type="button" class="min-h-10 rounded-lg px-3 text-sm font-medium text-[var(--a-muted)] hover:bg-[var(--a-bg)] hover:text-[var(--a-ink)]" @click="authStore.logout()">
            Salir
          </button>
        </div>
      </header>

      <main class="w-full max-w-[1240px] px-4 py-6 sm:px-8 sm:py-8">
        <slot />
      </main>
    </div>
  </div>
</template>
