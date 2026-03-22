# Story W7.1: Panel Admin — Dashboard, Pagos y Usuarios Mejorado — Web

Status: done

## Story

Como administrador,
quiero ver métricas del negocio, la tabla de pagos y la lista de usuarios con datos ricos desde el panel web,
para operar el negocio sin necesidad de acceder a la base de datos.

## Acceptance Criteria

1. **Given** el admin navega a `/admin/dashboard`
   **When** la página carga
   **Then** ve las métricas: Total Pedidos, Revenue Total, Revenue últimos 30 días
   **And** ve contadores de pedidos por estado (pending/paid/rejected)
   **And** ve los últimos 10 pedidos en una tabla con email del cliente, tipo, estado y monto

2. **Given** el admin navega a `/admin/pagos`
   **When** la página carga
   **Then** ve una tabla paginada de pagos consumiendo `GET /api/v1/admin/payments`
   **And** puede filtrar por estado de pago y rango de fechas
   **And** puede navegar entre páginas

3. **Given** el admin navega a `/admin/usuarios`
   **When** la página carga
   **Then** la tabla consume `GET /api/v1/admin/users` (endpoint nuevo con customerType incluido)
   **And** puede buscar por email y filtrar por rol
   **And** puede asignar roles inline (funcionalidad ya existente)

4. **Given** el `AdminView.vue` (panel principal `/admin`)
   **When** el admin lo ve
   **Then** incluye tarjetas de acceso a Dashboard, Pagos, Usuarios y Productos

## Tasks / Subtasks

- [x] Crear `src/api/admin.dashboard.api.ts`: `fetchDashboard()` → `GET /api/v1/admin/dashboard` (AC: 1)
  - [x] Tipar `DashboardData`: `{ totalOrders, totalRevenue, revenueLast30d, ordersByStatus, ordersByType, recentOrders }`
- [x] Crear `src/api/admin.payments.api.ts`: `fetchAdminPayments(params)` → `GET /api/v1/admin/payments` (AC: 2)
  - [x] Tipar `AdminPayment`, `AdminPaymentsResponse` con paginación
  - [x] Params: `{ page?, limit?, status?, dateFrom?, dateTo? }`
- [x] Actualizar `src/api/admin.users.api.ts`: agregar `fetchAdminUsers(params)` → `GET /api/v1/admin/users` (AC: 3)
  - [x] Tipar `AdminUser` con `customerId`, `customerType` incluidos
  - [x] Params: `{ page?, limit?, role?, search? }`
- [x] Crear `src/views/admin/AdminDashboardView.vue` (AC: 1)
  - [x] Cards de métricas: Total Pedidos, Revenue Total, Revenue 30d
  - [x] Badges contadores por estado (pending/paid/rejected)
  - [x] Tabla de pedidos recientes: email, purchaseType, status, monto, fecha
  - [x] Skeleton de carga con `animate-pulse`
- [x] Crear `src/views/admin/AdminPaymentsView.vue` (AC: 2)
  - [x] Tabla de pagos con columnas: ID, email cliente, monto, estado, tipo compra, fecha
  - [x] Filtros: select de estado + date inputs para rango
  - [x] Paginación con botones anterior/siguiente + info "Página X de Y"
  - [x] Skeleton de carga
- [x] Actualizar `src/views/admin/AdminUsersView.vue` (AC: 3)
  - [x] Migrar de `GET /users` a `fetchAdminUsers()` de `GET /admin/users`
  - [x] Agregar campo customerType en la tabla
  - [x] Agregar input de búsqueda por email + select de filtro de rol
  - [x] Paginación simple
- [x] Actualizar `src/views/admin/AdminView.vue` (AC: 4)
  - [x] Agregar tarjeta "Dashboard" → `/admin/dashboard`
  - [x] Agregar tarjeta "Pagos" → `/admin/pagos`
- [x] Registrar rutas en `src/router/index.ts` (AC: 1, 2)
  - [x] `/admin/dashboard` → `AdminDashboardView`, meta `{ requiresRole: ROLES.ADMIN }`
  - [x] `/admin/pagos` → `AdminPaymentsView`, meta `{ requiresRole: ROLES.ADMIN }`

## Dev Notes

### Stack y convenciones Web
- Vue 3 + Composition API + TypeScript + Pinia + Axios (`import apiClient from './client'` — default export)
- shadcn-vue + Tailwind CSS, estilos consistentes con el resto del admin
- Color de marca: `#E91E8C` (rosa Jedami)

