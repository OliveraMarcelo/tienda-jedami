# Story W2.1: Registro Mayorista y Perfil Customer

Status: review

## Story

Como comprador mayorista,
quiero registrarme como mayorista y ver mi perfil con el tipo de cliente correcto,
para que el sistema me habilite a comprar en las modalidades mayoristas.

**Depende de:** BFF Story 2.1 done (registro crea customer + update customerType al asignar rol wholesale)

## Acceptance Criteria

1. **Given** el form de registro tiene un selector "Tipo de cliente"
   **When** el usuario elige "Soy mayorista" y completa el registro
   **Then** el `authStore.mode` cambia a `'wholesale'` y el `ModeIndicator` muestra "🏭 Mayorista"

2. **Given** el mayorista está logueado
   **When** accede a `/perfil`
   **Then** ve: email, roles, y `customer: { id, customerType: 'wholesale' }` con el badge mayorista destacado

3. **Given** el `authStore.mode === 'wholesale'`
   **When** el usuario navega el catálogo
   **Then** el label de precio es "Precio mayorista" y el CTA de compra es "Agregar al pedido"

## Tasks / Subtasks

- [ ] Task 1 — Actualizar `RegisterView.vue` con selector de tipo de cliente (AC: #1)
  - [ ] Agregar `Select` de shadcn-vue con opciones: "Soy minorista" / "Soy mayorista"
  - [ ] Al registrarse como mayorista: el BFF crea el user → admin asigna rol wholesale → `customerType` se actualiza
  - [ ] El `authStore.mode` se deriva del token JWT (roles del payload)

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

**Nota sobre el flujo de activación mayorista:**
El registro inicial crea al usuario con `customerType: 'retail'`. Para ser mayorista, un admin debe asignar el rol `wholesale` via `POST /api/v1/users/:userId/roles`. Esto actualiza `customerType` a `'wholesale'` automáticamente en el BFF (Story 2.1).

En la UI: el `authStore.mode` se deriva de los roles en el JWT. Después de que el admin asigne el rol, el usuario debe hacer logout/login para obtener un nuevo token con los roles actualizados.

### References

- BFF story 2.1: [Source: _bmad-output/planning-artifacts/epics.md#Story 2.1]
- W1.2 (auth store + register form): [Source: _bmad-output/implementation-artifacts/web-1-2-auth-pages.md]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Task 1: RegisterView actualizado con selector de tipo retail/wholesale. Selector visual con botones toggle. Nota informativa cuando elige wholesale sobre activación por admin.
- Task 2: `src/api/profile.api.ts` creado con fetchMe() tipado.
- Task 3: `ProfileView.vue` en `/perfil` con email, roles como badges de colores y customerType con badge colorido. Link agregado en AppLayout.

### File List

- `jedami-web/src/views/RegisterView.vue` (MODIFICADO — selector customerType)
- `jedami-web/src/api/profile.api.ts` (NUEVO)
- `jedami-web/src/views/ProfileView.vue` (NUEVO)
- `jedami-web/src/router/index.ts` (MODIFICADO — ruta /perfil)
- `jedami-web/src/layouts/AppLayout.vue` (MODIFICADO — link Mi perfil)
