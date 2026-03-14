# Story W1.2: Páginas de Login y Registro

Status: review

## Story

Como visitante,
quiero registrarme e iniciar sesión en la plataforma,
para que pueda acceder a las funcionalidades de compra.

**Depende de:** BFF Story 1.2 done (`POST /api/v1/auth/register` y `POST /api/v1/auth/login` operativos)

## Acceptance Criteria

1. **Given** un visitante en `/login` completa email y password correctos
   **When** hace submit
   **Then** se llama `POST /api/v1/auth/login`, el token se almacena en `authStore` y es redirigido según su rol (admin → `/admin`, wholesale → `/catalogo`, retail → `/catalogo`)

2. **Given** credenciales incorrectas
   **When** la API retorna 401 RFC 7807
   **Then** se muestra el mensaje del campo `detail` del error bajo el formulario (nunca un `alert()`)

3. **Given** el usuario completa el form de registro en `/registro`
   **When** hace submit con email, password y tipo de cliente (minorista/mayorista)
   **Then** se llama `POST /api/v1/auth/register` y luego login automático, redirigiendo al catálogo

4. **Given** el usuario está autenticado y recarga la página
   **When** la app inicializa
   **Then** el token se restaura desde `localStorage` y el usuario no debe volver a hacer login

5. **Given** el usuario logueado hace click en "Cerrar sesión"
   **When** se ejecuta `authStore.logout()`
   **Then** el token se borra y es redirigido a `/login`

## Tasks / Subtasks

- [x] Task 1 — Implementar `authStore` completo en `src/stores/auth.store.ts` (AC: #1, #3, #4, #5)
  - [x] parseJwtPayload() para leer roles del token sin verificar
  - [x] Getters: isAuthenticated, isAdmin, isWholesale, isRetail, mode
  - [x] login(): POST /auth/login → setToken → redirect a /admin o /catalogo por rol
  - [x] register(): POST /auth/register → login automático
  - [x] logout(): clearToken + redirect a /login

- [x] Task 2 — Crear `src/views/LoginView.vue` (AC: #1, #2)
  - [x] Form email + password con toggle de visibilidad
  - [x] Validación on-blur con computed errors
  - [x] Error RFC 7807 via err.response.data.detail
  - [x] Spinner en botón submit, disabled mientras loading

- [x] Task 3 — Crear `src/views/RegisterView.vue` (AC: #3)
  - [x] Form email + password + confirmar password
  - [x] password ≥ 8 chars, confirmar debe coincidir
  - [x] Error del servidor bajo el form

- [x] Task 4 — Guard de rutas (ya implementado en W1.1)

- [x] Task 5 — Implementar `src/api/auth.api.ts` (AC: #1, #3)
  - [x] loginApi(), registerApi() con tipado TypeScript

## Dev Notes

### Depende de W1.1

Esta story asume que W1.1 está completa:
- `src/api/client.ts` existe con interceptor JWT
- `authStore` tiene el esqueleto inicial
- Rutas `/login` y `/registro` están definidas en el router
- shadcn-vue instalado con componentes `Button`, `Input`, `Badge`

### Endpoints del BFF a consumir

```
POST /api/v1/auth/register
  Body: { email: string, password: string }
  Response 201: { data: { id: number, email: string, createdAt: string } }
  Error 400 RFC 7807: { type, title, status: 400, detail: "El email ya está registrado" }

POST /api/v1/auth/login
  Body: { email: string, password: string }
  Response 200: { data: { token: string } }
  Error 401 RFC 7807: { type, title, status: 401, detail: "Email o contraseña incorrectos" }
```

### JWT payload — cómo extraer el rol

El token JWT contiene `{ id, email, roles: string[] }` en el payload. Para leer el payload sin verificar (ya lo verificó el server):

```typescript
// src/stores/auth.store.ts
function parseJwtPayload(token: string): { id: number; email: string; roles: string[] } {
  const base64 = token.split('.')[1]
  return JSON.parse(atob(base64))
}
```

Guardar `id`, `email` y `roles` en el state del store.

### Getter `mode` del authStore

```typescript
// mode: 'retail' | 'wholesale' — controla data-mode en App.vue
get mode(): 'retail' | 'wholesale' {
  return this.user?.roles.includes('wholesale') ? 'wholesale' : 'retail'
}
```

### Redirección post-login según rol

```typescript
// En authStore.login() después de recibir el token:
const payload = parseJwtPayload(token)
if (payload.roles.includes('admin')) {
  router.push('/admin')
} else {
  router.push('/catalogo')
}
```

### Manejo de errores RFC 7807

El BFF devuelve `{ type, title, status, detail }` en todos los errores. En los componentes:

```typescript
try {
  await authStore.login(email, password)
} catch (err: any) {
  // err.response.data contiene el objeto RFC 7807
  errorMessage.value = err.response?.data?.detail ?? 'Error inesperado'
}
```

### Form pattern UX (del design spec)

- Validación on-blur, nunca on-change
- Error bajo el campo: texto `text-sm text-brand-error`
- Botón submit: `<Button variant="default" :disabled="loading || !isValid">`
- Loading state: spinner `<svg>` de 16px inline en el botón (no reemplazar texto)
- Password toggle: botón ghost con ícono 👁️ que cambia `type="password"` ↔ `type="text"`

### Project Structure Notes

```
jedami-web/src/
├── api/
│   ├── client.ts        (ya existe de W1.1)
│   └── auth.api.ts      (NUEVO)
├── stores/
│   └── auth.store.ts    (MODIFICAR: completar con login/register/logout)
└── views/
    ├── LoginView.vue    (NUEVO)
    └── RegisterView.vue (NUEVO)
```

### References

- BFF story 1.2 (endpoints): [Source: _bmad-output/implementation-artifacts/1-2-registro-y-autenticacion-de-administrador.md]
- UX Design Spec — Form patterns: [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Form Patterns]
- UX Design Spec — Soft registration gate (J4): [Source: _bmad-output/planning-artifacts/ux-design-specification.md#User Journey Flows]
- Architecture — D8 (Axios + interceptor JWT): [Source: _bmad-output/planning-artifacts/architecture.md#D8]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Task 1: authStore reescrito con parseJwtPayload (atob). Estado user derivado del JWT sin fetchMe. login/register/logout con dynamic import del router para evitar circular dep.
- Task 2: LoginView con validación on-blur, spinner SVG inline, error RFC 7807, password toggle emoji.
- Task 3: RegisterView con confirmación de password y validación min 8 chars.
- Task 4: Guards ya existían desde W1.1 (requiresAuth → /login, requiresRole → /catalogo).
- Task 5: auth.api.ts con loginApi + registerApi tipados.

### File List

- `jedami-web/src/api/auth.api.ts` (NUEVO)
- `jedami-web/src/stores/auth.store.ts` (MODIFICADO — parseJwtPayload, getters completos, redirect post-login)
- `jedami-web/src/views/LoginView.vue` (NUEVO)
- `jedami-web/src/views/RegisterView.vue` (NUEVO)
