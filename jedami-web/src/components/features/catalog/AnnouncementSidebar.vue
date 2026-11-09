<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { fetchAnnouncements, type PublicAnnouncement } from '@/api/announcements.api'

// layout 'sidebar': columna lateral (ficha de producto) · 'row': tarjetas horizontales (home)
const props = withDefaults(defineProps<{ layout?: 'sidebar' | 'row' }>(), { layout: 'sidebar' })
const emit = defineEmits<{ hasContent: [value: boolean] }>()

const authStore = useAuthStore()
const router = useRouter()

const announcements = ref<PublicAnnouncement[]>([])
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
    emit('hasContent', announcements.value.length > 0)
  }
})

function handleClick(announcement: PublicAnnouncement) {
  if (!announcement.linkUrl) return
  if (announcement.linkUrl.startsWith('/')) {
    router.push(announcement.linkUrl)
  } else {
    window.open(announcement.linkUrl, '_blank', 'noopener')
  }
}
</script>

<template>
  <!-- Fila horizontal (home) -->
  <template v-if="props.layout === 'row'">
    <div v-if="loading" class="grid gap-4 md:grid-cols-2">
      <div v-for="n in 2" :key="n" class="h-32 animate-pulse rounded-[var(--t-radius-card)] bg-[var(--t-surface)]" />
    </div>
    <div v-else-if="announcements.length > 0" class="grid gap-4 md:grid-cols-2">
      <component
        :is="a.linkUrl ? 'button' : 'div'"
        v-for="a in announcements"
        :key="a.id"
        :type="a.linkUrl ? 'button' : undefined"
        class="flex w-full items-stretch overflow-hidden rounded-[var(--t-radius-card)] bg-[var(--t-surface)] text-left"
        :class="{ 'transition-shadow hover:shadow-md': !!a.linkUrl }"
        @click="handleClick(a)"
      >
        <img v-if="a.imageUrl" :src="a.imageUrl" alt="" class="w-2/5 max-w-60 shrink-0 object-cover" />
        <div class="flex flex-col justify-center gap-1.5 p-5">
          <p class="text-base font-bold leading-snug">{{ a.title }}</p>
          <p v-if="a.body" class="text-sm leading-relaxed text-[var(--t-muted)]">{{ a.body }}</p>
          <span v-if="a.linkUrl && a.linkLabel" class="mt-1 text-sm font-semibold text-[var(--t-highlight)]">{{ a.linkLabel }} →</span>
        </div>
      </component>
    </div>
  </template>

  <!-- Skeleton mientras carga -->
  <div v-else-if="loading" class="space-y-4">
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
