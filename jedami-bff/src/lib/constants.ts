// Roles de usuario (deben coincidir con los registros en la tabla roles de la DB)
export const ROLES = {
  ADMIN: 'admin',
  WHOLESALE: 'wholesale',
  RETAIL: 'retail',
} as const

export type Role = (typeof ROLES)[keyof typeof ROLES]

// Códigos de modo de precio (deben coincidir con price_modes.code en la DB)
export const PRICE_MODES = {
  RETAIL: 'retail',
  WHOLESALE: 'wholesale',
} as const

export type PriceMode = (typeof PRICE_MODES)[keyof typeof PRICE_MODES]

// Tipos de compra mayorista
export const PURCHASE_TYPES = {
  CURVA: 'curva',
  CANTIDAD: 'cantidad',
  RETAIL: 'retail',
} as const

export type PurchaseType = (typeof PURCHASE_TYPES)[keyof typeof PURCHASE_TYPES]

// Tipos de cliente
export const CUSTOMER_TYPES = {
  RETAIL: 'retail',
  WHOLESALE: 'wholesale',
} as const

export type CustomerType = (typeof CUSTOMER_TYPES)[keyof typeof CUSTOMER_TYPES]
