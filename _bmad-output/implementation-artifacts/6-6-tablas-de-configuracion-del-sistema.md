# Story 6.6: Tablas de Configuración del Sistema — BFF

Status: done

## Story

Como administrador,
quiero que los tipos de compra, tipos de cliente y modos de precio estén en la base de datos,
para poder editarlos sin tocar el código.

## Acceptance Criteria

1. **Given** se ejecutan las migraciones
   **When** se consulta la DB
   **Then** existen las tablas `purchase_types (id, code, label, active, icon)` y `customer_types (id, code, label, active, icon)`
   **And** `purchase_types` tiene registros: `{ curva, "Por curva", 📦 }`, `{ cantidad, "Por cantidad", 🔢 }`, `{ retail, "Minorista", 🛒 }`
   **And** `customer_types` tiene registros: `{ retail, "Minorista", 🛍️ }`, `{ wholesale, "Mayorista", 🏭 }`

2. **Given** cualquier cliente hace `GET /api/v1/config`
   **When** el endpoint responde
   **Then** retorna `{ roles, priceModes, purchaseTypes, customerTypes }` con todos los valores activos de la DB
   **And** el endpoint es público (sin autenticación)

3. **Given** el código del BFF
   **When** necesita validar roles, tipos de compra o modos de precio
   **Then** usa las constantes de `src/lib/constants.ts` en lugar de strings literales hardcodeados

## Tasks / Subtasks

- [x] Migración `018_config_tables.sql`: tablas `purchase_types` y `customer_types` con seed inicial
  - [x] Tabla `purchase_types (id, code, label, active)`
  - [x] Tabla `customer_types (id, code, label, active)`
- [x] Migración `019_config_icons.sql`: agregar columna `icon` a config tables + price_modes
  - [x] Columna `icon VARCHAR(10)` en `customer_types`, `purchase_types`, `price_modes`
  - [x] Seed de emojis
- [x] Query `modules/config/queries/find-config.ts`: SELECT agregado de `roles`, `price_modes`, `purchase_types`, `customer_types`
- [x] Controller `modules/config/config.controller.ts` + route `GET /config` (público)
- [x] Crear `src/lib/constants.ts`: `ROLES`, `PRICE_MODES`, `PURCHASE_TYPES`, `CUSTOMER_TYPES`, `WholesalePurchaseType`
- [x] Registrar `config.routes.ts` en `routes/index.ts` como ruta pública

## Dev Notes

### Stack BFF
- Node.js v24 + TypeScript estricto + Express 5 + pg Pool (sin ORM)
- Queries SQL en `modules/<nombre>/queries/*.ts`
- Redis para caché (ioredis) via `cacheGet`/`cacheSet`/`cacheDel`

### Constantes de dominio
Archivo: `jedami-bff/src/lib/constants.ts`
```typescript
export const ROLES = { ADMIN: 'admin', WHOLESALE: 'wholesale', RETAIL: 'retail' } as const
export const PRICE_MODES = { RETAIL: 'retail', WHOLESALE: 'wholesale' } as const
export const PURCHASE_TYPES = { CURVA: 'curva', CANTIDAD: 'cantidad', RETAIL: 'retail' } as const
export const CUSTOMER_TYPES = { RETAIL: 'retail', WHOLESALE: 'wholesale' } as const
export type WholesalePurchaseType = Exclude<PurchaseType, 'retail'>
```

### Config endpoint
- `GET /api/v1/config` → público, sin auth
- Registrado en `routes/index.ts` con `router.use('/config', configRoutes)`
- No hay caché Redis en esta versión (query es liviana)

### Migraciones aplicadas
- `018_config_tables.sql` — crea purchase_types y customer_types con seed
- `019_config_icons.sql` — agrega icon a las 3 tablas de config

### Referencias
- [Source: jedami-bff/src/lib/constants.ts]
- [Source: jedami-bff/src/modules/config/config.controller.ts]
- [Source: jedami-bff/src/modules/config/queries/find-config.ts]
- [Source: jedami-bff/src/routes/config.routes.ts]
- [Source: jedami-bff/src/database/migrations/018_config_tables.sql]
- [Source: jedami-bff/src/database/migrations/019_config_icons.sql]

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Completion Notes List
- Implementado en sesión 2026-03-15
- Se agregó WholesalePurchaseType = Exclude<PurchaseType, 'retail'> para type-safety en orders
- La migración 019 agrega icon VARCHAR(10) separada de 018 para no mezclar responsabilidades

### File List
- jedami-bff/src/lib/constants.ts
- jedami-bff/src/modules/config/config.controller.ts
- jedami-bff/src/modules/config/queries/find-config.ts
- jedami-bff/src/routes/config.routes.ts
- jedami-bff/src/routes/index.ts
- jedami-bff/src/database/migrations/018_config_tables.sql
- jedami-bff/src/database/migrations/019_config_icons.sql
