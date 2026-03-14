# Story 6.3: Precios Mayoristas por Variante (BFF)

Status: done

## Story

Como administrador,
quiero poder definir un precio mayorista distinto al minorista para cada variante de producto,
para que los compradores mayoristas vean y paguen precios diferenciados.

**Depende de:** Epic 1 done

## Acceptance Criteria

1. **Given** se hace `POST /api/v1/products/:id/variants` con `wholesalePrice`
   **Then** la variante se crea con `wholesale_price` en la DB

2. **Given** se hace `PUT /api/v1/products/:id/variants/:variantId` con `{ retailPrice?, wholesalePrice? }`
   **Then** los precios se actualizan y se devuelve la variante actualizada

3. **Given** se hace `GET /api/v1/products` o `GET /api/v1/products/:id`
   **Then** cada variante incluye `wholesalePrice` (número o `null`)

4. **Given** un mayorista crea un pedido por curva o por cantidad
   **Then** se usa `wholesale_price` como `unit_price`; si es `null`, se usa `retail_price` como fallback

## Tasks

- [x] Migración `011_wholesale_price.sql`: `ALTER TABLE variants ADD COLUMN wholesale_price NUMERIC(10,2)`
- [x] Query `create-variant.ts`: incluye `wholesale_price` en INSERT y RETURNING
- [x] Query `update-variant.ts`: `UPDATE variants SET retail_price, wholesale_price WHERE id AND product_id`
- [x] `products.repository`: `updateVariant`, `findVariantById`
- [x] `products.service`: `updateVariant`, validación `wholesalePrice >= 0`
- [x] `products.controller`: `updateVariantHandler`
- [x] `products.routes`: `PUT /:id/variants/:variantId` (admin)
- [x] `orders.service`: `addCurvaItems` y `addCantidadItems` usan `wholesale_price ?? retail_price`
