<script setup lang="ts">
import { onMounted, computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'
import { useOrdersStore } from '@/stores/orders.store'
import { useConfigStore } from '@/stores/config.store'
import { cancelOrder, updateOrderNotes } from '@/api/orders.api'
import { ORDER_STATUS } from '@/lib/order-status'

const ordersStore = useOrdersStore()
const configStore = useConfigStore()

onMounted(() => {
  ordersStore.loadOrders()
})

const hasOrders = computed(() => ordersStore.orders.length > 0)

const formatPrice = (n: number) => `$${n.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`
const formatDate = (d: string) => new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })

// Se puede pagar si está pendiente o si un intento anterior fue rechazado
const canPay = (o: { status: string; totalAmount: number }) => ['pending', 'rejected'].includes(o.status) && o.totalAmount > 0

// ─── Notas ────────────────────────────────────────────────────────────────────
const editingNotes = ref<number | null>(null)
const notesText = ref('')
const savingNotes = ref(false)

function openNotesEdit(order: { id: number; notes: string | null }) {
  editingNotes.value = order.id
  notesText.value = order.notes ?? ''
}

async function saveNotes(order: { id: number; notes: string | null }) {
  savingNotes.value = true
  try {
    await updateOrderNotes(order.id, notesText.value.trim() || null)
    order.notes = notesText.value.trim() || null
    editingNotes.value = null
  } finally {
    savingNotes.value = false
  }
}

// ─── Cancelación ──────────────────────────────────────────────────────────────
const confirmingCancel = ref<number | null>(null)
const cancelError = ref('')

async function doCancel(orderId: number) {
  cancelError.value = ''
  try {
    await cancelOrder(orderId)
    const order = ordersStore.orders.find(o => o.id === orderId)
    if (order) order.status = 'cancelled'
    confirmingCancel.value = null
  } catch (e: unknown) {
    const err = e as { response?: { data?: { detail?: string } } }
    cancelError.value = err.response?.data?.detail ?? 'No pudimos cancelar el pedido'
  }
}
</script>

