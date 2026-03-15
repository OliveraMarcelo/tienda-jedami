# Story 6.3: Precios Mayoristas y Tablas de Referencia — BFF

Status: done

## Story

Como administrador,
quiero definir precios minoristas y mayoristas a nivel de producto, y gestionar talles y colores desde tablas de referencia normalizadas,
para que los mayoristas vean precios diferenciados y el catálogo sea mantenible sin redundancias.

**Depende de:** Epic 1 done

## Acceptance Criteria

1. **Given** un admin hace `PUT /api/v1/products/:id/prices` con `{ retailPrice, wholesalePrice }`
   **Then** se persisten en `product_prices` con `price_mode_id` correspondiente (`retail` / `wholesale`)
   **And** retorna `200 { data: { retailPrice, wholesalePrice } }`

2. **Given** `GET /products` o `GET /products/:id`
   **When** el catálogo retorna productos
   **Then** cada producto incluye `retailPrice` y `wholesalePrice` (null si no definido)
   **And** cada variante incluye `sizeId`, `size`, `colorId`, `color`, `hexCode`, `stock`

3. **Given** un mayorista crea un pedido por curva o por cantidad
   **When** el sistema calcula el total
   **Then** usa `wholesalePrice` del producto (o `retailPrice` como fallback) como `unit_price` en `order_items`

4. **Given** `GET /api/v1/products/sizes`
   **When** se consulta sin autenticación
   **Then** retorna los 18 talles ordenados por `sort_order` (RN < 0 < 1 < ... < 16 < S < M < L < XL)

5. **Given** `GET /api/v1/products/colors`
   **When** se consulta sin autenticación
   **Then** retorna los 15 colores con `id`, `name`, `hexCode` (hexCode null para "Estampado")

## Tasks

- [x] Migración `015_reference_tables.sql`: tablas `price_modes`, `sizes` (18 labels con sort_order), `colors` (15 con hex_code)
- [x] Migración `016_product_prices.sql`: tabla `product_prices (product_id PK, price_mode_id PK, price)`, migración AVG precios existentes
- [x] Migración `017_variants_refactor.sql`: `variants` pasa a `size_id FK`, `color_id FK`; elimina `size`, `color`, `retail_price`, `wholesale_price`; agrega índices `size_id`, `color_id`
- [x] Query `find-sizes-colors.ts`: `FIND_ALL_SIZES` (ORDER BY sort_order), `FIND_ALL_COLORS` (ORDER BY name)
- [x] Query `product-prices.ts`: `UPSERT_PRODUCT_PRICE`, `FIND_PRODUCT_PRICES`
- [x] Query `create-variant.ts`: actualizado a `INSERT INTO variants (product_id, size_id, color_id)`
- [x] Query `find-all-with-variants.ts`: reescrito con LEFT JOIN sizes, colors, product_prices (retail/wholesale via subquery); ORDER BY sort_order
- [x] Query `find-by-id-with-variants.ts`: mismo patrón para producto único
- [x] `products.entity.ts`: interfaces `Size`, `Color`, `PriceMode`; `Variant` sin precios; `Product` con `retailPrice`/`wholesalePrice`
- [x] `products.repository.ts`: `getSizes`, `getColors`, `findSizeById`, `findColorById`, `upsertProductPrice`, `deleteProductPrice`; `createVariantWithStock` actualizado
- [x] `products.service.ts`: `listSizes`, `listColors`, `updateProductPrices`; `groupRowsIntoProducts` lee precios del producto
- [x] `products.controller.ts`: `listSizesHandler`, `listColorsHandler`, `updateProductPricesHandler`; removed `updateVariantHandler`
- [x] `products.routes.ts`: `GET /sizes`, `GET /colors` (públicos, antes de `/:id`), `PUT /:id/prices` (admin); removed `PUT /:id/variants/:variantId`

## Arquitectura clave

### Decisión: precios a nivel de producto, no de variante

```
product_prices
  product_id   PK, FK → products(id)
  price_mode_id PK, FK → price_modes(id)
  price        NUMERIC(10,2)

price_modes
  id     SERIAL PK
  code   VARCHAR(20) UNIQUE  -- 'retail' | 'wholesale'
  label  VARCHAR(50)         -- 'Minorista' | 'Mayorista'
```

Todas las variantes (talle/color) de un producto comparten el mismo precio minorista y mayorista. Agregar una nueva modalidad de precio (ej: `distributor`) requiere solo un INSERT en `price_modes` + `product_prices`, sin cambios de schema.

### Variantes normalizadas post-migración 017

```
variants
  id         SERIAL PK
  product_id FK → products
  size_id    FK → sizes     (antes: VARCHAR 'size')
  color_id   FK → colors    (antes: VARCHAR 'color')
  -- sin retail_price, sin wholesale_price
```

### Talles con sort_order

`sizes.sort_order` resuelve el orden correcto de talles: RN(10) < 0(20) < 1(30) < 2(40) < 3(50) < 4(60) < 5(70) < 6(80) < 8(90) < 9(100) < 10(110) < 12(120) < 14(130) < 16(140) < S(150) < M(160) < L(170) < XL(180). Sin este campo, el orden sería alfabético (`0 < 1 < 10 < 12...`).

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Completion Notes List

- Migración 017 es in-place: añade columnas nullable → mapea datos existentes case-insensitive → inserta sizes/colors faltantes → hace NOT NULL → elimina columnas antiguas
- Rutas `/sizes` y `/colors` registradas **antes** de `/:id` para evitar que Express capture 'sizes'/'colors' como id param
- Frontend actualizado: `VariantFormDialog` usa dropdowns; `ProductFormDialog` edita precios; `CurvaCalculator` y `ProductView` usan precios del producto

### File List

**Nuevas migraciones:**
- `jedami-bff/src/database/migrations/015_reference_tables.sql`
- `jedami-bff/src/database/migrations/016_product_prices.sql`
- `jedami-bff/src/database/migrations/017_variants_refactor.sql`

**Nuevas queries:**
- `jedami-bff/src/modules/products/queries/find-sizes-colors.ts`
- `jedami-bff/src/modules/products/queries/product-prices.ts`

**Modificados BFF:**
- `jedami-bff/src/modules/products/products.entity.ts`
- `jedami-bff/src/modules/products/products.repository.ts`
- `jedami-bff/src/modules/products/products.service.ts`
- `jedami-bff/src/modules/products/products.controller.ts`
- `jedami-bff/src/modules/products/queries/create-variant.ts`
- `jedami-bff/src/modules/products/queries/find-all-with-variants.ts`
- `jedami-bff/src/modules/products/queries/find-by-id-with-variants.ts`
- `jedami-bff/src/modules/products/queries/update-variant.ts` (reducido a solo FIND_VARIANT_BY_ID)
- `jedami-bff/src/routes/products.routes.ts`

**Modificados frontend:**
- `jedami-web/src/types/api.ts`
- `jedami-web/src/api/products.api.ts`
- `jedami-web/src/api/admin.api.ts`
- `jedami-web/src/stores/products.store.ts`
- `jedami-web/src/stores/admin.products.store.ts`
- `jedami-web/src/components/features/admin/VariantFormDialog.vue`
- `jedami-web/src/components/features/admin/ProductFormDialog.vue`
- `jedami-web/src/views/admin/AdminProductsView.vue`
- `jedami-web/src/components/features/catalog/ProductCard.vue`
- `jedami-web/src/components/features/catalog/CurvaCalculator.vue`
- `jedami-web/src/components/features/catalog/VariantSelector.vue`
- `jedami-web/src/views/ProductView.vue`
