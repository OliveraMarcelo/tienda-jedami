export type SupportedGateway = 'checkout_pro' | 'checkout_api' | 'bank_transfer' | 'mp_point'

export interface GatewayLabel {
  label: string
  description: string
}

export const GATEWAY_LABELS: Record<SupportedGateway, GatewayLabel> = {
  checkout_pro:  { label: 'Mercado Pago',              description: 'Tarjetas, débito y más' },
  checkout_api:  { label: 'Tarjeta de crédito/débito', description: 'Pago con tarjeta embebido' },
  bank_transfer: { label: 'Transferencia bancaria',    description: 'Transferencia o depósito' },
  mp_point:      { label: 'Pago presencial (Point)',   description: 'Terminal de pago física' },
}

export const ALL_GATEWAYS: SupportedGateway[] = [
  'checkout_pro',
  'checkout_api',
  'bank_transfer',
  'mp_point',
]
