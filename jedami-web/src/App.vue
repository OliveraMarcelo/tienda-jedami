<script setup lang="ts">
import { watchEffect } from 'vue'
import { RouterView } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'

const authStore = useAuthStore()

// Aplicar data-mode en <html> para que las CSS variables de modo alcancen todo el documento
watchEffect(() => {
  document.documentElement.setAttribute('data-mode', authStore.mode)
})
</script>

<template>
  <RouterView />
</template>
