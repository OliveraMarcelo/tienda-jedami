# Story 1.3: Gestión de Roles y Control de Acceso (RBAC)

Status: review

## Story

Como administrador autenticado,
quiero poder asignar roles a usuarios y que el sistema restrinja el acceso según el rol,
para que cada tipo de usuario solo acceda a las funcionalidades que le corresponden.

## Acceptance Criteria

1. **Given** la base de datos inicializada
   **When** se ejecuta el seed de roles (migración `002_seed_roles.sql`)
   **Then** existen los roles `admin`, `retail` y `wholesale` en la tabla `roles`

2. **Given** un admin autenticado (token JWT con rol `admin`)
   **When** hace `POST /api/v1/users/:userId/roles` con `{ roleId }`
   **Then** el rol queda asignado al usuario (tabla `user_roles`)
   **And** retorna `200 { data: { userId, roleId } }`

3. **Given** un usuario autenticado sin rol `admin`
   **When** intenta acceder a un endpoint protegido con `requireRole('admin')`
   **Then** el middleware retorna RFC 7807 `403`

4. **Given** un request sin header `Authorization` o con token inválido
   **When** llega a cualquier ruta protegida
   **Then** el middleware de auth retorna RFC 7807 `401`

5. **Given** un usuario con rol `admin`
   **When** hace `GET /api/v1/roles`
   **Then** retorna `200 { data: [{ id, name }] }` con todos los roles disponibles

## Tasks / Subtasks

