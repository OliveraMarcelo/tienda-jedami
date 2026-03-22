# Story 7.2: Tabla de Pagos y Gestión de Usuarios — BFF

Status: done

## Story

Como administrador,
quiero ver todos los pagos y gestionar usuarios desde el panel,
para operar el negocio sin acceder a la base de datos.

## Acceptance Criteria

1. **Given** un admin hace `GET /admin/payments`
   **When** el endpoint responde
   **Then** retorna lista paginada de pagos con: `id`, `orderId`, `paymentStatus`, `amount`, `paidAt`, `createdAt`, `purchaseType`, `orderStatus`, `totalAmount`, `customerEmail`
   **And** soporta filtros: `?status=&date_from=&date_to=&page=&limit=`

2. **Given** un admin hace `GET /admin/users`
   **When** el endpoint responde
   **Then** retorna lista paginada de usuarios con: `id`, `email`, `createdAt`, `roles[]`, `customerId`, `customerType`
   **And** soporta filtros: `?role=&search=&page=&limit=`

3. **Given** ambos endpoints
   **When** se consultan
   **Then** retornan metadatos de paginación: `{ page, limit, total, pages }`
   **And** requieren JWT con rol admin

## Tasks / Subtasks

- [x] Query `modules/admin/queries/payments.ts`
  - [x] `ADMIN_PAYMENTS_QUERY`: JOIN payments → orders → customers → users con filtros opcionales ($1=limit, $2=offset, $3=status, $4=date_from, $5=date_to)
  - [x] `ADMIN_PAYMENTS_COUNT_QUERY`: COUNT con mismos filtros
- [x] Query `modules/admin/queries/users.ts`
  - [x] `ADMIN_USERS_QUERY`: JOIN users → user_roles → roles → customers con GROUP BY y filtros
  - [x] `ADMIN_USERS_COUNT_QUERY`: COUNT DISTINCT con mismos filtros
- [x] Handlers en `admin.controller.ts`: `getAdminPayments` y `getAdminUsers`
  - [x] Parsear page/limit/filtros desde query params
  - [x] Ejecutar data query + count query en `Promise.all`
  - [x] Retornar `{ data: { items, pagination } }`
- [x] Rutas `GET /admin/payments` y `GET /admin/users` en `admin.routes.ts`

## Dev Notes

### Patrón de paginación
```typescript
const page   = Math.max(1, Number(req.query.page) || 1)
const limit  = Math.min(100, Math.max(1, Number(req.query.limit) || 20))
const offset = (page - 1) * limit
// Ejecutar data + count en paralelo
const [dataResult, countResult] = await Promise.all([
  pool.query(QUERY,       [limit, offset, filter1, filter2]),
  pool.query(COUNT_QUERY, [filter1, filter2]),
])
const total = Number(countResult.rows[0].total)
return { pagination: { page, limit, total, pages: Math.ceil(total / limit) } }
```

### Filtros opcionales en SQL (patrón ya usado en proyecto)
```sql
WHERE ($3::VARCHAR IS NULL OR p.status = $3)
  AND ($4::TIMESTAMPTZ IS NULL OR p.created_at >= $4)
  AND ($5::TIMESTAMPTZ IS NULL OR p.created_at <= $5)
```
Pasar `null` en el array de params cuando el filtro no está presente.

### ADMIN_USERS_QUERY — consideración importante
Usa `json_agg(r.name) FILTER (WHERE r.name IS NOT NULL)` para no agregar NULLs cuando el usuario no tiene roles. Hace GROUP BY sobre `u.id, u.email, u.created_at, c.id, c.type`.

### Filtro ILIKE para búsqueda de email
```sql
AND ($2::VARCHAR IS NULL OR u.email ILIKE '%' || $2 || '%')
```

### Referencias
- [Source: jedami-bff/src/modules/admin/admin.controller.ts]
- [Source: jedami-bff/src/modules/admin/queries/payments.ts]
- [Source: jedami-bff/src/modules/admin/queries/users.ts]
- [Source: jedami-bff/src/routes/admin.routes.ts]

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Completion Notes List
- Implementado en sesión 2026-03-15
- getAdminUsers usa GET /admin/users (endpoint nuevo con datos ricos) vs GET /users (endpoint existente básico)
- El frontend actual (AdminUsersView) usa GET /users — en web-7-1 se migrará al nuevo endpoint

### File List
- jedami-bff/src/modules/admin/admin.controller.ts
- jedami-bff/src/modules/admin/queries/payments.ts
- jedami-bff/src/modules/admin/queries/users.ts
- jedami-bff/src/routes/admin.routes.ts
