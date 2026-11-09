<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'
import ProductCard from '@/components/features/catalog/ProductCard.vue'
import AnnouncementSidebar from '@/components/features/catalog/AnnouncementSidebar.vue'
import { useProductsStore } from '@/stores/products.store'
import { useAuthStore } from '@/stores/auth.store'
import { fetchBanners, type Banner } from '@/api/banners.api'
import { MODES } from '@/lib/constants'

const productsStore = useProductsStore()
const authStore = useAuthStore()
const route = useRoute()
const router = useRouter()

// ─── Filtros desde la URL (?categoria=ID&search=texto) ────────────────────────
const queryCategoryId = computed(() => {
  const n = Number(route.query.categoria)
  return Number.isInteger(n) && n > 0 ? n : null
})
const querySearch = computed(() => ((route.query.search as string) ?? '').trim() || null)
const isHome = computed(() => queryCategoryId.value === null && querySearch.value === null)

function applyQueryFilters() {
  productsStore.selectedCategoryId = queryCategoryId.value
  productsStore.search = querySearch.value
  productsStore.fetchCatalog(true)
}

watch(() => [route.query.categoria, route.query.search], applyQueryFilters)

function selectCategory(id: number | null) {
  const query = { ...route.query }
  if (id === null) delete query.categoria
  else query.categoria = String(id)
  router.push({ path: '/catalogo', query })
}

const sectionTitle = computed(() => {
  if (querySearch.value) return `Resultados para "${querySearch.value}"`
  if (queryCategoryId.value !== null) {
    return productsStore.categories.find(c => c.id === queryCategoryId.value)?.name ?? 'Catálogo'
  }
  return 'Lo más nuevo'
})

// ─── Banner carrusel ──────────────────────────────────────────────────────────
const banners = ref<Banner[]>([])
const bannerIndex = ref(0)
let bannerTimer: ReturnType<typeof setInterval> | null = null

function bannerNext() {
  bannerIndex.value = (bannerIndex.value + 1) % banners.value.length
}
function bannerPrev() {
  bannerIndex.value = (bannerIndex.value - 1 + banners.value.length) % banners.value.length
  restartAutoPlay()
}
function bannerGoto(i: number) {
  bannerIndex.value = i
  restartAutoPlay()
}
function startAutoPlay() {
  bannerTimer = setInterval(bannerNext, 5000)
}
function restartAutoPlay() {
  if (bannerTimer) { clearInterval(bannerTimer); startAutoPlay() }
}
function handleBannerClick(banner: Banner) {
  if (!banner.linkUrl) return
  if (banner.linkUrl.startsWith('/')) router.push(banner.linkUrl)
  else window.open(banner.linkUrl, '_blank', 'noopener')
}

// ─── Tarjetas de categoría: usan la foto del primer producto de cada una ──────
const categoryCards = computed(() => {
  const cards: { id: number; name: string; imageUrl: string }[] = []
  const byCount = [...productsStore.categories].sort((a, b) => (b.productCount ?? 0) - (a.productCount ?? 0))
  for (const cat of byCount) {
    const p = productsStore.products.find(pr => pr.categoryId === cat.id && pr.imageUrl)
    if (p?.imageUrl) cards.push({ id: cat.id, name: cat.name, imageUrl: p.imageUrl })
    if (cards.length === 3) break
  }
  return cards
})

// Foto para la banda mayorista (un producto con imagen distinto al de las tarjetas)
const wholesaleImage = computed(() => {
  const used = new Set(categoryCards.value.map(c => c.imageUrl))
  return productsStore.products.find(p => p.imageUrl && !used.has(p.imageUrl))?.imageUrl ?? null
})
const showWholesaleBand = computed(() => isHome.value && authStore.mode === MODES.RETAIL)

const showAnnouncements = ref(true)

// Chips de filtro: categorías con productos (o la seleccionada, aunque esté vacía)
const filterCategories = computed(() =>
  productsStore.categories.filter(c => (c.productCount ?? 1) > 0 || c.id === queryCategoryId.value),
)

onMounted(async () => {
  if (productsStore.categories.length === 0) productsStore.loadCategories()
  applyQueryFilters()
  try {
    banners.value = await fetchBanners()
    if (banners.value.length > 1) startAutoPlay()
  } catch { /* banners no críticos, ignorar error */ }
})

onUnmounted(() => {
  if (bannerTimer) clearInterval(bannerTimer)
})

function loadMore() {
  productsStore.fetchCatalog()
}

function chipClass(active: boolean) {
  return [
    'min-h-10 rounded-full border px-5 text-sm font-medium transition-colors',
    active
      ? 'border-[var(--t-ink)] bg-[var(--t-ink)] text-white'
      : 'border-[var(--t-border)] bg-white text-[var(--t-ink)] hover:border-[var(--t-ink)]',
  ]
}
</script>

