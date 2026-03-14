import apiClient from './client'

export interface CheckoutResponse {
  orderId: number
  checkoutUrl: string
  paymentId: number
  preferenceId: string
}

export async function initiateCheckout(orderId: number): Promise<CheckoutResponse> {
  const res = await apiClient.post<{ data: CheckoutResponse }>(`/payments/${orderId}/checkout`)
  return res.data.data
}
