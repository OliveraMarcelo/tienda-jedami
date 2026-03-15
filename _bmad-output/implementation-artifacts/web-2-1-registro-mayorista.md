# Story W2.1: Registro Mayorista y Perfil Customer

Status: done

## Story

Como comprador mayorista,
quiero registrarme como mayorista y ver mi perfil con el tipo de cliente correcto,
para que el sistema me habilite a comprar en las modalidades mayoristas.

**Depende de:** BFF Story 2.1 done

## Acceptance Criteria

1. **Given** el form de registro tiene un selector visual de tipo (🛍️ Minorista / 🏭 Mayorista)
   **When** el usuario elige "Mayorista" y completa el registro
   **Then** el BFF asigna el rol `wholesale` y crea el customer con `customer_type = 'wholesale'` automáticamente — sin intervención del admin
   **And** el `authStore.viewMode` se inicializa en `'wholesale'` y el `ModeIndicator` muestra "🏭 Mayorista"

2. **Given** el mayorista está logueado
   **When** accede a `/perfil`
   **Then** ve: email, roles, y `customer: { id, customerType: 'wholesale' }` con el badge mayorista destacado

3. **Given** el `authStore.mode === 'wholesale'`
   **When** el usuario navega el catálogo
   **Then** el label de precio es "Precio mayorista" y el CTA de compra es "Agregar al pedido"

## Tasks / Subtasks

- [x] Task 1 — Actualizar `RegisterView.vue` con selector de tipo de cliente (AC: #1)
  - [x] Selector visual con tarjetas (🛍️ Minorista / 🏭 Mayorista), sin `Select` de shadcn
  - [x] Envía `customerType` al BFF en el body del registro
  - [x] BFF asigna rol automáticamente — no requiere paso de admin
  - [x] BFF: `auth.controller` lee `customerType`, `auth.service` lo pasa a `createCustomer` y asigna rol dinámico
  - [x] `auth.api.ts`: `registerApi` incluye `customerType` en el POST
  - [x] `auth.store.ts`: `register()` acepta `customerType`

- [ ] Task 2 — Crear `src/api/profile.api.ts` (AC: #2)
  - [ ] `fetchMe()`: GET `/me` → `{ data: { id, email, roles, customer: { id, customerType } } }`

- [ ] Task 3 — Crear `src/views/ProfileView.vue` (AC: #2)
  - [ ] Muestra email, roles como badges, customerType con color según tipo
  - [ ] Ruta `/perfil` con `meta: { requiresAuth: true }`

## Dev Notes

### Endpoint del BFF a consumir

```
GET /api/v1/me
  Headers: Authorization: Bearer {token}
  Response 200: { data: { id, email, roles: string[], customer: { id, customerType: 'retail' | 'wholesale' } } }
```

**Flujo de registro self-service (implementado):**
El usuario elige `customerType` ('retail' | 'wholesale') en el formulario. El BFF recibe el campo, crea el customer con ese tipo y asigna el rol correspondiente en un solo paso. No se requiere admin. El JWT devuelto tras el auto-login ya contiene los roles correctos.

`auth.store.viewMode` se inicializa desde localStorage; si no hay preferencia guardada, se deduce del rol al hacer login (wholesale → 'wholesale', retail → 'retail').

### References

- BFF story 2.1: [Source: _bmad-output/planning-artifacts/epics.md#Story 2.1]
- W1.2 (auth store + register form): [Source: _bmad-output/implementation-artifacts/web-1-2-auth-pages.md]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Task 1: RegisterView actualizado con selector visual de tipo retail/wholesale (tarjetas con iconos). Flow self-service: BFF asigna rol y customer_type sin intervención de admin. auth.api, auth.store y auth.controller/service actualizados.
- Task 2: `src/api/profile.api.ts` creado con fetchMe() tipado.
- Task 3: `ProfileView.vue` en `/perfil` con email, roles como badges de colores y customerType con badge colorido. Link agregado en AppLayout.

### File List

- `jedami-web/src/views/RegisterView.vue` (MODIFICADO — selector customerType)
- `jedami-web/src/api/profile.api.ts` (NUEVO)
- `jedami-web/src/views/ProfileView.vue` (NUEVO)
- `jedami-web/src/router/index.ts` (MODIFICADO — ruta /perfil)
- `jedami-web/src/layouts/AppLayout.vue` (MODIFICADO — link Mi perfil)
