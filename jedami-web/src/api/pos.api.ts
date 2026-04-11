import apiClient from './client'

export interface PosDevice {
  id: number
  mp_device_id: string
  name: string
  operating_mode: 'PDV' | 'STANDALONE'
  active: boolean
  created_at: string
}

export interface PosIntent {
  id: number
  device_id: number
  order_id: number
  mp_intent_id: string
  status: string
  mp_payment_id: string | null
  created_at: string
  updated_at: string
}

export interface IntentResult {
  intentId: string
  deviceName: string
  status: string
}

export interface IntentState {
  loading: boolean
  status: string | null
  deviceName: string
  intentId: string | null
  error: string
}

export async function fetchPosDevices(): Promise<PosDevice[]> {
  const res = await apiClient.get<{ data: PosDevice[] }>('/pos/devices')
  return res.data.data
}

export async function syncPosDevices(): Promise<PosDevice[]> {
  const res = await apiClient.post<{ data: PosDevice[] }>('/pos/devices/sync')
  return res.data.data
}

export async function updatePosDevice(id: number, active: boolean): Promise<PosDevice> {
  const res = await apiClient.patch<{ data: PosDevice }>(`/pos/devices/${id}`, { active })
  return res.data.data
}

export async function createIntent(orderId: number): Promise<IntentResult> {
  const res = await apiClient.post<{ data: IntentResult }>(`/pos/orders/${orderId}/intent`)
  return res.data.data
}

export async function getIntent(orderId: number): Promise<{ intent: PosIntent; deviceName: string }> {
  const res = await apiClient.get<{ data: { intent: PosIntent; deviceName: string } }>(`/pos/orders/${orderId}/intent`)
  return res.data.data
}

export async function cancelIntent(orderId: number): Promise<void> {
  await apiClient.delete(`/pos/orders/${orderId}/intent`)
}

export async function confirmPointPayment(
  orderId: number,
  mpPaymentId?: string,
): Promise<{ orderId: number; status: string }> {
  const res = await apiClient.patch<{ data: { orderId: number; status: string } }>(
    `/pos/orders/${orderId}/confirm`,
    mpPaymentId ? { mpPaymentId } : {},
  )
  return res.data.data
}
