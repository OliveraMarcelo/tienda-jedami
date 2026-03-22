<script setup lang="ts">
import { ref, watchEffect, onMounted } from 'vue'
import { RouterView } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { useConfigStore } from '@/stores/config.store'
import AppSkeleton from '@/components/AppSkeleton.vue'

const authStore = useAuthStore()
const configStore = useConfigStore()
const ready = ref(false)

// Aplicar data-mode en <html> para que las CSS variables de modo alcancen todo el documento
watchEffect(() => {
  document.documentElement.setAttribute('data-mode', authStore.mode)
})

// Aplicar branding dinámico cuando se cargue
watchEffect(() => {
  const b = configStore.branding
  document.documentElement.style.setProperty('--color-primary', b.primaryColor)
  document.documentElement.style.setProperty('--color-secondary', b.secondaryColor)
  document.title = b.storeName
})

onMounted(async () => {
  await Promise.all([
    configStore.loadConfig(),
    configStore.loadBranding(),
  ])
  ready.value = true
})
</script>

<template>
  <AppSkeleton v-if="!ready" />
  <RouterView v-else />
</template>
