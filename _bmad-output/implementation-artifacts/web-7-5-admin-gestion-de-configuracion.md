# Story W7.5: Admin — Gestión de Tablas de Configuración

Status: done

## Story

Como administrador,
quiero gestionar los tipos de compra, tipos de cliente, talles, colores y el branding de la tienda desde el panel web,
para adaptar el sistema al negocio sin tocar la base de datos.

## Acceptance Criteria

1. **Given** el admin accede a `/admin/configuracion`
   **When** la página carga
   **Then** ve 5 secciones: Tipos de Compra, Tipos de Cliente, Talles, Colores, Branding
   **And** cada sección muestra los datos actuales editables

2. **Given** el admin agrega un nuevo tipo de compra
   **When** completa `{ code, label }` y guarda
   **Then** se llama `POST /api/v1/config/purchase-types` y aparece en la lista sin recargar

3. **Given** el admin desactiva un tipo de compra
   **When** hace click en "Desactivar"
   **Then** `PATCH /api/v1/config/purchase-types/:id` con `{ active: false }` actualiza el registro
   **And** el tipo ya no aparece en `GET /config` ni en la app

4. **Given** el admin gestiona talles o colores
   **When** agrega/edita/elimina
   **Then** se reflejan en `GET /products/sizes` y `GET /products/colors`

5. **Given** el admin edita el branding (nombre, colores, logo)
   **When** guarda los cambios
   **Then** se llama `PUT /api/v1/config/branding` y la app refleja el nuevo branding en el próximo arranque
   **And** no requiere reiniciar el BFF

6. **Given** los endpoints de mutación de config
   **When** se llaman
   **Then** todos requieren JWT con rol admin

## Tasks / Subtasks

**BFF — Endpoints CRUD:**
- [x] Agregar endpoints en `routes/config.routes.ts` protegidos con `authMiddleware + requireRole([ROLES.ADMIN])` (AC: 5)
  - [x] `GET /config/purchase-types` → listar todos (incl. inactivos, admin)
  - [x] `POST /config/purchase-types` → crear tipo de compra
  - [x] `PATCH /config/purchase-types/:id` → editar/desactivar tipo de compra
  - [x] `GET /config/customer-types` → listar todos (incl. inactivos, admin)
  - [x] `POST /config/customer-types` → crear tipo de cliente
  - [x] `PATCH /config/customer-types/:id` → editar/desactivar tipo de cliente
- [x] Crear queries en `modules/config/queries/` para cada operación (AC: 2, 3)
  - [x] `insert-purchase-type.ts`, `update-purchase-type.ts`
  - [x] `insert-customer-type.ts`, `update-customer-type.ts`
- [x] Agregar handlers en `modules/config/config.controller.ts` (AC: 2, 3)
  - [x] `listPurchaseTypes`, `createPurchaseType`, `updatePurchaseType`
  - [x] `listCustomerTypes`, `createCustomerType`, `updateCustomerType`
- [x] Agregar endpoints CRUD de sizes y colors en `products.routes.ts` (AC: 4)
  - [x] `POST /products/sizes`, `DELETE /products/sizes/:id`
  - [x] `POST /products/colors`, `DELETE /products/colors/:id`
  - [x] Handlers en `products.controller.ts`, service y repository
- [x] Agregar endpoint `PUT /config/branding` en `config.routes.ts` (AC: 5, 6)
  - [x] Handler `updateBranding` en `modules/config/config.controller.ts`
  - [x] Query `modules/config/queries/update-branding.ts`
  - [x] Actualiza fila id=1 de tabla `branding`, retorna el registro actualizado

**Web — Vista admin:**
- [x] Crear `src/api/admin.config.api.ts` con funciones CRUD para cada tabla (AC: 2, 3, 4)
- [x] Crear `src/views/admin/AdminConfigView.vue` con 5 tabs (AC: 1)
  - [x] Tab "Tipos de Compra": tabla + formulario inline de alta + toggle activo/inactivo
  - [x] Tab "Tipos de Cliente": ídem
  - [x] Tab "Talles": tabla + agregar + eliminar
  - [x] Tab "Colores": tabla + agregar (nombre + hex picker) + eliminar
  - [x] Tab "Branding": formulario con color pickers, logoUrl + botón Guardar (AC: 5)
- [x] Registrar `/admin/configuracion` en router con `{ requiresRole: ROLES.ADMIN }` (AC: 1)
- [x] Agregar tarjeta "Configuración" en `AdminView.vue` (AC: 1)

## Dev Notes

### BFF — Patrón de rutas config con auth mixto
El router `/config` actualmente es completamente público. Para los endpoints de mutación, aplicar auth a nivel de ruta individual:
```typescript
// config.routes.ts
import { authMiddleware } from '../middlewares/auth.middleware.js'
import { requireRole } from '../middlewares/role.middleware.js'
import { ROLES } from '../lib/constants.js'

router.get('/',         getConfig)          // público
router.get('/branding', getBranding)        // público
// Mutaciones protegidas:
router.post('/purchase-types',      authMiddleware, requireRole([ROLES.ADMIN]), createPurchaseType)
router.patch('/purchase-types/:id', authMiddleware, requireRole([ROLES.ADMIN]), updatePurchaseType)
router.post('/customer-types',      authMiddleware, requireRole([ROLES.ADMIN]), createCustomerType)
router.patch('/customer-types/:id', authMiddleware, requireRole([ROLES.ADMIN]), updateCustomerType)
router.put('/branding',             authMiddleware, requireRole([ROLES.ADMIN]), updateBranding)
```

