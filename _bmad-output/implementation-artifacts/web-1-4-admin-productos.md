# Story W1.4: Panel de Administración — CRUD de Productos

Status: done

## Story

Como administrador autenticado,
quiero gestionar el catálogo de productos desde la interfaz web (crear, editar, agregar variantes),
para que pueda mantener el catálogo actualizado sin tocar la base de datos directamente.

**Depende de:** BFF Stories 1.3 + 1.4 done (roles RBAC operativo + CRUD productos)

## Acceptance Criteria

1. **Given** el admin está logueado
   **When** entra a `/admin/productos`
   **Then** ve la lista de todos los productos con nombre, cantidad de variantes y botones "Editar" y "Agregar variante"

2. **Given** el admin hace click en "Nuevo producto"
   **When** completa nombre + descripción y guarda
   **Then** se llama `POST /api/v1/products` y el producto nuevo aparece en la lista sin recargar la página

3. **Given** el admin hace click en "Agregar variante" de un producto
   **When** completa `{ size, color, retailPrice, initialStock }` en el Dialog y guarda
   **Then** se llama `POST /api/v1/products/:id/variants` y la variante aparece en el detalle del producto

4. **Given** el admin hace click en "Editar" de un producto
   **When** modifica el nombre/descripción y guarda
   **Then** se llama `PUT /api/v1/products/:id` y la tabla se actualiza

5. **Given** un usuario sin rol `admin` intenta acceder a `/admin`
   **When** Vue Router evalúa el guard de ruta
   **Then** es redirigido a `/catalogo`

## Tasks / Subtasks

- [x] Task 1 — Crear `src/api/admin.api.ts` (AC: #2, #3, #4)
  - [x] createProduct, updateProduct, createVariant con tipos TypeScript

- [x] Task 2 — Crear `src/stores/admin.products.store.ts` (AC: #1, #2, #3, #4)
  - [x] fetchAll() reutiliza products.api; createProduct/updateProduct/createVariant con actualización optimista de la lista

- [x] Task 3 — Crear `src/views/admin/AdminProductsView.vue` (AC: #1, #5)
  - [x] Tabla con nombre, descripción truncada, contador variantes, botones Editar + Variante
  - [x] Guard en setup: if (!authStore.isAdmin) → router.push('/catalogo')

- [x] Task 4 — Crear `src/components/features/admin/ProductFormDialog.vue` (AC: #2, #4)
  - [x] Dialog con form nombre+descripción, modo creación/edición por prop product?
  - [x] Validación: nombre requerido para habilitar submit

- [x] Task 5 — Crear `src/components/features/admin/VariantFormDialog.vue` (AC: #3)
  - [x] Dialog con form size+color+retailPrice+initialStock
  - [x] Validaciones: todos requeridos, precio ≥ 0, stock ≥ 0

## Dev Notes

### Endpoints del BFF a consumir

```
POST /api/v1/products
  Headers: Authorization: Bearer {token}  (admin)
  Body: { name: string, description?: string }
  Response 201: { data: { id, name, description } }
  Error 403: usuario no es admin

PUT /api/v1/products/:id
  Headers: Authorization: Bearer {token}  (admin)
  Body: { name?: string, description?: string }
  Response 200: { data: { id, name, description } }

POST /api/v1/products/:id/variants
  Headers: Authorization: Bearer {token}  (admin)
  Body: { size: string, color: string, retailPrice: number, initialStock: number }
  Response 201: { data: { id, productId, size, color, retailPrice, stock: { quantity } } }

GET /api/v1/roles
  Headers: Authorization: Bearer {token}  (admin)
  Response 200: { data: [{ id, name }] }

POST /api/v1/users/:userId/roles
  Headers: Authorization: Bearer {token}  (admin)
  Body: { roleId: number }
  Response 200: { data: { userId, roleId } }
```

### Guard de admin en router

```typescript
// router/index.ts - meta: { requiresRole: 'admin' }
router.beforeEach((to, _from) => {
  const auth = useAuthStore()
  if (to.meta.requiresRole === 'admin' && !auth.isAdmin) {
    return { path: '/catalogo' }
  }
  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { path: '/login' }
  }
})
```

### Project Structure Notes

```
jedami-web/src/
├── api/
│   └── admin.api.ts                                 (NUEVO)
├── stores/
│   └── admin.products.store.ts                      (NUEVO)
├── components/
│   └── features/
│       └── admin/
│           ├── ProductFormDialog.vue                (NUEVO)
│           └── VariantFormDialog.vue                (NUEVO)
└── views/
    └── admin/
        └── AdminProductsView.vue                    (NUEVO)
```

### References

- BFF stories 1.3 + 1.4: [Source: _bmad-output/implementation-artifacts/1-3-gestion-de-roles-y-control-de-acceso.md] y [Source: _bmad-output/implementation-artifacts/1-4-crud-de-productos-con-variantes.md]
- UX Design Spec — Button hierarchy, Form patterns: [Source: _bmad-output/planning-artifacts/ux-design-specification.md#UX Consistency Patterns]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Task 1: admin.api.ts tipado con interfaces internas (no exportadas innecesariamente).
- Task 2: admin.products.store.ts con fetchAll (pageSize=100 para listar todo), actualización optimista in-place.
- Task 3: AdminProductsView.vue con tabla responsive (columna descripción hidden en mobile). AdminView.vue actualizado como hub con card navegación a /admin/productos.
- Task 4: ProductFormDialog.vue — watch open para resetear form, modo edición si prop product existe.
- Task 5: VariantFormDialog.vue — dropdowns de sizes/colors (desde API de referencia), sin precios (precios a nivel producto).
- Task 6 (nuevo): Variantes en admin display como matriz Talle×Color — input de stock por celda, × para eliminar, "Guardar cambios" por producto. `editMap` migrado de `ref<Map>` a `reactive(Map)` para reactividad correcta.
- Task 7 (nuevo): ConfirmDialog.vue — modal de confirmación reutilizable reemplaza todos los `window.confirm`. Usado para eliminar producto y eliminar variante.
- Agregada ruta /admin/productos al router con guard requiresRole: 'admin'.

### File List

- `jedami-web/src/api/admin.api.ts` (NUEVO)
- `jedami-web/src/stores/admin.products.store.ts` (NUEVO)
- `jedami-web/src/components/features/admin/ProductFormDialog.vue` (NUEVO)
- `jedami-web/src/components/features/admin/VariantFormDialog.vue` (NUEVO)
- `jedami-web/src/views/admin/AdminProductsView.vue` (NUEVO)
- `jedami-web/src/views/admin/AdminView.vue` (MODIFICADO — hub de navegación admin)
- `jedami-web/src/router/index.ts` (MODIFICADO — ruta /admin/productos)
- `jedami-web/src/views/admin/AdminProductsView.vue` (MODIFICADO — matriz variantes, ConfirmDialog, reactive editMap)
- `jedami-web/src/components/ui/ConfirmDialog.vue` (NUEVO)
