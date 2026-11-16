import apiClient from './client'

export interface RecentOrder {
  id: number
  purchaseType: string
  status: string
  totalAmount: number
  createdAt: string
  customerEmail: string
}

export interface DashboardData {
  /** Pedidos vendidos (pagados + despachados) */
  totalOrders: number
  totalRevenue: number
  revenueLast30d: number
  /** paid = pagados sin despachar */
  ordersByStatus: { pending: number; paid: number; shipped: number; rejected: number }
  ordersByType: Record<string, number>
  recentOrders: RecentOrder[]
}

export async function fetchDashboard(): Promise<DashboardData> {
  const res = await apiClient.get<{ data: DashboardData }>('/admin/dashboard')
  return res.data.data
}
