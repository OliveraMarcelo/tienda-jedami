import apiClient from './client'

export interface BankDetails {
  cvu: string | null
  alias: string | null
  holderName: string | null
  bankName: string | null
  notes: string | null
  amount: string
}

export type CheckoutResult =
  | { type: 'redirect'; checkoutUrl: string }
  | { type: 'preference'; publicKey: string }
  | { type: 'bank_transfer'; bankDetails: BankDetails }

export type SmartCheckoutResult =
  | CheckoutResult
  | { type: 'select'; options: string[] }

export async function initiateCheckout(orderId: number): Promise<CheckoutResult> {
  const res = await apiClient.post<{ data: CheckoutResult }>(`/payments/${orderId}/checkout`)
  return res.data.data
}

export async function smartCheckout(orderId: number, selectedGateway?: string): Promise<SmartCheckoutResult> {
  const res = await apiClient.post<{ data: SmartCheckoutResult }>('/payments/checkout', {
    orderId,
    ...(selectedGateway ? { selectedGateway } : {}),
  })
  return res.data.data
}

export async function retryPayment(orderId: number): Promise<{ checkoutUrl: string }> {
  const res = await apiClient.post<{ data: { checkoutUrl: string } }>(`/payments/${orderId}/retry`)
  return res.data.data
}

export async function processPayment(
  orderId: number,
  dto: Record<string, unknown>,
): Promise<{ status: string; statusDetail?: string }> {
  const res = await apiClient.post<{ data: { status: string; statusDetail?: string } }>(`/payments/${orderId}/process`, dto)
  return res.data.data
}
