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
  totalOrders: number
  totalRevenue: number
  revenueLast30d: number
  ordersByStatus: { pending: number; paid: number; rejected: number }
  ordersByType: Record<string, number>
  recentOrders: RecentOrder[]
}

export async function fetchDashboard(): Promise<DashboardData> {
  const res = await apiClient.get<{ data: DashboardData }>('/admin/dashboard')
  return res.data.data
}
