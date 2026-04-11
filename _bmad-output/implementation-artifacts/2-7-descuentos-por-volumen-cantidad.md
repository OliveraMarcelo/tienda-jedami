# Story 2.7: Descuentos por Volumen y Mínimo de Compra — BFF

**Épica:** 2 — Compra Mayorista
**Track:** BFF (jedami-bff)
**Status:** done
**Depende de:** 2-4-compra-mayorista-por-cantidad (done), 2-3-compra-mayorista-por-curva (done), 6-6-tablas-de-configuracion (done)

## Contexto

El sistema de órdenes mayoristas no aplica ningún descuento por volumen. Esta story agrega:

- **Mínimo de compra** por producto en modalidad `CANTIDAD` (ej. mínimo 50u)
- **Escalones de descuento por cantidad** (ej. 50u → 10%, 100u → 20%)
- **Escalones de descuento por número de curvas** (ej. 10 curvas → 15% off)

El descuento se calcula en el momento de agregar ítems al pedido y se persiste desglosado en `order_items` (`discount_pct`, `original_unit_price`). Los pedidos existentes no se ven afectados.

## Story

Como comprador mayorista,
quiero que el sistema aplique automáticamente el descuento por volumen correspondiente al agregar ítems a mi pedido,
para pagar el precio real según las reglas configuradas por el administrador.

Como administrador,
quiero configurar mínimos de compra y escalones de descuento por producto,
para incentivar compras de mayor volumen sin intervención manual.

## Acceptance Criteria

1. **Given** el admin configura un mínimo de compra de 50u para un producto
   **When** un comprador mayorista intenta agregar 30u en modalidad CANTIDAD
   **Then** el BFF retorna 422 con mensaje `"Cantidad mínima de compra: 50 unidades"`

2. **Given** el producto tiene escalones: 50u→10%, 100u→20%
   **When** el comprador agrega 80u
   **Then** se aplica el 10% (mayor escalón ≤ 80), `unit_price = wholesale_price * 0.90`, `original_unit_price = wholesale_price`, `discount_pct = 10.00`

3. **Given** el producto tiene escalones de curva: 5 curvas→5%, 10 curvas→15%
   **When** el comprador agrega 12 curvas
   **Then** se aplica el 15% (mayor escalón ≤ 12) sobre el `wholesale_price`

4. **Given** el producto no tiene escalones configurados
   **When** el comprador agrega ítems
   **Then** el comportamiento es igual al actual: `unit_price = wholesale_price`, `discount_pct = 0`, `original_unit_price = NULL`

5. **Given** el admin crea un escalón de descuento para un producto
   **When** llama a `POST /api/v1/admin/products/:id/discount-rules/quantity`
   **Then** el escalón persiste y retorna 201 con el escalón creado

6. **Given** el admin intenta crear un escalón duplicado (mismo `product_id` + `min_quantity`)
   **When** llama al endpoint
   **Then** retorna 409 con mensaje de conflicto

7. **Given** el admin elimina un escalón
   **When** llama a `DELETE /api/v1/admin/products/:id/discount-rules/quantity/:ruleId`
   **Then** el escalón se elimina; pedidos existentes no se ven afectados

8. **Given** un comprador consulta `GET /api/v1/products/:id/discount-rules`
   **When** el producto tiene escalones activos
   **Then** retorna los escalones de cantidad y curva activos (sin autenticación)

## Tasks / Subtasks

### Task 1 — Migración SQL `038_discount_rules.sql`
- [ ] Crear tabla `quantity_discount_rules`:
  ```sql
  CREATE TABLE quantity_discount_rules (
    id           SERIAL PRIMARY KEY,
    product_id   INT           NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    min_quantity INT           NOT NULL CHECK (min_quantity > 0),
    discount_pct NUMERIC(5,2) NOT NULL CHECK (discount_pct > 0 AND discount_pct < 100),
    active       BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    UNIQUE (product_id, min_quantity)
  );
  CREATE INDEX idx_qdr_product_active ON quantity_discount_rules(product_id, active);
  ```
