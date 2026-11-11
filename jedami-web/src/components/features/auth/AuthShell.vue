<script setup lang="ts">
import AppLayout from '@/layouts/AppLayout.vue'
import { useConfigStore } from '@/stores/config.store'

defineProps<{
  title: string
  subtitle?: string
}>()

const configStore = useConfigStore()
</script>

<template>
  <AppLayout>
    <div class="mx-auto grid max-w-5xl overflow-hidden rounded-[var(--t-radius-lg)] bg-white md:grid-cols-2 md:shadow-[0_6px_24px_rgba(51,54,58,0.08)]">
      <!-- Panel de marca (solo desktop) -->
      <div class="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-[var(--t-hero-a)] to-[var(--t-hero-b)] p-10 md:flex">
        <span class="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[var(--t-sticker-1)] opacity-30" aria-hidden="true" />
        <span class="absolute -bottom-20 -right-12 h-48 w-48 rounded-full bg-[var(--t-sun)] opacity-40" aria-hidden="true" />
        <span class="absolute bottom-24 right-10 h-16 w-16 rounded-full bg-[var(--t-sticker-2)] opacity-30" aria-hidden="true" />

        <p class="relative text-2xl font-extrabold text-[var(--color-primary,#E91E8C)]">{{ configStore.branding.storeName }}</p>

        <div class="relative">
          <p class="text-[34px] font-extrabold leading-[1.1]">Ropa suave para los más chiquitos</p>
          <ul class="mt-6 flex flex-col gap-2.5 text-[15px]">
            <li class="flex items-center gap-2.5"><span class="h-2 w-2 rounded-full bg-[var(--t-highlight)]" aria-hidden="true" />Envíos a todo el país</li>
            <li class="flex items-center gap-2.5"><span class="h-2 w-2 rounded-full bg-[var(--t-highlight)]" aria-hidden="true" />Precios por mayor para comercios</li>
            <li class="flex items-center gap-2.5"><span class="h-2 w-2 rounded-full bg-[var(--t-highlight)]" aria-hidden="true" />Pagá con Mercado Pago o transferencia</li>
          </ul>
        </div>
      </div>

      <!-- Formulario -->
      <div class="px-1 py-6 sm:px-10 sm:py-12">
        <h1 class="text-[28px] font-bold leading-tight">{{ title }}</h1>
        <p v-if="subtitle" class="mt-1.5 text-[var(--t-muted)]">{{ subtitle }}</p>
        <div class="mt-7">
          <slot />
        </div>
      </div>
    </div>
  </AppLayout>
</template>
