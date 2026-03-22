# Story 16.1: Despacho Unificado — BFF

Status: review

## Story

Como administrador,
quiero poder marcar un pedido como despachado (independientemente de actualizar el stock)
para registrar que el pedido fue entregado a Via Cargo o retirado en el local,
y actualizar el stock después cuando tenga tiempo.

## Acceptance Criteria

1. **Given** la migración se ejecuta
   **Then** `orders.status` acepta el valor `'shipped'`
   **And** existe columna `shipped_at TIMESTAMPTZ` en `orders`

2. **Given** se llama `POST /admin/orders/:id/dispatch`
   **When** el pedido existe y tiene status `paid`
   **Then** el status cambia a `shipped` y `shipped_at = NOW()`
   **And** retorna `{ orderId, status: 'shipped', shippedAt }`

3. **Given** se llama `GET /admin/orders/pending-fulfillment`
   **Then** retorna pedidos `paid` con `purchase_type` en (`curva`, `cantidad`, `menor`)
   **And** cada pedido incluye `purchaseType` en la respuesta
   **And** ítems de curva/cantidad (`variant_id IS NULL`) incluyen `availableVariants` con stock
   **And** ítems de menor (`variant_id IS NOT NULL`) incluyen la variante asignada (color, talle) sin `availableVariants`

4. **Given** se llama `PATCH /admin/orders/:orderId/items/:itemId/fulfill`
   **When** body incluye `{ variantId, decrementStock: false }` (default)
   **Then** solo asigna `variant_id` al ítem sin descontar stock

5. **Given** se llama `PATCH /admin/orders/:orderId/items/:itemId/fulfill`
   **When** body incluye `{ variantId, decrementStock: true }`
   **Then** asigna `variant_id` Y descuenta stock (comportamiento anterior)

6. **Given** se llama `PATCH /admin/orders/:orderId/items/:itemId/decrement-stock`
   **When** el ítem ya tiene `variant_id` asignado
   **Then** descuenta `quantity` del stock de esa variante
   **And** retorna `{ itemId, variantId, stockRemaining }`

## Tasks / Subtasks

- [x] **Migration `037_shipped_status.sql`**
  - Agregar `'shipped'` al CHECK constraint de `orders.status`
  - Agregar columna `shipped_at TIMESTAMPTZ`

- [x] **`pending-fulfillment.ts`** — reescribir query:
  - Incluir `curva`, `cantidad` (items con `variant_id IS NULL`) con available variants
  - Incluir `menor` (items con `variant_id IS NOT NULL`) con variant asignada (color, hex, size)
  - Agregar `purchase_type` al SELECT de orders
  - Filtrar: `o.status = 'paid'` (no `shipped`)

- [x] **`admin.controller.ts`** — `getPendingFulfillment`:
  - Agregar `purchaseType` al agrupamiento de pedidos
  - Para ítems de menor: agregar campo `variantAssigned: true` y datos de la variante asignada
  - Para ítems de curva/cantidad: mantener `availableVariants`

- [x] **`admin.controller.ts`** — `fulfillOrderItem`:
  - Leer `decrementStock` del body (default `false`)
  - Si `decrementStock === false`: solo asignar `variant_id`, no tocar stock
  - Si `decrementStock === true`: comportamiento actual (asignar + descontar)
  - Permitir despacho desde status `paid` O `shipped` (por si quiere asignar variante después)

- [x] **`admin.controller.ts`** — nueva función `dispatchOrder`:
  - Verificar que el pedido existe y está en `paid`
  - `UPDATE orders SET status = 'shipped', shipped_at = NOW() WHERE id = $1`
  - Retornar `{ orderId, status: 'shipped', shippedAt }`

- [x] **`admin.controller.ts`** — nueva función `decrementItemStock`:
  - Verificar que el ítem tiene `variant_id` asignado
  - `UPDATE stock SET quantity = quantity - item.quantity WHERE variant_id = $1 AND quantity >= item.quantity`
  - Retornar `{ itemId, variantId, stockRemaining }`

- [x] **`admin.routes.ts`** — agregar rutas:
  - `POST /admin/orders/:id/dispatch` → `dispatchOrder`
  - `PATCH /admin/orders/:orderId/items/:itemId/decrement-stock` → `decrementItemStock`

