import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  createOrder,
  createRetailOrder,
  addItemCurva,
  addItemCantidad,
  fetchOrders,
  fetchOrder,
  type Order,
  type PurchaseType,
} from '@/api/orders.api'

export const useOrdersStore = defineStore('orders', () => {
  const orders = ref<Order[]>([])
  const currentOrder = ref<Order | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function startWholesaleOrder(purchaseType: PurchaseType): Promise<Order> {
    loading.value = true
    error.value = null
    try {
      const order = await createOrder(purchaseType)
      currentOrder.value = order
      return order
    } finally {
      loading.value = false
    }
  }

  async function addItem(
    orderId: number,
    dto: { productId: number; curves?: number; quantity?: number },
  ) {
    loading.value = true
    error.value = null
    try {
      if (dto.curves != null) {
        return await addItemCurva(orderId, dto.productId, dto.curves)
      } else if (dto.quantity != null) {
        return await addItemCantidad(orderId, dto.productId, dto.quantity)
      }
      throw new Error('Debe especificar curves o quantity')
    } finally {
      loading.value = false
    }
  }

  async function loadOrders() {
    loading.value = true
    error.value = null
    try {
      const { orders: list, total } = await fetchOrders()
      orders.value = list
      return total
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } }
      error.value = e.response?.data?.detail ?? 'Error al cargar pedidos'
    } finally {
      loading.value = false
    }
  }

  async function loadOrder(orderId: number) {
    loading.value = true
    error.value = null
    try {
      currentOrder.value = await fetchOrder(orderId)
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } }
      error.value = e.response?.data?.detail ?? 'Error al cargar pedido'
    } finally {
      loading.value = false
    }
  }

  async function placeRetailOrder(items: { variantId: number; quantity: number }[]): Promise<Order> {
    loading.value = true
    error.value = null
    try {
      const order = await createRetailOrder(items)
      currentOrder.value = order
      return order
    } finally {
      loading.value = false
    }
  }

  return {
    orders,
    currentOrder,
    loading,
    error,
    startWholesaleOrder,
    placeRetailOrder,
    addItem,
    loadOrders,
    loadOrder,
  }
})