### Patrón de api client
```typescript
// SIEMPRE default import
import apiClient from './client'
// NO: import { apiClient } from './client'
```

### Patrón admin views existentes (replicar)
Ver `AdminUsersView.vue` y `AdminProductsView.vue` para el patrón:
- `const loading = ref(true)`, `const error = ref('')`
- `onMounted(async () => { try { ... } finally { loading.value = false } })`
- Skeleton: `<div v-if="loading" class="space-y-3"><div v-for="i in 4" :key="i" class="animate-pulse bg-white rounded-2xl border h-16"></div></div>`
- Breadcrumb: `<button @click="router.push('/admin')" class="text-sm text-gray-500 hover:text-[#E91E8C]">← Admin</button>`

### Labels desde config store
```typescript
import { useConfigStore } from '@/stores/config.store'
const configStore = useConfigStore()
// Lookups
configStore.purchaseTypeLabel['curva']  // "Por curva"
configStore.priceModeLabel['retail']    // "Minorista"
```

### Paginación patrón recomendado
```typescript
const page = ref(1)
const limit = ref(20)
const total = ref(0)
const pages = computed(() => Math.ceil(total.value / limit.value))

async function loadPage(p: number) {
  page.value = p
  await loadPayments()
}
```

### Response shape GET /admin/payments
```json
{
  "data": {
    "payments": [{ "id": 1, "orderId": 1, "paymentStatus": "approved", "amount": 5000, "paidAt": "...", "createdAt": "...", "purchaseType": "curva", "orderStatus": "paid", "totalAmount": 5000, "customerEmail": "..." }],
    "pagination": { "page": 1, "limit": 20, "total": 100, "pages": 5 }
  }
}
```

### Response shape GET /admin/dashboard
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

### Response shape GET /admin/users
```json
{
  "data": {
    "users": [{ "id": 1, "email": "...", "createdAt": "...", "roles": ["admin"], "customerId": 1, "customerType": "wholesale" }],
    "pagination": { "page": 1, "limit": 20, "total": 50, "pages": 3 }
  }
}
```

### IMPORTANTE: AdminUsersView actual usa GET /users (endpoint básico)
El endpoint `GET /users` retorna `UserWithRoles[]` sin customerType ni paginación.
El nuevo `GET /admin/users` retorna datos ricos con paginación.
Migrar `AdminUsersView` al nuevo endpoint y actualizar el tipo `UserWithRoles` en `admin.users.api.ts` (o crear `AdminUser` separado).

### Rutas del router (patrón existente)
```typescript
{
  path: '/admin/dashboard',
  name: 'adminDashboard',
  component: () => import('@/views/admin/AdminDashboardView.vue'),
  meta: { requiresRole: ROLES.ADMIN },
}
```

### Project Structure Notes
- Vistas admin: `jedami-web/src/views/admin/`
- APIs admin: `jedami-web/src/api/admin.*.api.ts`
- El guard de roles en router verifica `meta.requiresRole === ROLES.ADMIN && !authStore.isAdmin`

### Referencias
- [Source: jedami-bff/src/modules/admin/admin.controller.ts] — shapes de response
- [Source: jedami-web/src/views/admin/AdminUsersView.vue] — patrón de vista admin
- [Source: jedami-web/src/views/admin/AdminView.vue] — panel principal a actualizar
- [Source: jedami-web/src/router/index.ts] — patrón de rutas
- [Source: jedami-web/src/stores/config.store.ts] — config para labels

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Debug Log References

### Completion Notes List
- `AdminUsersView` migrado a `GET /admin/users` con paginación y filtros — `fetchUsers()` básico se conserva para otros usos
- `AdminView` ahora tiene 4 tarjetas: Dashboard, Pagos, Productos, Usuarios
- Labels de purchaseType y customerType resueltos desde configStore (dinámico desde DB)
- `vue-tsc --noEmit` sin errores

### File List
- jedami-web/src/api/admin.dashboard.api.ts
- jedami-web/src/api/admin.payments.api.ts
- jedami-web/src/api/admin.users.api.ts
- jedami-web/src/views/admin/AdminDashboardView.vue
- jedami-web/src/views/admin/AdminPaymentsView.vue
- jedami-web/src/views/admin/AdminUsersView.vue
- jedami-web/src/views/admin/AdminView.vue
- jedami-web/src/router/index.ts
