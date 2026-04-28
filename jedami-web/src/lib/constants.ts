// Roles de usuario
export const ROLES = {
  ADMIN: 'admin',
  WHOLESALE: 'wholesale',
  RETAIL: 'retail',
} as const

export type Role = (typeof ROLES)[keyof typeof ROLES]

// Modos de visualización de precios
export const MODES = {
  RETAIL: 'retail',
  WHOLESALE: 'wholesale',
} as const

export type Mode = (typeof MODES)[keyof typeof MODES]

// Tipos de compra mayorista
export const PURCHASE_TYPES = {
  CURVA: 'curva',
  CANTIDAD: 'cantidad',
} as const

export type PurchaseType = (typeof PURCHASE_TYPES)[keyof typeof PURCHASE_TYPES]

// Tipos de cliente para registro
export const CUSTOMER_TYPES = {
  RETAIL: 'retail',
  WHOLESALE: 'wholesale',
} as const

export type CustomerType = (typeof CUSTOMER_TYPES)[keyof typeof CUSTOMER_TYPES]

export const ROLE_LABELS: Record<string, string> = {
  admin:     'Administrador',
  wholesale: 'Mayorista',
  retail:    'Minorista',
}
