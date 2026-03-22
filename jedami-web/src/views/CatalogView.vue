<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'
import ProductCard from '@/components/features/catalog/ProductCard.vue'
import { useProductsStore } from '@/stores/products.store'
import { useAuthStore } from '@/stores/auth.store'
import { fetchBanners, type Banner } from '@/api/banners.api'
import AnnouncementSidebar from '@/components/features/catalog/AnnouncementSidebar.vue'

const productsStore = useProductsStore()
const authStore = useAuthStore()
const route = useRoute()
const router = useRouter()

const searchInput = ref('')
let debounceTimer: ReturnType<typeof setTimeout>

// ─── Banner carrusel ──────────────────────────────────────────────────────────
const banners = ref<Banner[]>([])
const bannerIndex = ref(0)
let bannerTimer: ReturnType<typeof setInterval> | null = null

function bannerNext() {
  bannerIndex.value = (bannerIndex.value + 1) % banners.value.length
}

function bannerGoto(i: number) {
  bannerIndex.value = i
  if (bannerTimer) { clearInterval(bannerTimer); startAutoPlay() }
}

function startAutoPlay() {
  bannerTimer = setInterval(bannerNext, 4000)
}

function handleBannerClick(banner: Banner) {
  if (!banner.linkUrl) return
  if (banner.linkUrl.startsWith('/')) {
    router.push(banner.linkUrl)
  } else {
    window.open(banner.linkUrl, '_blank', 'noopener')
  }
}

onMounted(async () => {
  productsStore.loadCategories()
  searchInput.value = (route.query.search as string) ?? ''
  productsStore.search = searchInput.value || null
  productsStore.fetchCatalog(true)

  try {
    banners.value = await fetchBanners()
    if (banners.value.length > 1) startAutoPlay()
  } catch { /* banners no críticos, ignorar error */ }
})

onUnmounted(() => {
  if (bannerTimer) clearInterval(bannerTimer)
})

watch(searchInput, (val) => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(async () => {
    router.replace({ query: { ...route.query, search: val || undefined } })
    await productsStore.filterBySearch(val || null)
  }, 400)
})

function loadMore() {
  productsStore.fetchCatalog()
}
</script>

<template>
  <AppLayout>
    <!-- Banner carrusel -->
    <div
      v-if="banners.length > 0"
      class="relative w-full h-80 sm:h-[28rem] md:h-[40rem] rounded-2xl overflow-hidden mb-6 bg-gray-100"
    >
      <template v-for="(banner, i) in banners" :key="banner.id">
        <div
          class="absolute inset-0 transition-opacity duration-500"
          :class="i === bannerIndex ? 'opacity-100' : 'opacity-0'"
          :style="{ cursor: banner.linkUrl ? 'pointer' : 'default' }"
          @click="handleBannerClick(banner)"
        >
          <img
            :src="banner.imageUrl"
            :alt="`Banner ${i + 1}`"
            class="w-full h-full object-cover"
          />
        </div>
      </template>

      <!-- Dots -->
      <div v-if="banners.length > 1" class="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
        <button
          v-for="(_, i) in banners"
          :key="i"
          @click.stop="bannerGoto(i)"
          class="w-2 h-2 rounded-full transition-all"
          :class="i === bannerIndex ? 'bg-white scale-125' : 'bg-white/50 hover:bg-white/75'"
        />
      </div>
    </div>

    <h1 class="text-2xl font-bold text-gray-900 mb-6">Catálogo</h1>

    <!-- Buscador -->
    <div class="relative mb-4 max-w-sm">
      <input
        v-model="searchInput"
        type="text"
        placeholder="Buscar productos..."
        class="h-10 w-full rounded-xl border border-gray-300 pl-4 pr-9 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-primary,#E91E8C)]"
      />
      <button
        v-if="searchInput"
        @click="searchInput = ''"
        class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
      >✕</button>
    </div>

    <!-- Filtro de categorías -->
    <div v-if="productsStore.categories.length > 0" class="flex gap-2 flex-wrap mb-6">
      <button
        @click="productsStore.filterByCategory(null)"
        :class="[
          'px-4 py-1.5 rounded-full text-sm font-semibold transition-colors border',
          productsStore.selectedCategoryId === null
            ? 'bg-[#E91E8C] text-white border-[#E91E8C]'
            : 'bg-white text-gray-700 border-gray-300 hover:border-[#E91E8C] hover:text-[#E91E8C]',
        ]"
      >
        Todas
      </button>
      <button
        v-for="cat in productsStore.categories"
        :key="cat.id"
        @click="productsStore.filterByCategory(cat.id)"
        :class="[
          'px-4 py-1.5 rounded-full text-sm font-semibold transition-colors border',
          productsStore.selectedCategoryId === cat.id
            ? 'bg-[#E91E8C] text-white border-[#E91E8C]'
            : 'bg-white text-gray-700 border-gray-300 hover:border-[#E91E8C] hover:text-[#E91E8C]',
        ]"
      >
        {{ cat.name }}
      </button>
    </div>

    <div class="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      <ProductCard
        v-for="product in productsStore.products"
        :key="product.id"
        :product="product"
        :mode="authStore.mode"
      />
      <template v-if="productsStore.loading">
        <div
          v-for="n in 8"
          :key="`sk-${n}`"
          class="rounded-2xl bg-gray-200 animate-pulse aspect-[3/4]"
        />
      </template>
    </div>

    <div
      v-if="productsStore.error"
      class="text-center py-16"
    >
      <p class="text-red-500 font-semibold mb-2">{{ productsStore.error }}</p>
      <button
        @click="productsStore.fetchCatalog(true)"
        class="text-sm text-[#E91E8C] hover:underline font-semibold"
      >
        Reintentar
      </button>
    </div>

    <div
      v-else-if="!productsStore.loading && productsStore.products.length === 0"
      class="text-center py-16 text-gray-500"
    >
      <template v-if="productsStore.search">
        <p class="text-lg font-medium">No encontramos productos para "{{ productsStore.search }}".</p>
        <p class="text-sm mt-1">Probá con otra búsqueda.</p>
      </template>
      <p v-else>No hay productos disponibles.</p>
    </div>

    <div
      v-if="productsStore.products.length < productsStore.total && !productsStore.loading"
      class="mt-8 flex justify-center"
    >
      <button
        @click="loadMore"
        class="px-6 py-2 rounded-full border border-gray-300 text-sm font-semibold text-gray-700 hover:border-[#E91E8C] hover:text-[#E91E8C] transition-colors"
      >
        Cargar más
      </button>
    </div>

  <template #sidebar>
    <AnnouncementSidebar />
  </template>
  </AppLayout>
</template>