## Dev Notes

### Migration

```sql
-- Agregar 'shipped' al check constraint
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending', 'paid', 'rejected', 'cancelled', 'shipped'));

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ;
```

### pending-fulfillment.ts — query nueva

Estrategia: dos partes con UNION:

```sql
-- Parte A: ítems sin variante (curva/cantidad) — join con available variants
SELECT
  o.id AS order_id, o.created_at AS order_created_at, o.total_amount AS order_total,
  o.notes AS order_notes, o.purchase_type,
  u.email AS customer_email,
  oi.id AS item_id, oi.size_id, sz.label AS size_label,
  oi.quantity, oi.unit_price, oi.product_id, p.name AS product_name,
  FALSE AS variant_assigned,
  NULL::int AS assigned_variant_id, NULL::text AS assigned_color, NULL::text AS assigned_hex,
  v.id AS variant_id, cl.name AS color_name, cl.hex_code AS color_hex, s.quantity AS stock_quantity
FROM orders o
JOIN customers c ON c.id = o.customer_id
JOIN users u ON u.id = c.user_id
JOIN order_items oi ON oi.order_id = o.id AND oi.variant_id IS NULL AND oi.size_id IS NOT NULL
JOIN sizes sz ON sz.id = oi.size_id
JOIN products p ON p.id = oi.product_id
LEFT JOIN variants v ON v.product_id = oi.product_id AND v.size_id = oi.size_id AND v.active = TRUE
LEFT JOIN colors cl ON cl.id = v.color_id
LEFT JOIN stock s ON s.variant_id = v.id AND s.quantity > 0
WHERE o.status = 'paid' AND o.purchase_type IN ('curva', 'cantidad')

UNION ALL

-- Parte B: ítems con variante (menor) — mostrar variante asignada
SELECT
  o.id, o.created_at, o.total_amount, o.notes, o.purchase_type,
  u.email,
  oi.id, oi.size_id, sz.label,
  oi.quantity, oi.unit_price, oi.product_id, p.name,
  TRUE AS variant_assigned,
  v.id AS assigned_variant_id, cl.name AS assigned_color, cl.hex_code AS assigned_hex,
  NULL::int, NULL::text, NULL::text, NULL::int
FROM orders o
JOIN customers c ON c.id = o.customer_id
JOIN users u ON u.id = c.user_id
JOIN order_items oi ON oi.order_id = o.id AND oi.variant_id IS NOT NULL
JOIN variants v ON v.id = oi.variant_id
JOIN sizes sz ON sz.id = v.size_id
JOIN colors cl ON cl.id = v.color_id
JOIN products p ON p.id = oi.product_id
WHERE o.status = 'paid' AND o.purchase_type = 'menor'

ORDER BY order_created_at ASC, item_id, variant_id
```

### fulfillOrderItem — decrementStock opcional

```typescript
const { variantId, decrementStock = false } = req.body;

// Si decrementStock === true: comportamiento actual (UPDATE stock)
// Si decrementStock === false: solo UPDATE order_items SET variant_id
```

Permitir que el status sea `paid` o `shipped` para que el admin pueda asignar variante incluso después de despachar.

### Depende de
- Story 15-1 (BFF) — done

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Completion Notes
Migración 037 agrega `shipped` al CHECK constraint y columna `shipped_at`. Query PENDING_FULFILLMENT reescrita con UNION ALL: Parte A (curva/cantidad, variant_id IS NULL + available variants) y Parte B (menor, variant_id IS NOT NULL + datos de variante asignada). `getPendingFulfillment` actualizado con `purchaseType`, `variantAssigned`, `assignedVariantId/Color/Hex`. `fulfillOrderItem` acepta `decrementStock` (default false) y permite status `paid` o `shipped`. Nuevas funciones `dispatchOrder` y `decrementItemStock`. Rutas registradas. TypeScript compila sin errores.

### File List
- jedami-bff/src/database/migrations/037_shipped_status.sql (nuevo)
- jedami-bff/src/modules/admin/queries/pending-fulfillment.ts
- jedami-bff/src/modules/admin/admin.controller.ts
- jedami-bff/src/routes/admin.routes.ts