<template>
  <AppLayout>
    <!-- Hero: carrusel de banners -->
    <section
      v-if="isHome && banners.length > 0"
      class="relative mb-8 h-80 sm:h-[28rem] md:h-[38rem] overflow-hidden rounded-[var(--t-radius-lg)] bg-[var(--t-surface)]"
      aria-roledescription="carrusel"
      aria-label="Novedades destacadas"
    >
      <template v-for="(banner, i) in banners" :key="banner.id">
        <div
          class="absolute inset-0 transition-opacity duration-700"
          :class="i === bannerIndex ? 'opacity-100' : 'opacity-0 pointer-events-none'"
          :aria-hidden="i !== bannerIndex"
        >
          <button
            v-if="banner.linkUrl"
            type="button"
            class="block h-full w-full"
            :aria-label="`Ver banner ${i + 1}`"
            :tabindex="i === bannerIndex ? 0 : -1"
            @click="handleBannerClick(banner)"
          >
            <img :src="banner.imageUrl" alt="" class="h-full w-full object-cover" />
          </button>
          <img v-else :src="banner.imageUrl" alt="" class="h-full w-full object-cover" />
        </div>
      </template>

      <template v-if="banners.length > 1">
        <button
          type="button"
          aria-label="Banner anterior"
          class="absolute left-4 top-1/2 -translate-y-1/2 hidden sm:flex h-11 w-11 items-center justify-center rounded-full bg-white/90 shadow hover:bg-white transition-colors"
          @click="bannerPrev"
        >
          <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
        </button>
        <button
          type="button"
          aria-label="Banner siguiente"
          class="absolute right-4 top-1/2 -translate-y-1/2 hidden sm:flex h-11 w-11 items-center justify-center rounded-full bg-white/90 shadow hover:bg-white transition-colors"
          @click="bannerNext(); restartAutoPlay()"
        >
          <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
        </button>
        <div class="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
          <button
            v-for="(_, i) in banners"
            :key="i"
            type="button"
            :aria-label="`Ir al banner ${i + 1}`"
            :aria-current="i === bannerIndex"
            class="h-2.5 rounded-full transition-all"
            :class="i === bannerIndex ? 'w-6 bg-white' : 'w-2.5 bg-white/60 hover:bg-white/80'"
            @click="bannerGoto(i)"
          />
        </div>
      </template>
    </section>

    <!-- Anuncios (tarjetas horizontales) -->
    <section v-if="isHome && showAnnouncements" class="mb-10">
      <AnnouncementSidebar layout="row" @has-content="showAnnouncements = $event" />
    </section>

    <!-- Categorías destacadas -->
    <section v-if="isHome && categoryCards.length > 0" class="mb-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-label="Categorías">
      <RouterLink
        v-for="cat in categoryCards"
        :key="cat.id"
        :to="{ path: '/catalogo', query: { categoria: cat.id } }"
        class="group relative block h-80 sm:h-[26rem] overflow-hidden rounded-[var(--t-radius-lg)]"
      >
        <img :src="cat.imageUrl" alt="" class="absolute inset-0 h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-105" loading="lazy" />
        <div class="absolute inset-0 bg-gradient-to-b from-transparent from-40% to-black/60" />
        <div class="absolute inset-x-7 bottom-7 flex flex-col items-start gap-4 text-white">
          <span class="text-3xl font-bold">{{ cat.name }}</span>
          <span class="rounded-full border-[1.5px] border-white px-7 py-2.5 text-[15px]">Ver todo</span>
        </div>
      </RouterLink>
    </section>

    <!-- Productos -->
    <section aria-labelledby="catalog-title">
      <div class="mb-5 flex flex-wrap items-end justify-between gap-4">
        <h1 id="catalog-title" class="text-2xl sm:text-[32px] font-bold leading-tight">{{ sectionTitle }}</h1>
        <RouterLink v-if="!isHome" to="/catalogo" class="text-sm font-medium underline underline-offset-4">Ver todo el catálogo</RouterLink>
      </div>

      <div v-if="productsStore.categories.length > 0" class="mb-7 flex flex-wrap gap-2" role="group" aria-label="Filtrar por categoría">
        <button type="button" :class="chipClass(queryCategoryId === null)" :aria-pressed="queryCategoryId === null" @click="selectCategory(null)">
          Todas
        </button>
        <button
          v-for="cat in filterCategories"
          :key="cat.id"
          type="button"
          :class="chipClass(queryCategoryId === cat.id)"
          :aria-pressed="queryCategoryId === cat.id"
          @click="selectCategory(cat.id)"
        >
          {{ cat.name }}
        </button>
      </div>

      <div class="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-5 md:grid-cols-3 lg:grid-cols-4">
        <ProductCard
          v-for="product in productsStore.products"
          :key="product.id"
          :product="product"
          :mode="authStore.mode"
        />
        <template v-if="productsStore.loading">
          <div v-for="n in 8" :key="`sk-${n}`" class="flex flex-col gap-3">
            <div class="aspect-[3/4] animate-pulse rounded-[var(--t-radius-card)] bg-[var(--t-surface)]" />
            <div class="h-4 w-3/4 animate-pulse rounded bg-[var(--t-surface)]" />
            <div class="h-5 w-1/3 animate-pulse rounded bg-[var(--t-surface)]" />
          </div>
        </template>
      </div>

      <div v-if="productsStore.error" class="py-16 text-center">
        <p class="mb-2 font-semibold text-red-600">{{ productsStore.error }}</p>
        <button type="button" class="text-sm font-semibold underline" @click="productsStore.fetchCatalog(true)">Reintentar</button>
      </div>

      <div v-else-if="!productsStore.loading && productsStore.products.length === 0" class="py-16 text-center text-[var(--t-muted)]">
        <template v-if="querySearch">
          <p class="text-lg font-medium text-[var(--t-ink)]">No encontramos productos para "{{ querySearch }}".</p>
          <p class="mt-1 text-sm">Probá con otra búsqueda.</p>
        </template>
        <p v-else>No hay productos en esta categoría por ahora.</p>
      </div>

      <div v-if="productsStore.products.length < productsStore.total && !productsStore.loading" class="mt-10 flex justify-center">
        <button
          type="button"
          class="min-h-11 rounded-full border-[1.5px] border-[var(--t-ink)] px-8 text-sm font-semibold hover:bg-[var(--t-ink)] hover:text-white transition-colors"
          @click="loadMore"
        >
          Ver más productos
        </button>
      </div>
    </section>

    <!-- Banda mayorista -->
    <section v-if="showWholesaleBand" class="mt-14">
      <div class="flex flex-wrap overflow-hidden rounded-[var(--t-radius-lg)] bg-[var(--t-highlight)] text-[var(--t-highlight-ink)]">
        <div class="flex flex-[1_1_420px] flex-col items-start justify-center gap-4 px-8 py-12 sm:px-12">
          <span class="rounded-full bg-[var(--t-sun)] px-3.5 py-1.5 text-xs font-bold tracking-[2px] text-[var(--t-ink)]">PARA COMERCIOS</span>
          <h2 class="text-3xl sm:text-[44px] font-extrabold leading-[1.05]">¿Tenés un local?<br>Comprá por mayor</h2>
          <p class="max-w-md text-base sm:text-lg leading-relaxed">Precios mayoristas en todo el catálogo. Comprá por curva o por cantidad y armá tu pedido en minutos.</p>
          <RouterLink
            v-if="!authStore.isAuthenticated"
            to="/registro"
            class="mt-2 inline-flex min-h-12 items-center rounded-full bg-white px-8 text-base font-bold text-[var(--t-highlight)]"
          >
            Quiero ser mayorista
          </RouterLink>
          <button
            v-else
            type="button"
            class="mt-2 inline-flex min-h-12 items-center rounded-full bg-white px-8 text-base font-bold text-[var(--t-highlight)]"
            @click="authStore.toggleMode()"
          >
            Ver precios mayoristas
          </button>
        </div>
        <img
          v-if="wholesaleImage"
          :src="wholesaleImage"
          alt=""
          class="max-h-[460px] min-h-[320px] flex-[1_1_360px] object-cover object-top"
          loading="lazy"
        />
      </div>
    </section>

    <!-- Beneficios -->
    <section v-if="isHome" class="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4" aria-label="Beneficios">
      <div class="flex items-center gap-3.5">
        <svg class="h-10 w-10 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" aria-hidden="true"><path d="M2 7h11v9H2z" /><path d="M13 10h4l3 3v3h-7z" /><circle cx="6" cy="18" r="1.8" /><circle cx="17" cy="18" r="1.8" /></svg>
        <div><p class="text-[15px] font-semibold">Envíos</p><p class="text-sm text-[var(--t-muted)]">A todo el país</p></div>
      </div>
      <div class="flex items-center gap-3.5">
        <svg class="h-10 w-10 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" aria-hidden="true"><path d="M4 20l1.3-3.9A8 8 0 1 1 8 19z" /></svg>
        <div><p class="text-[15px] font-semibold">Atención personalizada</p><p class="text-sm text-[var(--t-muted)]">Por WhatsApp</p></div>
      </div>
      <div class="flex items-center gap-3.5">
        <svg class="h-10 w-10 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18v12H3z" /><path d="M3 10h18" /><path d="M7 15h4" /></svg>
        <div><p class="text-[15px] font-semibold">Pagos seguros</p><p class="text-sm text-[var(--t-muted)]">Transferencia bancaria</p></div>
      </div>
      <div class="flex items-center gap-3.5">
        <svg class="h-10 w-10 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" aria-hidden="true"><path d="M4 9l2-5h12l2 5" /><path d="M4 9h16v11H4z" /><path d="M9 20v-6h6v6" /></svg>
        <div><p class="text-[15px] font-semibold">Venta mayorista</p><p class="text-sm text-[var(--t-muted)]">Por curva o por cantidad</p></div>
      </div>
    </section>
  </AppLayout>
</template>
