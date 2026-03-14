<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'
import { useOrdersStore } from '@/stores/orders.store'
import { usePaymentsStore } from '@/stores/payments.store'
import type { OrderStatus, PurchaseType } from '@/api/orders.api'

const route = useRoute()
const router = useRouter()
const ordersStore = useOrdersStore()
const paymentsStore = usePaymentsStore()

onMounted(() => {
  ordersStore.loadOrder(Number(route.params.orderId))
})

const order = computed(() => ordersStore.currentOrder)

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
</script>

<template>
  <AppLayout>
    <div class="max-w-2xl mx-auto">
      <!-- Loading -->
      <div v-if="ordersStore.loading" class="animate-pulse space-y-4">
        <div class="h-8 bg-gray-200 rounded w-48"></div>
        <div class="bg-white rounded-2xl border border-gray-200 p-6 h-40"></div>
      </div>

      <!-- Error -->
      <div v-else-if="ordersStore.error" class="text-red-500 text-sm">{{ ordersStore.error }}</div>

      <div v-else-if="order">
        <!-- Header del pedido -->
        <div class="flex items-center gap-3 mb-6">
          <button @click="router.push('/pedidos')" class="text-sm text-gray-500 hover:text-[#E91E8C]">
            ← Mis pedidos
          </button>
        </div>

        <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-4">
          <div class="flex items-start justify-between gap-4">
            <div>
              <h1 class="text-xl font-bold text-gray-900 mb-1">Pedido #{{ order.id }}</h1>
              <p class="text-sm text-gray-500">
                {{ purchaseTypeLabel[order.purchaseType] }} ·
                {{ new Date(order.createdAt).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' }) }}
              </p>
            </div>
            <span
              class="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold border shrink-0"
              :class="statusConfig[order.status].classes"
            >
              {{ statusConfig[order.status].label }}
            </span>
          </div>
        </div>

        <!-- Items del pedido -->
        <div class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-4">
          <div class="px-5 py-3 bg-gray-50 border-b border-gray-100">
            <p class="text-sm font-semibold text-gray-600">Artículos</p>
          </div>
          <table class="w-full text-sm">
            <thead>
              <tr class="text-gray-500 text-xs border-b border-gray-100">
                <th class="px-5 py-2 text-left font-medium">Variante</th>
                <th class="px-5 py-2 text-right font-medium">Cant.</th>
                <th class="px-5 py-2 text-right font-medium">Precio unit.</th>
                <th class="px-5 py-2 text-right font-medium">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="item in order.items"
                :key="item.id"
                class="border-t border-gray-50"
              >
                <td class="px-5 py-3 text-gray-800 font-medium">
                  <span v-if="item.size && item.color">{{ item.size }} — {{ item.color }}</span>
                  <span v-else class="text-gray-500 italic">Distribución proporcional</span>
                </td>
                <td class="px-5 py-3 text-right text-gray-700">{{ item.quantity }}</td>
                <td class="px-5 py-3 text-right text-gray-700">${{ Number(item.unitPrice).toLocaleString('es-AR') }}</td>
                <td class="px-5 py-3 text-right font-semibold text-gray-900">
                  ${{ (item.quantity * Number(item.unitPrice)).toLocaleString('es-AR') }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Total y CTA -->
        <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex items-center justify-between gap-4">
          <div>
            <p class="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-0.5">Total del pedido</p>
            <p class="text-2xl font-bold text-gray-900">${{ order.totalAmount.toLocaleString('es-AR') }}</p>
          </div>
          <button
            v-if="order.status === 'pending' && order.totalAmount > 0"
            :disabled="paymentsStore.loading"
            @click="paymentsStore.startCheckout(order.id)"
            class="inline-flex items-center gap-2 rounded-xl bg-[#009EE3] text-white px-5 py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity shadow disabled:opacity-50 disabled:pointer-events-none"
          >
            <svg v-if="paymentsStore.loading" class="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            <span v-if="paymentsStore.loading">Redirigiendo…</span>
            <span v-else>Pagar con Mercado Pago</span>
          </button>
        </div>

        <!-- Error de pago -->
        <p v-if="paymentsStore.error" class="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          {{ paymentsStore.error }}
        </p>
      </div>
    </div>
  </AppLayout>
</template>
