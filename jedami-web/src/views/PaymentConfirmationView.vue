<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'
import { useOrdersStore } from '@/stores/orders.store'
import { getPaymentStatus } from '@/api/payments.api'

const route = useRoute()
const ordersStore = useOrdersStore()

const orderId = Number(route.params.orderId)
const mpStatus = computed(() => (route.query.status as string) ?? 'pending')

onMounted(async () => {
  // Sincronizar con Mercado Pago antes de mostrar: si el webhook todavía no llegó,
  // el pedido pasa a pagado igual
  try {
    await getPaymentStatus(orderId)
  } catch {
    // Si falla, se muestra el estado que devolvió Mercado Pago en la URL
  }
  await ordersStore.loadOrder(orderId)
})

const displayStatus = computed(() => {
  if (ordersStore.currentOrder?.status === 'paid') return 'approved'
  if (ordersStore.currentOrder?.status === 'rejected') return 'rejected'
  return mpStatus.value
})

const formatPrice = (n: number) => `$${n.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`
</script>

<template>
  <AppLayout>
    <div class="mx-auto max-w-lg py-10 text-center" aria-live="polite">
      <!-- Aprobado -->
      <template v-if="displayStatus === 'approved'">
        <span class="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#E6F2EC] text-[var(--t-price)]" aria-hidden="true">
          <svg class="h-10 w-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
        </span>
        <h1 class="mb-2 text-[28px] font-bold">¡Pago confirmado!</h1>
        <p class="text-[var(--t-muted)]">Tu pedido <strong class="text-[var(--t-ink)]">#{{ orderId }}</strong> ya está pagado. Te vamos a escribir para coordinar el envío.</p>
        <p v-if="ordersStore.currentOrder" class="mt-3 text-2xl font-bold text-[var(--t-price)]">
          {{ formatPrice(ordersStore.currentOrder.totalAmount) }}
        </p>
        <div class="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <RouterLink to="/catalogo" class="inline-flex min-h-12 items-center justify-center rounded-full bg-[var(--t-ink)] px-8 font-semibold text-white hover:opacity-90">
            Seguir comprando
          </RouterLink>
          <RouterLink :to="`/pedidos/${orderId}`" class="inline-flex min-h-12 items-center justify-center rounded-full border-[1.5px] border-[var(--t-ink)] px-8 font-semibold hover:bg-[var(--t-ink)] hover:text-white transition-colors">
            Ver pedido
          </RouterLink>
        </div>
      </template>

      <!-- Rechazado -->
      <template v-else-if="displayStatus === 'rejected'">
        <span class="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#FDE8E6] text-[#A3271A]" aria-hidden="true">
          <svg class="h-10 w-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M7 7l10 10M17 7L7 17" /></svg>
        </span>
        <h1 class="mb-2 text-[28px] font-bold">El pago no se pudo hacer</h1>
        <p class="text-[var(--t-muted)]">Podés intentar de nuevo con otro medio: Mercado Pago o transferencia.</p>
        <div class="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <RouterLink :to="`/pedidos/${orderId}`" class="inline-flex min-h-12 items-center justify-center rounded-full bg-[var(--t-ink)] px-8 font-semibold text-white hover:opacity-90">
            Intentar de nuevo
          </RouterLink>
          <RouterLink to="/pedidos" class="inline-flex min-h-12 items-center justify-center rounded-full border-[1.5px] border-[var(--t-ink)] px-8 font-semibold hover:bg-[var(--t-ink)] hover:text-white transition-colors">
            Mis pedidos
          </RouterLink>
        </div>
      </template>

      <!-- Pendiente -->
      <template v-else>
        <span class="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#FDF3D7] text-[#8A5A00]" aria-hidden="true">
          <svg class="h-10 w-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>
        </span>
        <h1 class="mb-2 text-[28px] font-bold">Estamos esperando la confirmación</h1>
        <p class="text-[var(--t-muted)]">Mercado Pago todavía está procesando el pago. Apenas se acredite, el pedido se marca como pagado.</p>
        <div class="mt-8">
          <RouterLink :to="`/pedidos/${orderId}`" class="inline-flex min-h-12 items-center justify-center rounded-full bg-[var(--t-ink)] px-8 font-semibold text-white hover:opacity-90">
            Ver pedido
          </RouterLink>
        </div>
      </template>
    </div>
  </AppLayout>
</template>
