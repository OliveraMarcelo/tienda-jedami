<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'
import { useOrdersStore } from '@/stores/orders.store'
import { usePaymentsStore } from '@/stores/payments.store'
import type { OrderStatus, PurchaseType } from '@/api/orders.api'

const router = useRouter()
const ordersStore = useOrdersStore()
const paymentsStore = usePaymentsStore()

onMounted(() => {
  ordersStore.loadOrders()
})

const statusConfig: Record<OrderStatus, { label: string; classes: string }> = {
  pending:  { label: 'Pendiente de pago', classes: 'bg-amber-50 text-amber-700 border-amber-200' },
  paid:     { label: 'Pagado',            classes: 'bg-green-50 text-green-700 border-green-200' },
  rejected: { label: 'Rechazado',         classes: 'bg-red-50 text-red-700 border-red-200' },
}

const purchaseTypeLabel: Record<PurchaseType, string> = {
  curva: 'Por curva',
  cantidad: 'Por cantidad',
  retail: 'Compra minorista',
}

const hasOrders = computed(() => ordersStore.orders.length > 0)
</script>

<template>
  <AppLayout>
    <div class="max-w-2xl mx-auto">
      <h1 class="text-2xl font-bold text-gray-900 mb-6">Mis pedidos</h1>

      <!-- Loading -->
      <div v-if="ordersStore.loading" class="space-y-3">
        <div v-for="i in 3" :key="i" class="animate-pulse bg-white rounded-2xl border border-gray-200 p-4 h-20"></div>
      </div>

      <!-- Error -->
      <div v-else-if="ordersStore.error" class="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center justify-between">
        <span>{{ ordersStore.error }}</span>
        <button @click="ordersStore.loadOrders()" class="text-red-600 font-semibold hover:underline">Reintentar</button>
      </div>

      <!-- Estado vacío -->
      <div v-else-if="!hasOrders" class="text-center py-16">
        <div class="text-5xl mb-4">📦</div>
        <p class="text-gray-600 font-medium mb-2">Todavía no tenés pedidos</p>
        <p class="text-sm text-gray-400 mb-6">Explorá el catálogo y hacé tu primer pedido.</p>
        <button
          @click="router.push('/catalogo')"
          class="inline-flex items-center gap-2 rounded-xl bg-[#E91E8C] text-white px-5 py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          Ver catálogo
        </button>
      </div>

      <!-- Lista de pedidos -->
      <div v-else class="space-y-3">
        <div
          v-for="order in ordersStore.orders"
          :key="order.id"
          class="bg-white rounded-2xl border border-gray-200 shadow-sm p-4"
        >
          <div
            class="flex items-start justify-between gap-3 cursor-pointer"
            @click="router.push('/pedidos/' + order.id)"
          >
            <div>
              <div class="flex items-center gap-2 mb-1">
                <span class="font-semibold text-gray-800">#{{ order.id }}</span>
                <span
                  class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold border"
                  :class="statusConfig[order.status].classes"
                >
                  {{ statusConfig[order.status].label }}
                </span>
              </div>
              <p class="text-sm text-gray-500">
                {{ purchaseTypeLabel[order.purchaseType] }} ·
                {{ new Date(order.createdAt).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }) }}
              </p>
            </div>
            <div class="text-right shrink-0">
              <p class="text-lg font-bold text-gray-900">${{ order.totalAmount.toLocaleString('es-AR') }}</p>
              <p class="text-xs text-gray-400">total</p>
            </div>
          </div>

          <!-- CTA de pago para pedidos pendientes -->
          <div
            v-if="order.status === 'pending' && order.totalAmount > 0"
            class="mt-3 pt-3 border-t border-gray-100 flex justify-end"
          >
            <button
              :disabled="paymentsStore.processingOrderId === order.id"
              @click.stop="paymentsStore.startCheckout(order.id)"
              class="inline-flex items-center gap-2 rounded-xl bg-[#009EE3] text-white px-4 py-2 text-sm font-semibold hover:opacity-90 transition-opacity shadow disabled:opacity-50"
            >
              <svg v-if="paymentsStore.processingOrderId === order.id" class="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              {{ paymentsStore.processingOrderId === order.id ? 'Redirigiendo…' : 'Pagar con Mercado Pago' }}
            </button>
          </div>
        </div>
        <p v-if="paymentsStore.error" class="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          {{ paymentsStore.error }}
        </p>
      </div>
    </div>
  </AppLayout>
</template>
