# Story 1.2: Registro y Autenticación de Administrador

Status: review

## Story

Como administrador,
quiero registrarme con email y contraseña e iniciar sesión para obtener un token de acceso,
para que pueda gestionar el catálogo de productos de forma segura.

## Acceptance Criteria

1. **Given** un email no registrado y una contraseña válida
   **When** se hace `POST /api/v1/auth/register` con `{ email, password }`
   **Then** el sistema crea el usuario con la contraseña encriptada con bcrypt (salt ≥ 10)
   **And** retorna `201 { data: { id, email, createdAt } }` sin exponer `passwordHash`

2. **Given** un email ya registrado
   **When** se hace `POST /api/v1/auth/register` con ese email
   **Then** retorna RFC 7807 `400` con detail indicando que el email ya existe

3. **Given** un usuario registrado con credenciales correctas
   **When** se hace `POST /api/v1/auth/login` con `{ email, password }`
   **Then** retorna `200 { data: { token } }` con JWT válido de 24h que incluye `{ id, roles }` en el payload

4. **Given** credenciales incorrectas
   **When** se hace `POST /api/v1/auth/login`
   **Then** retorna RFC 7807 `401` con detail genérico (sin indicar cuál campo es incorrecto)

## Tasks / Subtasks

- [x] Task 1 — Crear `src/modules/auth/auth.service.ts` (AC: #1, #2, #3, #4)
  - [x] Función `register(email, password)`: bcrypt hash con salt=10, verificar email único, insertar en `users`, retornar `{ id, email, createdAt }` (sin `passwordHash`)
  - [x] Función `login(email, password)`: buscar usuario con roles via `findByEmailWithRoles`, comparar hash, firmar JWT con `{ id, roles }` y `JWT_EXPIRES_IN=24h`, retornar `{ token }`
  - [x] **NO auto-asignar ningún rol en registro** — en esta story los usuarios se registran sin rol (el admin recibe su rol via seed 003_seed_admin.sql o via Story 1.3)
  - [x] Lanzar errores tipados con `status` y `type` para que el error middleware los interprete correctamente

- [x] Task 2 — Crear `src/modules/auth/auth.controller.ts` (AC: #1, #2, #3, #4)
  - [x] Handler `register`: valida presencia de email y password, llama `authService.register`, retorna `{ data: {...} }`, pasa errores al `next(err)` del error middleware
  - [x] Handler `login`: llama `authService.login`, retorna `{ data: { token } }`, pasa errores al `next(err)`
  - [x] **NUNCA** usar `try/catch` con `res.status(500).json(...)` — siempre delegar al error middleware via `next(err)`
  - [x] **NUNCA** loguear con `console.log` — usar `logger` de `src/config/logger.ts`

- [x] Task 3 — Crear `src/routes/auth.routes.ts` y registrar en router (AC: #1, #2, #3, #4)
  - [x] `POST /register` → handler `register` (sin autenticación)
  - [x] `POST /login` → handler `login` (sin autenticación)
  - [x] Agregar en `src/routes/index.ts`: `router.use('/auth', authRoutes)`

- [x] Task 4 — Corregir middlewares para RFC 7807 (prerequisito para todos los ACs)
  - [x] `src/middlewares/auth.middleware.ts`: reemplazar `res.status(401).json({ message: "..." })` por llamar `next(error)` con un `AppError` de status 401
  - [x] `src/middlewares/role.middleware.ts`: reemplazar `res.status(403).json({ message: "..." })` por el mismo patrón RFC 7807

- [x] Task 5 — Limpiar código existente
  - [x] Eliminar de `src/modules/users/users.service.ts` la función `createUser` y `loginUser` (migradas a auth.service.ts)
  - [x] Actualizar `src/modules/users/users.repository.ts` si es necesario (mantenerlo, solo eliminar funciones redundantes)
  - [x] El endpoint `/api/v1/users/register` y `/api/v1/users/login` en `users.routes.ts` fue eliminado (ahora son `/api/v1/auth/register` y `/api/v1/auth/login`)
  - [x] Mantener `GET /api/v1/users/me` en `users.routes.ts`

## Dev Notes

### Estado actual del código — lo que YA existe (NO recrear)

| Archivo | Estado | Acción requerida |
|---|---|---|
| `src/modules/users/users.repository.ts` | ✅ Funciona | Mantener — auth.service.ts lo reutiliza |
| `src/modules/users/queries/find-by-email.ts` | ✅ | Reutilizar en auth.service.ts |
| `src/modules/users/queries/find-by-email-with-roles.ts` | ✅ | Reutilizar en auth.service.ts |
| `src/modules/users/queries/create-user.ts` | ✅ | Reutilizar en auth.service.ts |
| `src/modules/auth/jwt-payload.ts` | ✅ JwtUserPayload { id, email, roles } | Reutilizar |
| `src/middlewares/auth.middleware.ts` | ❌ No RFC7807 | Refactorizar (Task 4) |
| `src/middlewares/role.middleware.ts` | ❌ No RFC7807 | Refactorizar (Task 4) |
| `src/middlewares/error.middleware.ts` | ✅ Creado en Story 1.1 | Reutilizar |
| `src/modules/users/users.controller.ts` | ❌ console.log, no RFC7807 | Limpiar (Task 5) |
| `src/modules/users/users.service.ts` | ❌ Auto-asigna rol 'retail', usa nombre 'minorista' | Limpiar (Task 5) |

### Patrón de errores tipados — cómo crear AppError

El error middleware de Story 1.1 espera un error con `.status` y opcionalmente `.type`. Patrón recomendado:

```typescript
// src/types/app-error.ts (crear si no existe)
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly title: string,
    public readonly type: string,
    message: string,
  ) {
    super(message);
  }
}
```

Uso en auth.service.ts:
```typescript
throw new AppError(400, 'Email duplicado', '/errors/email-already-exists',
  `El email ${email} ya está registrado`);
throw new AppError(401, 'Credenciales inválidas', '/errors/invalid-credentials',
  'Email o contraseña incorrectos');
```

### Formato exacto de respuestas (reglas arquitectónicas)

```typescript
// ✅ Registro exitoso
res.status(201).json({ data: { id: user.id, email: user.email, createdAt: user.createdAt } });

// ✅ Login exitoso
res.status(200).json({ data: { token } });

// ✅ Error (via error middleware — no en el controller)
next(new AppError(400, 'Email duplicado', '/errors/email-already-exists', 'El email ya está en uso'));
```

### JWT payload — estructura requerida

```typescript
const payload: JwtUserPayload = {
  id: user.id,
  email: user.email,  // ok incluirlo, no es sensible
  roles: user.roles ?? [],  // array de strings: ['admin'], ['wholesale'], etc.
};
jwt.sign(payload, ENV.JWT_SECRET as jwt.Secret, { expiresIn: ENV.JWT_EXPIRES_IN } as jwt.SignOptions);
```

Archivo: `src/modules/auth/jwt-payload.ts` ya define `JwtUserPayload` — usar exactamente esa interface.

### Importante — bcrypt salt

```typescript
const passwordHash = await bcrypt.hash(password, 10);  // ✅ salt=10 (RNF-01)
```

### Importante — NUNCA exponer password_hash

```typescript
// ✅ Solo retornar estos campos:
return { id: user.id, email: user.email, createdAt: user.created_at };
// ❌ NUNCA retornar user directamente (contiene password_hash)
```

### Camelización de campos DB → API

DB usa `snake_case`, la respuesta API debe ser `camelCase`:
- `user.created_at` → `createdAt` en la respuesta JSON
- Mapear explícitamente en el service/controller:

```typescript
return { id: user.id, email: user.email, createdAt: user.created_at };
```

### Importaciones ESM — obligatorio `.js`

```typescript
import { logger } from '../../config/logger.js';  // ✅
import { pool } from '../../config/database.js';   // ✅
import { AppError } from '../../types/app-error.js'; // ✅
```

### Seed admin existente

La migración `003_seed_admin.sql` ya inserta `admin@jedami.com` con hash de contraseña y le asigna el rol `admin`. El rol `admin` en la tabla `roles` se crea via `002_seed_roles.sql` (corregido en Story 1.1 a nombres `admin`, `wholesale`, `retail`). **No necesita código adicional para el admin en esta story** — solo asegurarse de que las migraciones se hayan corrido.

### Project Structure Notes

Archivos a crear en esta story:
```
jedami-bff/src/
├── modules/
│   └── auth/
│       ├── jwt-payload.ts       (ya existe, NO modificar)
│       ├── auth.service.ts      (NUEVO)
│       └── auth.controller.ts   (NUEVO)
├── routes/
│   ├── index.ts                 (MODIFICAR: agregar auth route)
│   └── auth.routes.ts           (NUEVO)
├── types/
│   └── app-error.ts             (NUEVO — si no fue creado en Story 1.1)
└── middlewares/
    ├── auth.middleware.ts        (MODIFICAR: RFC 7807)
    └── role.middleware.ts        (MODIFICAR: RFC 7807)
```

### References

- ACs: [Source: _bmad-output/planning-artifacts/epics.md#Story 1.2: Registro y Autenticación de Administrador]
- Reglas obligatorias (nunca exponer password_hash, wrapper { data }, RFC 7807): [Source: _bmad-output/planning-artifacts/architecture.md#Reglas obligatorias para todos los agentes]
- RF-01, RF-02: [Source: _bmad-output/planning-artifacts/prd.md]
- RNF-01 (bcrypt salt ≥ 10, JWT 24h): [Source: _bmad-output/planning-artifacts/prd.md#NonFunctional Requirements]
- Estructura módulo auth: [Source: _bmad-output/planning-artifacts/architecture.md#Árbol Completo del Monorepo]
- Formato respuestas: [Source: _bmad-output/planning-artifacts/architecture.md#Formato de Respuestas API]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Task 1: auth.service.ts creado. register() usa bcrypt salt=10, sin auto-asignar rol. login() retorna solo `{ token }`. AppError tipado para 400 y 401. CREATE_USER query actualizado para retornar `created_at`.
- Task 2: auth.controller.ts con validación de presencia email/password. Todos los errores delegados a next(err).
- Task 3: auth.routes.ts con POST /register y /login. Registrado en index.ts como /auth.
- Task 4: auth.middleware.ts y role.middleware.ts refactorizados a RFC 7807 usando AppError + next(err).
- Task 5: users.service.ts vaciado (lógica migrada). users.controller.ts reducido a solo `me`. users.routes.ts solo mantiene GET /me.

### File List

- `jedami-bff/src/types/app-error.ts` (NUEVO)
- `jedami-bff/src/modules/auth/auth.service.ts` (NUEVO)
- `jedami-bff/src/modules/auth/auth.controller.ts` (NUEVO)
- `jedami-bff/src/routes/auth.routes.ts` (NUEVO)
- `jedami-bff/src/routes/index.ts` (MODIFICADO — agrega /auth route)
- `jedami-bff/src/routes/users.routes.ts` (MODIFICADO — solo /me)
- `jedami-bff/src/middlewares/auth.middleware.ts` (MODIFICADO — RFC 7807)
- `jedami-bff/src/middlewares/role.middleware.ts` (MODIFICADO — RFC 7807)
- `jedami-bff/src/modules/users/users.service.ts` (MODIFICADO — vaciado, lógica migrada)
- `jedami-bff/src/modules/users/users.controller.ts` (MODIFICADO — solo me handler)
- `jedami-bff/src/modules/users/queries/create-user.ts` (MODIFICADO — retorna created_at)
