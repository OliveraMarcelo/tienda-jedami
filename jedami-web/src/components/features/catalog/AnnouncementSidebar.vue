<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { fetchAnnouncements, type Announcement } from '@/api/announcements.api'

const authStore = useAuthStore()
const router = useRouter()

const announcements = ref<Announcement[]>([])
const loading = ref(true)

const audience = computed<'all' | 'wholesale' | 'retail'>(() => {
  if (!authStore.isAuthenticated) return 'all'
  if (authStore.isWholesale) return 'wholesale'
  return 'retail'
})

onMounted(async () => {
  try {
    announcements.value = await fetchAnnouncements(audience.value)
  } catch {
    // Anuncios no críticos — ignorar error
  } finally {
    loading.value = false
  }
})

function handleClick(announcement: Announcement) {
  if (!announcement.linkUrl) return
  if (announcement.linkUrl.startsWith('/')) {
    router.push(announcement.linkUrl)
  } else {
    window.open(announcement.linkUrl, '_blank', 'noopener')
  }
}
</script>

<template>
  <!-- Skeleton mientras carga -->
  <div v-if="loading" class="space-y-4">
    <div v-for="n in 2" :key="n" class="rounded-2xl bg-gray-200 animate-pulse h-32" />
  </div>

  <!-- Anuncios cargados -->
  <div v-else-if="announcements.length > 0" class="space-y-4 lg:sticky lg:top-24">
    <div
      v-for="a in announcements"
      :key="a.id"
      class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
      :class="{ 'cursor-pointer hover:shadow-md hover:border-[var(--color-primary,#E91E8C)] transition-all': !!a.linkUrl }"
      @click="handleClick(a)"
    >
      <!-- Imagen opcional -->
      <img
        v-if="a.imageUrl"
        :src="a.imageUrl"
        :alt="a.title"
        class="w-full h-32 object-cover"
      />

      <div class="p-4">
        <p class="font-bold text-gray-900 text-sm leading-snug">{{ a.title }}</p>
        <p v-if="a.body" class="text-xs text-gray-600 mt-1 leading-relaxed">{{ a.body }}</p>

        <!-- CTA -->
        <button
          v-if="a.linkUrl && a.linkLabel"
          class="mt-3 text-xs font-semibold text-[var(--color-primary,#E91E8C)] hover:underline"
          @click.stop="handleClick(a)"
        >
          {{ a.linkLabel }} →
        </button>
      </div>
    </div>
  </div>

  <!-- Sin anuncios: no renderiza nada -->
</template>
