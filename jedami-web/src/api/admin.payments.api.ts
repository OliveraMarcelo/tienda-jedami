import apiClient from './client'

export interface AdminPayment {
  id: number
  orderId: number
  paymentStatus: string
  amount: number
  paidAt: string | null
  createdAt: string
  purchaseType: string
  orderStatus: string
  totalAmount: number
  notes: string | null
  customerEmail: string
  paymentMethod: string
}

export interface Pagination {
  page: number
  limit: number
  total: number
  pages: number
}

export interface AdminPaymentsResponse {
  payments: AdminPayment[]
  pagination: Pagination
}

export interface FetchAdminPaymentsParams {
  page?: number
  limit?: number
  status?: string
  dateFrom?: string
  dateTo?: string
}

export async function confirmBankTransfer(orderId: number): Promise<void> {
  await apiClient.post(`/admin/orders/${orderId}/confirm-transfer`)
}

export async function fetchAdminPayments(
  params: FetchAdminPaymentsParams = {},
): Promise<AdminPaymentsResponse> {
  const res = await apiClient.get<{ data: AdminPaymentsResponse }>('/admin/payments', {
    params: {
      page:      params.page,
      limit:     params.limit,
      status:    params.status    || undefined,
      date_from: params.dateFrom  || undefined,
      date_to:   params.dateTo    || undefined,
    },
  })
  return res.data.data
}
