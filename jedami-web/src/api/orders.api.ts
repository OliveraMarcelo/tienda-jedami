import apiClient from './client'

export type OrderStatus = 'pending' | 'paid' | 'rejected'
export type PurchaseType = 'curva' | 'cantidad' | 'retail'

export interface OrderItem {
  id: number
  variantId: number | null
  productId: number | null
  size: string | null
  color: string | null
  quantity: number
  unitPrice: number
}

export interface Order {
  id: number
  customerId?: number
  purchaseType: PurchaseType
  status: OrderStatus
  totalAmount: number
  createdAt: string
  items?: OrderItem[]
}

export async function createOrder(purchaseType: PurchaseType): Promise<Order> {
  const res = await apiClient.post<{ data: Order }>('/orders', { purchaseType })
  return res.data.data
}

export async function createRetailOrder(
  items: { variantId: number; quantity: number }[],
): Promise<Order> {
  const res = await apiClient.post<{ data: Order }>('/orders', { items })
  return res.data.data
}

export async function addItemCurva(orderId: number, productId: number, curves: number) {
  const res = await apiClient.post<{ data: { orderId: number; items: OrderItem[]; totalAmount: number } }>(
    `/orders/${orderId}/items`,
    { productId, curves },
  )
  return res.data.data
}

export async function addItemCantidad(orderId: number, productId: number, quantity: number) {
  const res = await apiClient.post<{ data: { orderId: number; items: OrderItem[]; totalAmount: number } }>(
    `/orders/${orderId}/items`,
    { productId, quantity },
  )
  return res.data.data
}

export async function fetchOrders(): Promise<{ orders: Order[]; total: number }> {
  const res = await apiClient.get<{ data: Order[]; meta: { total: number } }>('/orders')
  return { orders: res.data.data, total: res.data.meta.total }
}

export async function fetchOrder(orderId: number): Promise<Order> {
  const res = await apiClient.get<{ data: Order }>(`/orders/${orderId}`)
  return res.data.data
}
