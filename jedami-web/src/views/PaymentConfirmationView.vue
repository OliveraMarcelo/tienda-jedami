<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'
import { useOrdersStore } from '@/stores/orders.store'
import { usePaymentsStore } from '@/stores/payments.store'

const route = useRoute()
const router = useRouter()
const ordersStore = useOrdersStore()
const paymentsStore = usePaymentsStore()

const orderId = Number(route.params.orderId)
const mpStatus = computed(() => (route.query.status as string) ?? 'pending')

onMounted(async () => {
  await ordersStore.loadOrder(orderId)
})

// Si el webhook ya procesó el pago, usar el estado real del pedido
const displayStatus = computed(() => {
  if (ordersStore.currentOrder?.status === 'paid') return 'approved'
  if (ordersStore.currentOrder?.status === 'rejected') return 'rejected'
  return mpStatus.value
})

async function retryPayment() {
  await paymentsStore.startCheckout(orderId)
}
</script>

<template>
  <AppLayout>
    <div class="max-w-lg mx-auto text-center py-12">

      <!-- Aprobado -->
      <template v-if="displayStatus === 'approved'">
        <div class="text-6xl mb-4">✅</div>
        <h1 class="text-2xl font-bold text-gray-900 mb-2">¡Pago confirmado!</h1>
        <p class="text-gray-500 mb-2">Tu pedido <strong>#{{ orderId }}</strong> fue pagado exitosamente.</p>
        <p v-if="ordersStore.currentOrder" class="text-xl font-bold text-green-700 mb-8">
          ${{ ordersStore.currentOrder.totalAmount.toLocaleString('es-AR', { maximumFractionDigits: 0 }) }}
        </p>
        <button
          @click="router.push('/catalogo')"
          class="inline-flex items-center gap-2 rounded-xl bg-[#E91E8C] text-white px-6 py-3 font-semibold hover:opacity-90 transition-opacity shadow"
        >
          Seguir comprando
        </button>
      </template>

      <!-- Rechazado -->
      <template v-else-if="displayStatus === 'rejected'">
        <div class="text-6xl mb-4">❌</div>
        <h1 class="text-2xl font-bold text-gray-900 mb-2">Pago rechazado</h1>
        <p class="text-gray-500 mb-8">No pudimos procesar tu pago. Podés reintentar o revisar tus pedidos.</p>
        <div class="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            :disabled="paymentsStore.loading"
            @click="retryPayment"
            class="inline-flex items-center justify-center gap-2 rounded-xl bg-[#009EE3] text-white px-6 py-3 font-semibold hover:opacity-90 transition-opacity shadow disabled:opacity-50"
          >
            <svg v-if="paymentsStore.loading" class="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            Reintentar pago
          </button>
          <button
            @click="router.push('/pedidos')"
            class="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white text-gray-700 px-6 py-3 font-semibold hover:border-gray-400 transition-colors"
          >
            Ver mis pedidos
          </button>
        </div>
        <p v-if="paymentsStore.error" class="mt-4 text-sm text-red-600">{{ paymentsStore.error }}</p>
      </template>

      <!-- Pendiente -->
      <template v-else>
        <div class="text-6xl mb-4">⏳</div>
        <h1 class="text-2xl font-bold text-gray-900 mb-2">Pago en proceso</h1>
        <p class="text-gray-500 mb-8">
          Tu pago está siendo procesado. Te notificaremos cuando se confirme.<br>
          Podés revisar el estado en tus pedidos.
        </p>
        <button
          @click="router.push('/pedidos/' + orderId)"
          class="inline-flex items-center gap-2 rounded-xl bg-[#E91E8C] text-white px-6 py-3 font-semibold hover:opacity-90 transition-opacity shadow"
        >
          Ver pedido
        </button>
      </template>

    </div>
  </AppLayout>
</template>
