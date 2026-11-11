import type { OrderStatus } from '@/api/orders.api'

/** Etiqueta y colores de cada estado del pedido (tienda, estilo píldora) */
export const ORDER_STATUS: Record<OrderStatus, { label: string; classes: string }> = {
  pending:   { label: 'Pendiente de pago', classes: 'bg-[#FDF3D7] text-[#8A5A00]' },
  paid:      { label: 'Pagado',            classes: 'bg-[#E6F2EC] text-[#1B6247]' },
  rejected:  { label: 'Pago rechazado',    classes: 'bg-[#FDE8E6] text-[#A3271A]' },
  cancelled: { label: 'Cancelado',         classes: 'bg-[var(--t-surface)] text-[var(--t-muted)]' },
}