<template>
  <AppLayout>
    <div class="mx-auto max-w-3xl">
      <h1 class="mb-6 text-[28px] font-bold sm:text-[32px]">Mis pedidos</h1>

      <!-- Cargando -->
      <div v-if="ordersStore.loading" class="flex flex-col gap-3">
        <div v-for="i in 3" :key="i" class="h-28 animate-pulse rounded-[var(--t-radius-card)] bg-[var(--t-surface)]"></div>
      </div>

      <!-- Error -->
      <div v-else-if="ordersStore.error" role="alert" class="flex items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
        <span>{{ ordersStore.error }}</span>
        <button type="button" class="font-semibold underline" @click="ordersStore.loadOrders()">Reintentar</button>
      </div>

      <!-- Vacío -->
      <div v-else-if="!hasOrders" class="rounded-[var(--t-radius-lg)] bg-[var(--t-surface)] px-6 py-16 text-center">
        <svg class="mx-auto mb-4 h-12 w-12 text-[var(--t-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M5 8h14l-1 12H6L5 8zM9 8V6a3 3 0 0 1 6 0v2" /></svg>
        <p class="mb-1 text-lg font-semibold">Todavía no tenés pedidos</p>
        <p class="mb-6 text-[var(--t-muted)]">Elegí lo que más te guste del catálogo.</p>
        <RouterLink to="/catalogo" class="inline-flex min-h-12 items-center rounded-full bg-[var(--t-ink)] px-8 font-semibold text-white hover:opacity-90">
          Ver catálogo
        </RouterLink>
      </div>

      <!-- Lista -->
      <ul v-else class="flex flex-col gap-4">
        <li
          v-for="order in ordersStore.orders"
          :key="order.id"
          class="rounded-[var(--t-radius-card)] border border-[var(--t-border)] bg-white p-5 sm:p-6"
        >
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div class="flex flex-wrap items-center gap-2.5">
                <RouterLink :to="`/pedidos/${order.id}`" class="text-lg font-bold hover:underline">Pedido #{{ order.id }}</RouterLink>
                <span :class="['rounded-full px-3 py-1 text-xs font-semibold', ORDER_STATUS[order.status].classes]">
                  {{ ORDER_STATUS[order.status].label }}
                </span>
              </div>
              <p class="mt-1 text-sm text-[var(--t-muted)]">
                {{ configStore.purchaseTypeLabel[order.purchaseType] ?? order.purchaseType }} · {{ formatDate(order.createdAt) }}
              </p>
            </div>
            <p class="text-xl font-bold">{{ formatPrice(order.totalAmount) }}</p>
          </div>

          <!-- Acciones -->
          <div class="mt-4 flex flex-wrap items-center gap-3">
            <RouterLink
              v-if="canPay(order)"
              :to="`/pedidos/${order.id}`"
              class="inline-flex min-h-11 items-center rounded-full bg-[var(--t-ink)] px-6 text-sm font-semibold text-white hover:opacity-90"
            >
              {{ order.status === 'rejected' ? 'Reintentar pago' : 'Pagar' }}
            </RouterLink>
            <RouterLink
              :to="`/pedidos/${order.id}`"
              class="inline-flex min-h-11 items-center rounded-full border-[1.5px] border-[var(--t-ink)] px-6 text-sm font-semibold hover:bg-[var(--t-ink)] hover:text-white transition-colors"
            >
              Ver detalle
            </RouterLink>
          </div>

          <!-- Nota para la tienda -->
          <div class="mt-4 border-t border-[var(--t-border)] pt-4">
            <template v-if="editingNotes !== order.id">
              <div class="flex items-start justify-between gap-3 text-sm">
                <p v-if="order.notes" class="italic text-[var(--t-muted)]">"{{ order.notes }}"</p>
                <p v-else class="text-[var(--t-muted)]">Sin notas para la tienda</p>
                <button
                  v-if="order.status === 'pending'"
                  type="button"
                  class="shrink-0 font-semibold underline underline-offset-4"
                  @click="openNotesEdit(order)"
                >{{ order.notes ? 'Editar nota' : 'Agregar nota' }}</button>
              </div>
            </template>
            <template v-else>
              <label :for="`notes-${order.id}`" class="mb-1.5 block text-sm font-semibold">Nota para la tienda</label>
              <textarea
                :id="`notes-${order.id}`"
                v-model="notesText"
                maxlength="500"
                rows="2"
                placeholder="Ej: entregar a la tarde, necesito factura A…"
                class="w-full resize-none rounded-2xl border border-[var(--t-border)] px-4 py-3 text-sm outline-none focus:border-[var(--t-ink)]"
              ></textarea>
              <div class="mt-2 flex items-center justify-between">
                <span class="text-xs text-[var(--t-muted)]">{{ notesText.length }}/500</span>
                <div class="flex items-center gap-3">
                  <button type="button" class="text-sm text-[var(--t-muted)] hover:text-[var(--t-ink)]" @click="editingNotes = null">Cancelar</button>
                  <button
                    type="button"
                    :disabled="savingNotes"
                    class="min-h-10 rounded-full bg-[var(--t-ink)] px-5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                    @click="saveNotes(order)"
                  >{{ savingNotes ? 'Guardando…' : 'Guardar' }}</button>
                </div>
              </div>
            </template>
          </div>

          <!-- Cancelar pedido -->
          <div v-if="order.status === 'pending'" class="mt-3 text-sm">
            <button
              v-if="confirmingCancel !== order.id"
              type="button"
              class="text-[var(--t-muted)] underline underline-offset-4 hover:text-red-700"
              @click="confirmingCancel = order.id; cancelError = ''"
            >Cancelar pedido</button>
            <div v-else class="rounded-2xl bg-[var(--t-surface)] px-4 py-3">
              <p class="mb-2">¿Cancelar el pedido #{{ order.id }}? No se puede deshacer.</p>
              <div class="flex items-center gap-4">
                <button type="button" class="font-semibold text-red-700 underline underline-offset-4" @click="doCancel(order.id)">Sí, cancelar</button>
                <button type="button" class="text-[var(--t-muted)] hover:text-[var(--t-ink)]" @click="confirmingCancel = null">No, volver</button>
              </div>
              <p v-if="cancelError" role="alert" class="mt-2 text-red-700">{{ cancelError }}</p>
            </div>
          </div>
        </li>
      </ul>
    </div>
  </AppLayout>
</template>
