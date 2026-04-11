# Story 14.4: Limpiar Nullabilidad en `order_items`

Status: backlog

## Contexto

`order_items` cubre 3 escenarios distintos con lógica de nullabilidad compleja:

| Campo | Retail | Cantidad | Curva pre-despacho | Curva post-despacho |
|---|---|---|---|---|
| `variant_id` | ✅ NOT NULL | ✅ NOT NULL | ❌ NULL | ✅ NOT NULL |
| `product_id` | redundante* | ✅ | ✅ | redundante* |
| `size_id` | ❌ NULL | ❌ NULL | ✅ NOT NULL | redundante** |

*`product_id` se puede obtener via `variants.product_id` cuando `variant_id` está presente
**`size_id` se puede obtener via `variants.size_id` cuando `variant_id` está presente

Esto obliga a todas las queries a manejar NULLs en columnas que "no deberían" serlo para ciertos tipos de pedido, sin que la DB lo pueda garantizar.

## Story

Como desarrollador,
quiero que `order_items` tenga una estructura más clara que refleje las reglas de negocio de cada tipo de pedido,
para eliminar NULLs innecesarios, reducir redundancia y hacer las queries más simples y seguras.

## Acceptance Criteria

1. **Given** un ítem de pedido retail o cantidad
   **When** se inserta en la DB
   **Then** `variant_id` es NOT NULL y `product_id` se deriva del variant (no se almacena)

2. **Given** un ítem de pedido curva pre-despacho
   **When** se inserta en la DB
   **Then** `product_id` y `size_id` son NOT NULL, `variant_id` es NULL

3. **Given** un ítem de pedido curva post-despacho (color asignado)
   **When** se actualiza en la DB
   **Then** `variant_id` es NOT NULL y `size_id` se puede derivar del variant

4. **Given** cualquier query que necesite el `product_id` de un ítem con `variant_id`
   **When** se ejecuta
   **Then** usa JOIN a `variants` en lugar de leer `order_items.product_id`

5. **Given** los datos existentes en `order_items`
   **When** se ejecuta la migración
   **Then** todos los registros existentes son consistentes con la nueva estructura

## Tasks / Subtasks

### Análisis previo (ANTES de migrar)
- [ ] Auditar datos existentes:
  ```sql
  -- Ítems con variant_id que también tienen product_id (redundante)
  SELECT COUNT(*) FROM order_items WHERE variant_id IS NOT NULL AND product_id IS NOT NULL;

  -- Ítems curva pre-despacho (sin variant, con product_id y size_id)
  SELECT COUNT(*) FROM order_items WHERE variant_id IS NULL AND product_id IS NOT NULL AND size_id IS NOT NULL;

  -- Ítems con inconsistencias
  SELECT * FROM order_items WHERE variant_id IS NULL AND product_id IS NULL;
  ```

### Migration `053_order_items_cleanup.sql`
- [ ] Limpiar `product_id` redundante en ítems que ya tienen `variant_id`:
  ```sql
  -- product_id es redundante cuando variant_id está presente
  UPDATE order_items oi
  SET product_id = NULL
  WHERE variant_id IS NOT NULL;
  ```

- [ ] Agregar CHECK constraint que refleje las reglas de negocio:
  ```sql
  ALTER TABLE order_items ADD CONSTRAINT order_items_consistency_check
    CHECK (
      -- Tiene variante (retail / cantidad / curva post-despacho): product_id debe ser NULL
      (variant_id IS NOT NULL AND product_id IS NULL)
      OR
      -- Sin variante (curva pre-despacho): debe tener product_id y size_id
      (variant_id IS NULL AND product_id IS NOT NULL AND size_id IS NOT NULL)
    );
  ```

### BFF — adaptar queries
- [ ] Todas las queries que lean `order_items.product_id` para ítems con `variant_id` deben hacer JOIN a `variants`:
  ```sql
  SELECT
    oi.id,
    COALESCE(v.product_id, oi.product_id) AS product_id,
    ...
  FROM order_items oi
  LEFT JOIN variants v ON v.id = oi.variant_id
  ```

- [ ] Revisar `orders.service.ts`, `admin.controller.ts`, `products.repository.ts` para queries afectadas

### BFF — adaptar inserts
- [ ] En `createRetailOrder` y `addCantidadItems`: al insertar `order_items`, no pasar `product_id` (ya es NULL)
- [ ] En `addCurvaItems`: ya pasa `product_id` y `size_id` correctamente, no pasa `variant_id` ✓

## Dev Notes

### Impacto en queries existentes
El campo más usado es `order_items.product_id` en las queries de admin (despacho curva, dashboard). Revisar especialmente:
- `PENDING_FULFILLMENT_QUERY` — ya usa JOIN a variants para obtener product info
- `FIND_ORDER_ITEMS` — puede estar leyendo `product_id` directamente

### CHECK constraint como documentación viva
El CHECK no solo previene datos inválidos — documenta explícitamente las dos variantes válidas de un `order_item` directamente en el schema.

### Migración incremental recomendada
1. Ejecutar auditoría para confirmar estado actual
2. Aplicar UPDATE para limpiar `product_id` redundante
3. Aplicar CHECK constraint
4. Actualizar código BFF
5. Verificar en staging antes de producción

### Referencias
- [Source: jedami-bff/src/database/migrations/006_customers_orders.sql]
- [Source: jedami-bff/src/database/migrations/026_order_items_size_id.sql]
- [Source: jedami-bff/src/modules/orders/orders.service.ts]
- [Source: jedami-bff/src/modules/admin/admin.controller.ts]
- [Source: jedami-bff/src/modules/admin/queries/pending-fulfillment.ts]

## Dev Agent Record

### Agent Model Used
### Debug Log References
### Completion Notes List
### File List