- [x] Task 1 — Verificar seed de roles (AC: #1)
  - [x] Confirmar que `002_seed_roles.sql` inserta `admin`, `wholesale`, `retail` (corregido en Story 1.1)
  - [x] Verificar que el migration runner los aplica al correr `docker compose up`

- [x] Task 2 — Extender `src/modules/roles/roles.repository.ts` con `findAll` y `findById` (AC: #2, #5)
  - [x] Agregar `findAll()`: query `SELECT id, name FROM roles ORDER BY name`
  - [x] Agregar `findById(id: number)`: query `SELECT id, name FROM roles WHERE id = $1`
  - [x] Crear `src/modules/roles/queries/find-all.ts` y `src/modules/roles/queries/find-by-id.ts`

- [x] Task 3 — Crear `src/modules/roles/roles.controller.ts` (AC: #2, #5)
  - [x] Handler `listRoles`: llama `rolesRepository.findAll()`, retorna `{ data: roles }`
  - [x] Handler `assignRole`: extrae `userId` de params y `roleId` de body, verifica que role existe, llama `usersRepository.assignRole(userId, roleId)`, retorna `{ data: { userId, roleId } }`
  - [x] Todos los errores via `next(err)` — nunca `res.status(500).json(...)`

- [x] Task 4 — Crear `src/routes/roles.routes.ts` y registrar (AC: #2, #5)
  - [x] `GET /` → `listRoles` (requiere auth + rol admin)
  - [x] Registrado en `src/routes/index.ts` con `authMiddleware + requireRole(['admin'])`

- [x] Task 5 — Endpoint asignación de rol en users (AC: #2)
  - [x] `POST /users/:userId/roles` → `assignRole` en index.ts con auth + requireRole admin
  - [x] `GET /users/me` mantiene solo authMiddleware (sin requireRole)

- [x] Task 6 — Confirmar que middlewares son RFC 7807 (AC: #3, #4)
  - [x] Ambos middlewares corregidos en Story 1.2 — verificado

## Dev Notes

### Dependencia en Story 1.2

Esta story asume que Story 1.2 ya está completada:
- `src/middlewares/auth.middleware.ts` devuelve RFC 7807 401
- `src/middlewares/role.middleware.ts` devuelve RFC 7807 403
- `src/middlewares/error.middleware.ts` existe (de Story 1.1)
- `AppError` está disponible en `src/types/app-error.ts`
- Los roles en DB son `admin`, `wholesale`, `retail` (seed corregido en Story 1.1)

### Estructura del módulo roles — archivos a crear/modificar

```
jedami-bff/src/
├── modules/
│   ├── roles/
│   │   ├── roles.entity.ts          (ya existe — interface Role)
│   │   ├── roles.repository.ts      (MODIFICAR: agregar findAll, findById)
│   │   ├── roles.controller.ts      (NUEVO)
│   │   └── queries/
│   │       ├── find-by-name.ts      (ya existe)
│   │       ├── find-all.ts          (NUEVO)
│   │       └── find-by-id.ts        (NUEVO)
│   └── users/
│       ├── users.controller.ts      (MODIFICAR: agregar assignRole handler)
│       └── users.repository.ts      (ya existe con assignRole — reutilizar)
└── routes/
    ├── index.ts                     (MODIFICAR: agregar roles y users admin routes)
    ├── auth.routes.ts               (ya existe — Story 1.2)
    └── roles.routes.ts              (NUEVO)
```

### Consulta findAll roles

```typescript
// src/modules/roles/queries/find-all.ts
export const FIND_ALL_ROLES = `
  SELECT id, name FROM roles ORDER BY name
`;
```

### Consulta findById roles

```typescript
// src/modules/roles/queries/find-by-id.ts
export const FIND_ROLE_BY_ID = `
  SELECT id, name FROM roles WHERE id = $1
`;
```

### Validaciones en assignRole

```typescript
// Validar que el userId existe
const user = await usersRepository.findById(userId);
if (!user) throw new AppError(404, 'Usuario no encontrado', '/errors/user-not-found', `No existe usuario con id ${userId}`);

// Validar que el role existe
const role = await rolesRepository.findById(roleId);
if (!role) throw new AppError(404, 'Rol no encontrado', '/errors/role-not-found', `No existe rol con id ${roleId}`);

// Asignar
await usersRepository.assignRole(userId, roleId);
return { userId, roleId };
```

### Registro de rutas en index.ts — separar /me del admin

```typescript
// routes/index.ts
import authRoutes from './auth.routes.js';
import rolesRoutes from './roles.routes.js';
import usersAdminRoutes from './users-admin.routes.js';

router.use('/auth', authRoutes);
router.use('/roles', authMiddleware, requireRole(['admin']), rolesRoutes);
router.use('/users', authMiddleware, requireRole(['admin']), usersAdminRoutes);

// El endpoint /me puede quedar en una ruta aparte o en auth
router.get('/me', authMiddleware, meHandler);
```

O alternativamente, el endpoint `/me` pasa a ser `GET /api/v1/auth/me` en `auth.routes.ts`, que es la ubicación más semántica.

### Respuesta exacta del endpoint GET /api/v1/roles

```json
{
  "data": [
    { "id": 1, "name": "admin" },
    { "id": 2, "name": "wholesale" },
    { "id": 3, "name": "retail" }
  ]
}
```

### Respuesta exacta del endpoint POST /api/v1/users/:userId/roles

```json
POST /api/v1/users/42/roles
Body: { "roleId": 1 }
→ 200 { "data": { "userId": 42, "roleId": 1 } }
```

### Reglas obligatorias de arquitectura aplicadas

- Siempre wrapper `{ data }` en éxito
- Siempre RFC 7807 en error (via error middleware)
- Queries SQL en `queries/*.ts`, ejecutadas via pool en repositories
- Nunca queries directas en controllers o services

### References

- ACs: [Source: _bmad-output/planning-artifacts/epics.md#Story 1.3: Gestión de Roles y Control de Acceso]
- RF-03, RF-04, RF-05: [Source: _bmad-output/planning-artifacts/prd.md]
- RNF-01 (middleware en rutas sensibles): [Source: _bmad-output/planning-artifacts/prd.md]
- Mapeo RF-03/04/05 → modules/roles/: [Source: _bmad-output/planning-artifacts/architecture.md#Mapeo RF → Módulos]
- Reglas obligatorias: [Source: _bmad-output/planning-artifacts/architecture.md#Reglas obligatorias para todos los agentes]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Task 2: roles.repository.ts extendido con findAll() y findById(). Queries creadas en queries/find-all.ts y queries/find-by-id.ts.
- Task 3: roles.controller.ts creado con listRoles y assignRole. Validaciones 404 para user y role inexistentes.
- Task 4: roles.routes.ts creado. Montado en index.ts con authMiddleware + requireRole(['admin']).
- Task 5: POST /users/:userId/roles agregado directamente en index.ts (sin archivo de rutas adicional) con auth + admin guard.
- Task 6: middlewares ya corregidos en Story 1.2. users.repository.ts extendido con findById() y query find-by-id.ts para validar existencia de usuario en assignRole.

### File List

- `jedami-bff/src/modules/roles/queries/find-all.ts` (NUEVO)
- `jedami-bff/src/modules/roles/queries/find-by-id.ts` (NUEVO)
- `jedami-bff/src/modules/roles/roles.repository.ts` (MODIFICADO — findAll, findById)
- `jedami-bff/src/modules/roles/roles.controller.ts` (NUEVO)
- `jedami-bff/src/routes/roles.routes.ts` (NUEVO)
- `jedami-bff/src/routes/index.ts` (MODIFICADO — roles route + users/:userId/roles)
- `jedami-bff/src/modules/users/queries/find-by-id.ts` (NUEVO)
- `jedami-bff/src/modules/users/users.repository.ts` (MODIFICADO — findById)
