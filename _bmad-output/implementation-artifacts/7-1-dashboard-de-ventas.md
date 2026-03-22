# Story 7.1: Dashboard de Ventas — BFF

Status: done

## Story

Como administrador,
quiero ver métricas de ventas agregadas,
para tener visibilidad del negocio en tiempo real.

## Acceptance Criteria

1. **Given** un admin autenticado hace `GET /admin/dashboard`
   **When** el endpoint procesa la solicitud
   **Then** retorna `{ totalOrders, totalRevenue, revenueLast30d, ordersByStatus: { pending, paid, rejected }, ordersByType: { retail, curva, cantidad }, recentOrders: [...] }`
   **And** el endpoint requiere JWT con rol admin

2. **Given** el dashboard se consulta repetidamente
   **When** el mismo endpoint recibe múltiples requests en 60 segundos
   **Then** la segunda respuesta viene del caché Redis (no hace nueva query a DB)

3. **Given** `recentOrders`
   **When** se retorna en el response
   **Then** incluye los últimos 10 pedidos con: `id`, `purchaseType`, `status`, `totalAmount`, `createdAt`, `customerEmail`

## Tasks / Subtasks

- [x] Queries de agregación en `modules/admin/queries/dashboard.ts`
  - [x] `DASHBOARD_QUERY`: COUNT por status, SUM revenue, revenue_last_30d, COUNT por purchase_type
  - [x] `RECENT_ORDERS_QUERY`: últimos 10 pedidos con JOIN a customers → users para email
- [x] Controller `modules/admin/admin.controller.ts` con `getDashboard`
  - [x] Leer desde caché Redis (`admin:dashboard`, TTL 60s)
  - [x] Si no hay caché: ejecutar ambas queries en `Promise.all`
  - [x] Guardar en caché y retornar
- [x] Route `GET /admin/dashboard` en `routes/admin.routes.ts`
- [x] Registrar `/admin` con `authMiddleware + requireRole([ROLES.ADMIN])` en `routes/index.ts`

## Dev Notes

### Patrón de módulo admin
```
jedami-bff/src/modules/admin/
  admin.controller.ts        ← getDashboard, getAdminPayments, getAdminUsers
  queries/
    dashboard.ts             ← DASHBOARD_QUERY, RECENT_ORDERS_QUERY
    payments.ts              ← ADMIN_PAYMENTS_QUERY, ADMIN_PAYMENTS_COUNT_QUERY
    users.ts                 ← ADMIN_USERS_QUERY, ADMIN_USERS_COUNT_QUERY
```

### Caché Redis
```typescript
const DASHBOARD_CACHE_KEY = 'admin:dashboard'
const DASHBOARD_TTL = 60 // segundos
const cached = await cacheGet(DASHBOARD_CACHE_KEY)
if (cached) return res.status(200).json({ data: JSON.parse(cached) })
// ... query ...
await cacheSet(DASHBOARD_CACHE_KEY, JSON.stringify(data), DASHBOARD_TTL)
```

### Guard de ruta
```typescript
// routes/index.ts
router.use('/admin', authMiddleware, requireRole([ROLES.ADMIN]), adminRoutes)
```

### Response shape
```json
{
  "data": {
    "totalOrders": 42,
    "totalRevenue": 150000,
    "revenueLast30d": 35000,
    "ordersByStatus": { "pending": 5, "paid": 35, "rejected": 2 },
    "ordersByType": { "retail": 10, "curva": 20, "cantidad": 12 },
    "recentOrders": [{ "id": 1, "purchaseType": "curva", "status": "paid", "totalAmount": 5000, "createdAt": "...", "customerEmail": "..." }]
  }
}
```

### Referencias
- [Source: jedami-bff/src/modules/admin/admin.controller.ts]
- [Source: jedami-bff/src/modules/admin/queries/dashboard.ts]
- [Source: jedami-bff/src/routes/admin.routes.ts]
- [Source: jedami-bff/src/routes/index.ts]
- [Source: jedami-bff/src/config/redis.ts]

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Completion Notes List
- Implementado en sesión 2026-03-15
- El caché Redis invalida automáticamente a los 60s (TTL)
- Commit: feat(story-7.1): dashboard de ventas — GET /admin/dashboard con caché Redis

### File List
- jedami-bff/src/modules/admin/admin.controller.ts
- jedami-bff/src/modules/admin/queries/dashboard.ts
- jedami-bff/src/routes/admin.routes.ts
- jedami-bff/src/routes/index.ts
