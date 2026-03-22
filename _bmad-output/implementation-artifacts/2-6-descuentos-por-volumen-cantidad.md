# Story 2-6: Descuentos por Volumen y Mínimo de Compra — Modalidad Cantidad y Curva

**Épica:** 2 — Compra Mayorista
**Track:** BFF (jedami-bff)
**Estado:** backlog (idea — decisiones tomadas, pendiente de implementar)
**Depende de:** 2-4-compra-mayorista-por-cantidad (done), 2-3-compra-mayorista-por-curva (done), 6-6-tablas-de-configuracion (done)

---

## Contexto

El vendedor quiere poder configurar, por producto:

- Un **mínimo de compra** para la modalidad `cantidad` (ej. mínimo 50 unidades).
- **Escalones de descuento por volumen** para `cantidad` (ej. 50u → 10%, 100u → 20%).
- **Escalones de descuento por número de curvas** (ej. comprar 10 curvas → 15% off).

Cada producto puede tener sus propias reglas o ninguna. El admin las gestiona por producto desde el panel.

---

## Decisiones tomadas

| Pregunta | Decisión |
|----------|----------|
| ¿Global o por producto? | **Por producto.** `product_id NOT NULL` en las tablas de reglas. El admin activa/desactiva descuentos por producto. |
| ¿El descuento se muestra en el pedido? | **Sí, desglosado.** El cliente ve el precio base, el % de descuento aplicado y el precio final. |
| ¿Aplica también para curva? | **Sí.** Configurable por número de curvas compradas (ej. 10 curvas → X%). |

---

## Reglas de negocio

### Modalidad Cantidad
- Si el producto tiene un mínimo configurado y el cliente pide menos → error 422 con mensaje claro.
- Se busca el escalón aplicable: el de mayor `min_quantity` que sea `<= quantity`.
- El descuento se aplica sobre el `wholesale_price` (o `retail_price` como fallback).
- Si no hay escalones configurados para ese producto → precio mayorista sin descuento (comportamiento actual).

### Modalidad Curva
- Los escalones se basan en el número de curvas pedidas (campo `curves`), no en unidades.
- Se aplica el mismo criterio de "mayor escalón que sea `<= curves`".
- Si no hay escalones configurados → precio mayorista sin descuento (comportamiento actual).

### Persistencia del descuento
- El descuento **no modifica** `unit_price` directamente.
- Se agregan dos columnas a `order_items`:
  - `discount_pct NUMERIC(5,2) DEFAULT 0` — porcentaje aplicado (ej. 10.00)
  - `original_unit_price NUMERIC(12,2)` — precio antes del descuento
- `unit_price` guarda el **precio final ya descontado** (para que el total del pedido sea correcto).
- Si se modifica o elimina un escalón, los pedidos existentes no se ven afectados.

---

## Modelo de datos propuesto

### Tabla `quantity_discount_rules` (modalidad cantidad)
```sql
CREATE TABLE quantity_discount_rules (
  id           SERIAL PRIMARY KEY,
  product_id   INT            NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  min_quantity INT            NOT NULL,       -- umbral de unidades para activar el escalón
  discount_pct NUMERIC(5, 2)  NOT NULL,       -- ej. 10.00 = 10%
  active       BOOLEAN        NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ    DEFAULT NOW(),
  UNIQUE (product_id, min_quantity)
);
```

### Tabla `curva_discount_rules` (modalidad curva)
```sql
CREATE TABLE curva_discount_rules (
  id           SERIAL PRIMARY KEY,
  product_id   INT            NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  min_curves   INT            NOT NULL,       -- umbral de curvas para activar el escalón
  discount_pct NUMERIC(5, 2)  NOT NULL,       -- ej. 15.00 = 15%
  active       BOOLEAN        NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ    DEFAULT NOW(),
  UNIQUE (product_id, min_curves)
);
```

### Mínimo de compra en `products`
```sql
ALTER TABLE products ADD COLUMN min_quantity_purchase INT DEFAULT NULL;
-- NULL = sin mínimo
```

### Columnas adicionales en `order_items`
```sql
ALTER TABLE order_items ADD COLUMN discount_pct         NUMERIC(5,2)  NOT NULL DEFAULT 0;
ALTER TABLE order_items ADD COLUMN original_unit_price  NUMERIC(12,2) DEFAULT NULL;
-- original_unit_price = NULL cuando no hubo descuento
```

---

## API propuesta

### Pública / Cliente

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | /products/:id/discount-rules | Devuelve escalones activos del producto (para mostrar en el catálogo/checkout) |

### Admin

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET    | /admin/products/:id/discount-rules | Listar todas las reglas (cantidad + curva) del producto |
| POST   | /admin/products/:id/discount-rules/quantity | Crear escalón de cantidad |
| PATCH  | /admin/products/:id/discount-rules/quantity/:ruleId | Editar escalón de cantidad |
| DELETE | /admin/products/:id/discount-rules/quantity/:ruleId | Eliminar escalón de cantidad |
| POST   | /admin/products/:id/discount-rules/curva | Crear escalón de curva |
| PATCH  | /admin/products/:id/discount-rules/curva/:ruleId | Editar escalón de curva |
| DELETE | /admin/products/:id/discount-rules/curva/:ruleId | Eliminar escalón de curva |
| PATCH  | /admin/products/:id/min-quantity | Actualizar mínimo de compra del producto |

### Cambio en `POST /orders/:orderId/items` — modalidad cantidad
- Validar `quantity >= product.min_quantity_purchase` (si aplica).
- Buscar escalón: `SELECT MAX(min_quantity) FROM quantity_discount_rules WHERE product_id = $1 AND min_quantity <= $2 AND active = TRUE`.
- Si hay escalón: `final_price = wholesale_price * (1 - discount_pct / 100)`.
- Guardar: `unit_price = final_price`, `original_unit_price = wholesale_price`, `discount_pct = escalón.discount_pct`.
- Respuesta incluye: `appliedDiscount: { discountPct, originalUnitPrice } | null`.

### Cambio en `POST /orders/:orderId/items` — modalidad curva
- Misma lógica pero usando `curva_discount_rules` y el campo `curves` como umbral.

---

## Stories derivadas

Una vez implementado el BFF:
- `web-2-6-descuentos-por-volumen` — UI para el cliente: mostrar escalones disponibles en la página del producto + desglose del descuento en checkout y detalle del pedido.
- Admin: gestión de escalones integrada en el formulario de producto (`AdminProductForm` o vista dedicada).
