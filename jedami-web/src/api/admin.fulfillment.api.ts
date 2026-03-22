import api from './client'

export interface AvailableVariant {
  id: number
  color: string
  hexCode: string | null
  stock: number
}

export interface PendingItem {
  id: number
  sizeId: number
  size: string
  quantity: number
  unitPrice: number
  productId: number
  productName: string
  variantAssigned: boolean
  assignedVariantId: number | null
  assignedColor: string | null
  assignedHex: string | null
  availableVariants: AvailableVariant[]
}

export interface PendingOrder {
  id: number
  createdAt: string
  totalAmount: number
  customerEmail: string
  notes: string | null
  purchaseType: string
  items: PendingItem[]
}

export async function fetchPendingFulfillment(): Promise<PendingOrder[]> {
  const res = await api.get('/admin/orders/pending-fulfillment')
  return res.data.data
}

export async function fulfillItem(
  orderId: number,
  itemId: number,
  variantId: number,
  decrementStock = false,
): Promise<void> {
  await api.patch(`/admin/orders/${orderId}/items/${itemId}/fulfill`, { variantId, decrementStock })
}

export async function dispatchOrder(orderId: number): Promise<void> {
  await api.post(`/admin/orders/${orderId}/dispatch`)
}

export async function decrementItemStock(
  orderId: number,
  itemId: number,
): Promise<{ stockRemaining: number }> {
  const res = await api.patch<{ data: { stockRemaining: number } }>(
    `/admin/orders/${orderId}/items/${itemId}/decrement-stock`,
  )
  return res.data.data
}
