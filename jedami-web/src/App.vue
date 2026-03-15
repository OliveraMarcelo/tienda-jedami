<script setup lang="ts">
import { watchEffect } from 'vue'
import { RouterView } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { useConfigStore } from '@/stores/config.store'
import AppSkeleton from '@/components/AppSkeleton.vue'

const authStore = useAuthStore()
const configStore = useConfigStore()

// Aplicar data-mode en <html> para que las CSS variables de modo alcancen todo el documento
watchEffect(() => {
  document.documentElement.setAttribute('data-mode', authStore.mode)
})

// Cargar configuración del sistema al iniciar la app
configStore.loadConfig()
</script>

<template>
  <AppSkeleton v-if="configStore.loading" />
  <RouterView v-else />
</template>
