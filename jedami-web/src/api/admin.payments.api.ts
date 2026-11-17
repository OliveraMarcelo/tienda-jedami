import apiClient from './client'

export interface AdminPayment {
  /** null = el pedido todavía no inició un pago */
  id: number | null
  orderId: number
  paymentStatus: string
  paidAt: string | null
  createdAt: string
  purchaseType: string
  orderStatus: string
  totalAmount: number
  notes: string | null
  customerEmail: string
  /** Medio del pago que se muestra (el aprobado o el último intento) */
  paymentMethod: string | null
  /** Todos los medios que se le ofrecieron al pedido (mercadopago, bank_transfer, mp_point) */
  methods: string[]
  /** Número de operación de Mercado Pago (null en transferencias o intentos sin pagar) */
  mpPaymentId: string | null
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
  /** Email del cliente o número de pedido */
  search?: string
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
      search:    params.search    || undefined,
    },
  })
  return res.data.data
}