- [ ] Crear tabla `curva_discount_rules`:
  ```sql
  CREATE TABLE curva_discount_rules (
    id           SERIAL PRIMARY KEY,
    product_id   INT           NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    min_curves   INT           NOT NULL CHECK (min_curves > 0),
    discount_pct NUMERIC(5,2) NOT NULL CHECK (discount_pct > 0 AND discount_pct < 100),
    active       BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    UNIQUE (product_id, min_curves)
  );
  CREATE INDEX idx_cdr_product_active ON curva_discount_rules(product_id, active);
  ```
- [ ] Agregar `min_quantity_purchase` a `products`:
  ```sql
  ALTER TABLE products ADD COLUMN min_quantity_purchase INT DEFAULT NULL
    CHECK (min_quantity_purchase IS NULL OR min_quantity_purchase > 0);
  ```
- [ ] Agregar columnas de descuento a `order_items`:
  ```sql
  ALTER TABLE order_items ADD COLUMN discount_pct        NUMERIC(5,2)  NOT NULL DEFAULT 0;
  ALTER TABLE order_items ADD COLUMN original_unit_price NUMERIC(12,2) DEFAULT NULL;
  ```

### Task 2 — Módulo `modules/discounts/` — Entidades y queries
- [ ] Crear `modules/discounts/discounts.entity.ts`:
  ```typescript
  export interface QuantityDiscountRule {
    id: number; product_id: number; min_quantity: number;
    discount_pct: number; active: boolean; created_at: Date;
  }
  export interface CurvaDiscountRule {
    id: number; product_id: number; min_curves: number;
    discount_pct: number; active: boolean; created_at: Date;
  }
  ```
- [ ] Crear query files en `modules/discounts/queries/`:
  - `find-quantity-rules-by-product.ts` — `SELECT ... WHERE product_id = $1 AND active = TRUE ORDER BY min_quantity`
  - `find-curva-rules-by-product.ts` — ídem para `curva_discount_rules`
  - `find-all-rules-by-product.ts` — ambas tablas (para endpoint admin)
  - `find-applicable-quantity-rule.ts` — `SELECT ... WHERE product_id = $1 AND min_quantity <= $2 AND active = TRUE ORDER BY min_quantity DESC LIMIT 1`
  - `find-applicable-curva-rule.ts` — ídem con `min_curves`
  - `create-quantity-rule.ts`
  - `update-quantity-rule.ts`
  - `delete-quantity-rule.ts`
  - `create-curva-rule.ts`
  - `update-curva-rule.ts`
  - `delete-curva-rule.ts`
  - `update-product-min-quantity.ts` — `UPDATE products SET min_quantity_purchase = $1 WHERE id = $2`

### Task 3 — `modules/discounts/discounts.repository.ts`
- [ ] Implementar todos los métodos usando los query files del Task 2
- [ ] `getApplicableQuantityRule(productId, quantity)` → `QuantityDiscountRule | null`
- [ ] `getApplicableCurvaRule(productId, curves)` → `CurvaDiscountRule | null`

### Task 4 — `modules/discounts/discounts.service.ts`
- [ ] `getPublicRules(productId)` — retorna `{ quantityRules, curvaRules }` solo activos
- [ ] `getAllRules(productId)` — retorna ambas listas (activos + inactivos, para admin)
- [ ] `createQuantityRule(productId, dto)` — valida duplicado, persiste; 409 si existe
- [ ] `updateQuantityRule(productId, ruleId, dto)`
- [ ] `deleteQuantityRule(productId, ruleId)` — verifica que el ruleId pertenezca al producto
- [ ] `createCurvaRule(productId, dto)` — igual para curva
- [ ] `updateCurvaRule(productId, ruleId, dto)`
- [ ] `deleteCurvaRule(productId, ruleId)`
- [ ] `updateProductMinQuantity(productId, minQuantity)` — `null` desactiva el mínimo
- [ ] `applyQuantityDiscount(productId, quantity, wholesalePrice)` → `{ finalPrice, discountPct, originalPrice } | null`
- [ ] `applyCurvaDiscount(productId, curves, wholesalePrice)` → `{ finalPrice, discountPct, originalPrice } | null`

