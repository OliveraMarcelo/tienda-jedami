# Story web-2.7: Descuentos por Volumen — Frontend Web

**Épica:** 2 — Compra Mayorista
**Track:** WEB (jedami-web)
**Status:** done
**Depende de:** 2-7-descuentos-por-volumen-cantidad (done)

## Contexto

Una vez que el BFF aplica descuentos automáticamente y los persiste en `order_items` (`discount_pct`, `original_unit_price`), el frontend debe:

1. Mostrar los escalones disponibles en la página de producto (para que el comprador sepa qué descuento obtendrá)
2. Mostrar el desglose del descuento en el checkout y en el detalle de pedido
3. Dar al admin una UI para gestionar los escalones y el mínimo de compra de cada producto

## Story

Como comprador mayorista,
quiero ver los descuentos por volumen disponibles para cada producto y el desglose en mi pedido,
para tomar decisiones informadas sobre la cantidad a comprar.

Como administrador,
quiero gestionar los escalones de descuento desde el panel de productos,
para configurar incentivos sin intervención técnica.

## Acceptance Criteria

1. **Given** un producto tiene escalones de descuento activos
   **When** el comprador lo ve en el catálogo o la página de detalle
   **Then** se muestra una tabla con los escalones: "desde X unidades → Y% off"

2. **Given** el comprador agrega ítems con descuento al pedido
   **When** ve el resumen del pedido
   **Then** cada ítem muestra precio original tachado, porcentaje de descuento aplicado y precio final

3. **Given** el comprador consulta el detalle de un pedido con descuentos
   **When** abre el pedido
   **Then** cada ítem con `discount_pct > 0` muestra el desglose completo (precio base, %, precio final)

4. **Given** el admin abre el formulario de edición de un producto
   **When** navega a la sección de descuentos
   **Then** ve el mínimo de compra configurado y los escalones de cantidad y curva

5. **Given** el admin agrega un nuevo escalón de descuento
   **When** completa el formulario y guarda
   **Then** el escalón aparece en la lista sin recargar la página; feedback visual de éxito

6. **Given** el admin intenta crear un escalón con `min_quantity` ya existente
   **When** guarda
   **Then** muestra error "Ya existe un escalón con esa cantidad mínima"

7. **Given** el admin elimina un escalón
   **When** confirma la eliminación
   **Then** el escalón desaparece de la lista

## Tasks / Subtasks

### Task 1 — API Client `discounts.api.ts`
- [x] Crear `src/api/discounts.api.ts` con:
  - `getPublicDiscountRules(productId)` → `GET /api/v1/products/:id/discount-rules`
  - `getAdminDiscountRules(productId)` → `GET /api/v1/admin/products/:id/discount-rules`
  - `createQuantityRule(productId, dto)` → `POST /api/v1/admin/products/:id/discount-rules/quantity`
  - `updateQuantityRule(productId, ruleId, dto)` → `PATCH .../quantity/:ruleId`
  - `deleteQuantityRule(productId, ruleId)` → `DELETE .../quantity/:ruleId`
  - `createCurvaRule(productId, dto)` → `POST .../curva`
  - `updateCurvaRule(productId, ruleId, dto)` → `PATCH .../curva/:ruleId`
  - `deleteCurvaRule(productId, ruleId)` → `DELETE .../curva/:ruleId`
  - `updateProductMinQuantity(productId, minQuantity)` → `PATCH /api/v1/admin/products/:id/min-quantity`

### Task 2 — Componente `DiscountRulesTable.vue` (público)
- [x] Props: `quantityRules: QuantityDiscountRule[]`, `curvaRules: CurvaDiscountRule[]`, `minQuantity?: number`
- [x] Mostrar:
  - Si `minQuantity` está definido: badge "Mínimo de compra: N unidades"
  - Tabla de cantidad: columnas "Desde (unidades)" | "Descuento"
  - Tabla de curva: columnas "Desde (curvas)" | "Descuento"
  - Si no hay escalones: no renderizar el componente
- [x] Uso: en la página de detalle del producto (modalidad mayorista)

### Task 3 — Integración en `ProductDetailView.vue` o componente de checkout mayorista
- [x] Al cargar el producto, llamar `getPublicDiscountRules(productId)` y pasar al componente `DiscountRulesTable.vue`
- [x] En el input de cantidad, mostrar hint dinámico: "Con X unidades obtenés Y% off" al detectar el escalón aplicable