### BFF — Query update-branding.ts
```typescript
export const UPDATE_BRANDING = `
  UPDATE branding
  SET store_name      = COALESCE($1, store_name),
      primary_color   = COALESCE($2, primary_color),
      secondary_color = COALESCE($3, secondary_color),
      logo_url        = $4,
      updated_at      = NOW()
  WHERE id = 1
  RETURNING store_name, primary_color, secondary_color, logo_url
`
// $1=storeName, $2=primaryColor, $3=secondaryColor, $4=logoUrl (acepta null)
```
`logo_url` no usa COALESCE para permitir que el admin borre el logo pasando `null`.

### SQL puro — patrón de queries
```typescript
// insert-purchase-type.ts
export const INSERT_PURCHASE_TYPE = `
  INSERT INTO purchase_types (code, label, active)
  VALUES ($1, $2, true)
  RETURNING id, code, label, active, icon
`
// update-purchase-type.ts
export const UPDATE_PURCHASE_TYPE = `
  UPDATE purchase_types
  SET label = COALESCE($2, label), active = COALESCE($3, active)
  WHERE id = $1
  RETURNING id, code, label, active, icon
`
```

### Invalidar caché Redis tras mutaciones
```typescript
import { cacheDel } from '../../config/redis.js'
// Al final de createPurchaseType y updatePurchaseType:
await cacheDel('config:*')  // o la key exacta si está definida en config.controller
```
Verificar si `GET /config` usa caché Redis actualmente (no estaba cacheado en la implementación inicial).

### Verificar sizes y colors
```
GET /api/v1/products/sizes   → ya existe (usado en AdminProductsView para selects)
GET /api/v1/products/colors  → ya existe
```
Verificar si existen `POST /products/sizes` y `DELETE /products/sizes/:id`. Si no, agregarlos en `products.routes.ts` + `products.controller.ts`.

### Web — patrón de tabs
Usar componentes shadcn-vue `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` (ya instalados).
```vue
<Tabs default-value="purchase-types">
  <TabsList>
    <TabsTrigger value="purchase-types">Tipos de Compra</TabsTrigger>
    <TabsTrigger value="customer-types">Tipos de Cliente</TabsTrigger>
    <TabsTrigger value="sizes">Talles</TabsTrigger>
    <TabsTrigger value="colors">Colores</TabsTrigger>
  </TabsList>
  <TabsContent value="purchase-types">...</TabsContent>
</Tabs>
```

### Invalidación del config store tras mutación
Después de un POST/PATCH de purchase-types o customer-types, llamar `configStore.loadConfig()` para refrescar el store en memoria.

### Project Structure Notes
```
jedami-bff/src/modules/config/
  config.controller.ts        ← agregar CRUD handlers + updateBranding
  queries/
    find-config.ts            ← existente
    find-branding.ts          ← existente (Story 7.3)
    insert-purchase-type.ts   ← nuevo
    update-purchase-type.ts   ← nuevo
    insert-customer-type.ts   ← nuevo
    update-customer-type.ts   ← nuevo
    update-branding.ts        ← nuevo

jedami-web/src/
  api/admin.config.api.ts     ← nuevo (CRUD purchase-types, customer-types, branding)
  views/admin/AdminConfigView.vue ← nuevo (5 tabs)
  router/index.ts             ← agregar ruta /admin/configuracion
  views/admin/AdminView.vue   ← agregar tarjeta Configuración
```

### Depende de
Stories 6.6 (tablas config en DB) y W7.1 (panel admin base) deben estar done.

### Referencias
- [Source: jedami-bff/src/modules/config/config.controller.ts]
- [Source: jedami-bff/src/routes/config.routes.ts]
- [Source: jedami-bff/src/database/migrations/018_config_tables.sql] — schema purchase_types, customer_types
- [Source: jedami-bff/src/database/migrations/020_branding.sql] — schema tabla branding
- [Source: jedami-bff/src/modules/config/queries/find-branding.ts] — patrón de query branding
- [Source: jedami-web/src/views/admin/AdminView.vue] — agregar tarjeta
- [Source: jedami-web/src/router/index.ts] — registrar ruta

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Debug Log References

### Completion Notes List
- Tabs implementados manualmente con Tailwind (shadcn Tabs no estaba instalado)
- `GET /config/purchase-types` y `GET /config/customer-types` agregados como endpoints admin para listar todos (incluye inactivos)
- El toggle activo/inactivo llama `configStore.loadConfig()` para refrescar el store en memoria tras la mutación
- Color picker doble: input type=color sincronizado con input texto hex
- `saveBranding` actualiza `configStore.branding` directamente para aplicar CSS vars en tiempo real

### File List
- jedami-bff/src/modules/config/queries/insert-purchase-type.ts
- jedami-bff/src/modules/config/queries/update-purchase-type.ts
- jedami-bff/src/modules/config/queries/insert-customer-type.ts
- jedami-bff/src/modules/config/queries/update-customer-type.ts
- jedami-bff/src/modules/config/queries/update-branding.ts
- jedami-bff/src/modules/config/config.controller.ts
- jedami-bff/src/routes/config.routes.ts
- jedami-bff/src/modules/products/products.controller.ts
- jedami-bff/src/modules/products/products.service.ts
- jedami-bff/src/modules/products/products.repository.ts
- jedami-bff/src/routes/products.routes.ts
- jedami-web/src/api/admin.config.api.ts
- jedami-web/src/views/admin/AdminConfigView.vue
- jedami-web/src/router/index.ts
- jedami-web/src/views/admin/AdminView.vue
