import api from './client'

export interface GridSize { id: number; label: string }
export interface GridColor { id: number; name: string; hexCode: string | null }
export interface GridVariant { id: number; sizeId: number; colorId: number; stock: number }

/** Línea del pedido: curva (con talle), cantidad (sin talle) o minorista (con variante ya elegida) */
export interface PendingLine {
  id: number
  sizeId: number | null
  size: string | null
  quantity: number
  variantId: number | null
}

export interface PendingProduct {
  productId: number
  productName: string
  sizes: GridSize[]
  colors: GridColor[]
  variants: GridVariant[]
  lines: PendingLine[]
}

export interface PendingOrder {
  id: number
  createdAt: string
  totalAmount: number
  customerEmail: string
  notes: string | null
  purchaseType: string
  products: PendingProduct[]
}

export interface Allocation { itemId: number; variantId: number; quantity: number }

export async function fetchPendingFulfillment(): Promise<PendingOrder[]> {
  const res = await api.get<{ data: PendingOrder[] }>('/admin/orders/pending-fulfillment')
  return res.data.data
}

/** Guarda el reparto, descuenta el stock y marca el pedido como despachado */
export async function dispatchOrder(orderId: number, allocations: Allocation[]): Promise<void> {
  await api.post(`/admin/orders/${orderId}/dispatch`, { allocations })
}