### Task 4 — Desglose de descuento en ítems del pedido
- [x] En el componente de ítem de pedido (checkout + detalle de pedido), si `discount_pct > 0`:
  - Mostrar precio original tachado: `original_unit_price`
  - Badge de descuento: `"-{discount_pct}%"`
  - Precio final en verde: `unit_price`
- [x] Si `discount_pct === 0`: mostrar solo `unit_price` (comportamiento actual)

### Task 5 — Admin: sección de descuentos en formulario de producto
- [x] En `AdminProductsView.vue` + nuevo componente `AdminProductDiscounts.vue`, agregar sección "Descuentos por volumen":
  - Campo "Mínimo de compra (unidades)": input numérico + botón guardar → `updateProductMinQuantity`
  - Sub-sección "Escalones por cantidad": lista de escalones con botones eliminar + formulario inline para agregar
  - Sub-sección "Escalones por curva": ídem
- [x] Formulario de escalón: campos `min_quantity` (o `min_curves`) + `discount_pct` + botón "Agregar"
- [x] Feedback visual (toast) en cada operación

### Task 6 — Tipos TypeScript
- [x] Agregar a `src/types/api.ts`:
  ```typescript
  export interface QuantityDiscountRule {
    id: number; product_id: number; min_quantity: number;
    discount_pct: number; active: boolean;
  }
  export interface CurvaDiscountRule {
    id: number; product_id: number; min_curves: number;
    discount_pct: number; active: boolean;
  }
  ```
- [x] Actualizar `OrderItem` para incluir `discountPct: number`, `originalUnitPrice: number | null`

## Dev Notes

### Sin mocks
El frontend solo se implementa después de que `2-7` esté done y la API real esté disponible.

### Hint dinámico de descuento
En el input de cantidad del checkout mayorista (modalidad CANTIDAD), se puede mostrar el escalón que se activaría con la cantidad actual. Calcular client-side usando los escalones ya cargados de `getPublicDiscountRules`.

### Componente de ítem reutilizable
El desglose de descuento debe funcionar tanto en el resumen del checkout como en `MisOpedidos` y el detalle del pedido. Centralizar en un componente `OrderItemRow.vue` o similar.

### Referencias
- [Depende de: `2-7-descuentos-por-volumen-cantidad.md`]
- [Source: jedami-web/src/api/]
- [Source: jedami-web/src/views/]
- [Source: jedami-web/src/components/]

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Debug Log References
Sin incidencias. TypeScript y ESLint sin errores.

### Completion Notes List
- Task 6 implementada primero (tipos TS) como base para el resto
- `OrderItem` en `orders.api.ts` extendido con `discountPct` y `originalUnitPrice`
- `DiscountRulesTable.vue`: componente público reutilizable que muestra escalones cantidad/curva + badge de mínimo
- `ProductView.vue`: carga escalones en `onMounted`, hint dinámico reactivo al input de cantidad, tabla de descuentos visible en tabs mayorista
- `OrderDetailView.vue`: precio original tachado + badge de porcentaje cuando `discountPct > 0`
- Admin: componente `AdminProductDiscounts.vue` con panel inline en `AdminProductsView.vue` (botón "Descuentos" por producto)
- Manejo de 409 (escalón duplicado) con mensaje específico en admin

### File List
- `jedami-web/src/api/discounts.api.ts` (nuevo)
- `jedami-web/src/types/api.ts` (modificado — QuantityDiscountRule, CurvaDiscountRule)
- `jedami-web/src/api/orders.api.ts` (modificado — OrderItem + discountPct/originalUnitPrice)
- `jedami-web/src/components/features/catalog/DiscountRulesTable.vue` (nuevo)
- `jedami-web/src/components/features/admin/AdminProductDiscounts.vue` (nuevo)
- `jedami-web/src/views/ProductView.vue` (modificado — integración escalones + hint)
- `jedami-web/src/views/OrderDetailView.vue` (modificado — desglose descuento en items)
- `jedami-web/src/views/admin/AdminProductsView.vue` (modificado — panel descuentos inline)
- `_bmad-output/implementation-artifacts/web-2-7-descuentos-por-volumen-cantidad.md` (status → review)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (web-2-7 → review)
