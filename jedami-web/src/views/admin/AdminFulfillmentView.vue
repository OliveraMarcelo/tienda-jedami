<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'
import {
  fetchPendingFulfillment,
  fulfillItem,
  dispatchOrder,
  decrementItemStock,
  type PendingOrder,
  type PendingItem,
} from '@/api/admin.fulfillment.api'

const router = useRouter()

const loading = ref(true)
const error = ref('')
const orders = ref<PendingOrder[]>([])

// Estado local por ítem / pedido
const selections      = ref<Record<number, number | null>>({})   // itemId → variantId
const assigning       = ref<number | null>(null)                  // itemId
const assigned        = ref<Set<number>>(new Set())               // itemIds con variante guardada
const assignErrors    = ref<Record<number, string>>({})

const dispatching     = ref<number | null>(null)                  // orderId
const dispatched      = ref<Set<number>>(new Set())               // orderIds despachados
const dispatchErrors  = ref<Record<number, string>>({})

const decrementing    = ref<number | null>(null)                  // itemId
const stockUpdated    = ref<Set<number>>(new Set())               // itemIds con stock actualizado
const decrementErrors = ref<Record<number, string>>({})

async function load() {
  loading.value = true
  error.value = ''
  try {
    orders.value = await fetchPendingFulfillment()
    for (const order of orders.value) {
      for (const item of order.items) {
        if (!(item.id in selections.value)) {
          selections.value[item.id] = null
        }
      }
    }
  } catch {
    error.value = 'Error al cargar los pedidos pendientes.'
  } finally {
    loading.value = false
  }
}

async function doAssignVariant(order: PendingOrder, item: PendingItem) {
  const variantId = selections.value[item.id]
  if (!variantId) return
  assigning.value = item.id
  assignErrors.value[item.id] = ''
  try {
    await fulfillItem(order.id, item.id, variantId, false)
    assigned.value.add(item.id)
  } catch (e: any) {
    assignErrors.value[item.id] = e?.response?.data?.detail ?? 'Error al asignar color'
  } finally {
    assigning.value = null
  }
}

async function doDispatch(order: PendingOrder) {
  dispatching.value = order.id
  dispatchErrors.value[order.id] = ''
  try {
    await dispatchOrder(order.id)
    dispatched.value.add(order.id)
  } catch (e: any) {
    dispatchErrors.value[order.id] = e?.response?.data?.detail ?? 'Error al despachar'
  } finally {
    dispatching.value = null
  }
}

async function doDecrementStock(order: PendingOrder, item: PendingItem) {
  decrementing.value = item.id
  decrementErrors.value[item.id] = ''
  try {
    await decrementItemStock(order.id, item.id)
    stockUpdated.value.add(item.id)
  } catch (e: any) {
    decrementErrors.value[item.id] = e?.response?.data?.detail ?? 'Error al actualizar stock'
  } finally {
    decrementing.value = null
  }
}

function itemHasVariant(item: PendingItem): boolean {
  return item.variantAssigned || assigned.value.has(item.id)
}