### Task 5 — `modules/discounts/discounts.controller.ts` y routes
- [ ] `GET  /api/v1/products/:id/discount-rules` → `getPublicRules` (público, sin auth)
- [ ] `GET  /api/v1/admin/products/:id/discount-rules` → `getAllRules` (admin)
- [ ] `POST /api/v1/admin/products/:id/discount-rules/quantity` → `createQuantityRule`
- [ ] `PATCH /api/v1/admin/products/:id/discount-rules/quantity/:ruleId` → `updateQuantityRule`
- [ ] `DELETE /api/v1/admin/products/:id/discount-rules/quantity/:ruleId` → `deleteQuantityRule`
- [ ] `POST /api/v1/admin/products/:id/discount-rules/curva` → `createCurvaRule`
- [ ] `PATCH /api/v1/admin/products/:id/discount-rules/curva/:ruleId` → `updateCurvaRule`
- [ ] `DELETE /api/v1/admin/products/:id/discount-rules/curva/:ruleId` → `deleteCurvaRule`
- [ ] `PATCH /api/v1/admin/products/:id/min-quantity` → `updateProductMinQuantity`
- [ ] Registrar rutas en `routes/index.ts`

### Task 6 — Extensión de `orders.service.ts`
- [ ] `addCantidadItems()`: antes de insertar el ítem, verificar `min_quantity_purchase`:
  ```typescript
  if (product.min_quantity_purchase && quantity < product.min_quantity_purchase) {
    throw new AppError(422, `Cantidad mínima de compra: ${product.min_quantity_purchase} unidades`, ...)
  }
  ```
- [ ] `addCantidadItems()`: llamar `discountsService.applyQuantityDiscount(productId, quantity, wholesalePrice)` y usar el resultado en el INSERT de `order_items` (campos `discount_pct`, `original_unit_price`)
- [ ] `addCurvaItems()`: llamar `discountsService.applyCurvaDiscount(productId, curves, wholesalePrice)` ídem
- [ ] El INSERT de `order_items` debe incluir las dos nuevas columnas; si no hay descuento, `discount_pct = 0`, `original_unit_price = NULL`
- [ ] La respuesta de `getOrderById()` / `find-order.ts` debe incluir `discount_pct`, `original_unit_price` en los ítems

### Task 7 — Tests de integración (Vitest)
- [ ] `POST /admin/products/:id/discount-rules/quantity` crea escalón correctamente
- [ ] `POST /admin/products/:id/discount-rules/quantity` con `min_quantity` duplicado → 409
- [ ] `GET /products/:id/discount-rules` retorna escalones activos
- [ ] Pedido CANTIDAD con `quantity < min_quantity_purchase` → 422
- [ ] Pedido CANTIDAD con escalón aplicable → `discount_pct` y `original_unit_price` correctos en `order_items`
- [ ] Pedido CANTIDAD sin escalones → `discount_pct = 0`, `original_unit_price = NULL`
- [ ] Pedido CURVA con escalón aplicable → descuento correcto

## Dev Notes

### Sin tocar `unit_price` directamente en el escalón
El campo `unit_price` en `order_items` guarda el precio final ya descontado (para que el `total_amount` del pedido sea correcto). `original_unit_price` guarda el precio base. `discount_pct` guarda el porcentaje aplicado para display.

### Query de `find-order.ts` — actualizar SELECT
Agregar `oi.discount_pct, oi.original_unit_price` al SELECT de la query que trae los ítems de un pedido.

### `min_quantity_purchase` en `products`
El SELECT de productos debe incluir el nuevo campo. Verificar `find-product-by-id.ts` y agregar la columna.

### Pedidos existentes
Los pedidos anteriores tienen `discount_pct = 0` (DEFAULT) y `original_unit_price = NULL` — comportamiento correcto.

### Validación en el service, no en la query
Los valores válidos (`discount_pct` entre 0 y 100, `min_quantity > 0`) se validan a nivel de CHECK constraint en DB y también en el service para dar errores legibles (AppError 400).

### Referencias
- [Source: jedami-bff/src/modules/orders/orders.service.ts]
- [Source: jedami-bff/src/modules/orders/queries/]
- [Source: jedami-bff/src/database/migrations/006_customers_orders.sql]
- [Design doc: _bmad-output/implementation-artifacts/2-6-descuentos-por-volumen-cantidad.md]

## Dev Agent Record

### Agent Model Used
### Debug Log References
### Completion Notes List
### File List