function resolvedVariantId(item: PendingItem): number | null {
  return item.variantAssigned ? item.assignedVariantId : (selections.value[item.id] ?? null)
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

onMounted(load)
</script>

<template>
  <AppLayout>
    <div class="max-w-4xl mx-auto">
      <!-- Breadcrumb -->
      <div class="flex items-center gap-3 mb-6">
        <button @click="router.push('/admin')" class="text-sm text-gray-500 hover:text-[#E91E8C]">← Admin</button>
        <h1 class="text-2xl font-bold text-gray-900">Gestión de despacho</h1>
      </div>

      <p class="text-sm text-gray-500 mb-6">
        Pedidos pagados pendientes de despacho. Asigná colores para pedidos curva/cantidad,
        marcá como despachado y actualizá el stock cuando tengas tiempo.
      </p>

      <!-- Skeleton -->
      <div v-if="loading" class="space-y-4">
        <div v-for="i in 3" :key="i" class="animate-pulse bg-white rounded-2xl border border-gray-200 h-32"></div>
      </div>

      <p v-else-if="error" class="text-red-500 text-sm">{{ error }}</p>

      <p v-else-if="orders.length === 0" class="text-center text-gray-400 text-sm py-12">
        No hay pedidos pendientes de despacho.
      </p>

      <div v-else class="space-y-6">
        <div
          v-for="order in orders"
          :key="order.id"
          class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
          :class="dispatched.has(order.id) ? 'opacity-60' : ''"
        >
          <!-- Cabecera del pedido -->
          <div class="flex items-start justify-between px-5 py-4 border-b border-gray-100 bg-gray-50 gap-3">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap mb-1">
                <p class="font-bold text-gray-900">Pedido #{{ order.id }}</p>
                <!-- Badge tipo de pedido -->
                <span
                  class="text-xs font-semibold px-2 py-0.5 rounded-full"
                  :class="{
                    'bg-purple-100 text-purple-700': order.purchaseType === 'curva',
                    'bg-blue-100 text-blue-700':    order.purchaseType === 'cantidad',
                    'bg-gray-100 text-gray-600':    order.purchaseType === 'menor',
                  }"
                >
                  {{ order.purchaseType === 'curva' ? 'Curva' : order.purchaseType === 'cantidad' ? 'Cantidad' : 'Menor' }}
                </span>
              </div>
              <p class="text-xs text-gray-500">{{ order.customerEmail }} — {{ formatDate(order.createdAt) }}</p>
              <p v-if="order.notes" class="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 mt-1.5 italic">
                Nota: "{{ order.notes }}"
              </p>
            </div>
            <div class="text-right shrink-0">
              <p class="font-semibold text-gray-800">{{ formatCurrency(order.totalAmount) }}</p>
              <!-- Botón despachar -->
              <div class="mt-2">
                <button
                  v-if="!dispatched.has(order.id)"
                  @click="doDispatch(order)"
                  :disabled="dispatching === order.id"
                  class="h-8 px-3 rounded-lg bg-gray-800 text-white text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:pointer-events-none"
                >
                  {{ dispatching === order.id ? 'Despachando…' : 'Marcar despachado' }}
                </button>
                <span v-else class="text-xs text-green-600 font-semibold">✓ Despachado</span>
                <p v-if="dispatchErrors[order.id]" class="text-xs text-red-500 mt-0.5">{{ dispatchErrors[order.id] }}</p>
              </div>
            </div>
          </div>

          <!-- Ítems -->
          <div class="divide-y divide-gray-50">
            <div v-for="item in order.items" :key="item.id" class="px-5 py-4">
              <!-- Info del ítem -->
              <div class="flex items-start justify-between gap-3 mb-3">
                <div>
                  <p class="font-medium text-gray-900 text-sm">{{ item.productName }}</p>
                  <p class="text-xs text-gray-500 mt-0.5">
                    Talle <strong>{{ item.size }}</strong> —
                    Cant. {{ item.quantity }} —
                    {{ formatCurrency(item.unitPrice) }} c/u
                  </p>
                </div>

                <!-- Acciones del ítem -->
                <div class="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                  <!-- Guardar color (solo curva/cantidad sin variante aún) -->
                  <template v-if="!item.variantAssigned && !assigned.has(item.id)">
                    <button
                      v-if="selections[item.id]"
                      @click="doAssignVariant(order, item)"
                      :disabled="assigning === item.id"
                      class="h-8 px-3 rounded-lg bg-[#E91E8C] text-white text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:pointer-events-none"
                    >
                      {{ assigning === item.id ? 'Guardando…' : 'Guardar color' }}
                    </button>
                  </template>

                  <!-- Descontar stock (si ya tiene variante asignada y no se actualizó aún) -->
                  <template v-if="itemHasVariant(item)">
                    <button
                      v-if="!stockUpdated.has(item.id)"
                      @click="doDecrementStock(order, item)"
                      :disabled="decrementing === item.id"
                      class="h-8 px-3 rounded-lg border border-gray-300 text-xs text-gray-600 hover:border-gray-400 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                    >
                      {{ decrementing === item.id ? 'Actualizando…' : 'Descontar stock' }}
                    </button>
                    <span v-else class="text-xs text-green-600 font-semibold">✓ Stock actualizado</span>
                  </template>
                </div>
              </div>

              <!-- Error de asignación -->
              <p v-if="assignErrors[item.id]" class="text-xs text-red-500 mb-2">{{ assignErrors[item.id] }}</p>
              <p v-if="decrementErrors[item.id]" class="text-xs text-red-500 mb-2">{{ decrementErrors[item.id] }}</p>

              <!-- Variante ya asignada (menor o guardada) -->
              <div
                v-if="item.variantAssigned || assigned.has(item.id)"
                class="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2"
              >
                <span
                  class="w-4 h-4 rounded-full border border-gray-200 shrink-0"
                  :style="{ backgroundColor: item.variantAssigned ? (item.assignedHex ?? '#ccc') : (item.availableVariants.find(v => v.id === selections[item.id])?.hexCode ?? '#ccc') }"
                ></span>
                <span class="font-medium">
                  {{ item.variantAssigned ? item.assignedColor : item.availableVariants.find(v => v.id === selections[item.id])?.color }}
                </span>
                <span v-if="item.variantAssigned" class="text-xs text-gray-400">(asignado en la compra)</span>
                <span v-else class="text-xs text-green-600">✓ Color guardado</span>
              </div>

              <!-- Tabla de stock (curva/cantidad sin variante) -->
              <div v-else-if="!item.variantAssigned">
                <div v-if="item.availableVariants.length === 0" class="text-xs text-red-500 font-medium">
                  Sin stock disponible para este talle
                </div>
                <table v-else class="w-full text-xs mt-1">
                  <thead>
                    <tr class="text-gray-400 border-b border-gray-100">
                      <th class="text-left pb-1.5 font-medium">Color</th>
                      <th class="text-right pb-1.5 font-medium">Stock</th>
                      <th class="pb-1.5 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="v in item.availableVariants"
                      :key="v.id"
                      class="border-b border-gray-50 last:border-0"
                      :class="v.stock === 0 ? 'opacity-40' : ''"
                    >
                      <td class="py-1.5">
                        <div class="flex items-center gap-2">
                          <span
                            class="w-4 h-4 rounded-full border border-gray-200 shrink-0"
                            :style="{ backgroundColor: v.hexCode ?? '#ccc' }"
                          ></span>
                          <span class="text-gray-800">{{ v.color }}</span>
                        </div>
                      </td>
                      <td class="py-1.5 text-right text-gray-500">{{ v.stock }}</td>
                      <td class="py-1.5 pl-3">
                        <input
                          type="radio"
                          :value="v.id"
                          v-model="selections[item.id]"
                          :disabled="v.stock === 0"
                          class="accent-[#E91E8C] cursor-pointer"
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </AppLayout>
</template>
