# Story 1.4: CRUD de Productos con Variantes

Status: review

## Story

Como administrador autenticado,
quiero crear y gestionar productos con sus variantes de talle y color, incluyendo precio y stock inicial,
para que el catálogo refleje la oferta real de la tienda.

## Acceptance Criteria

1. **Given** las tablas `products`, `variants` y `stock` existen en la base de datos
   **When** un admin hace `POST /api/v1/products` con `{ name, description }`
   **Then** se crea el producto y retorna `201 { data: { id, name, description } }`

2. **Given** un producto existente
   **When** un admin hace `POST /api/v1/products/:id/variants` con `{ size, color, retailPrice, initialStock }`
   **Then** se crea la variante en `variants` con `size`, `color`, `retail_price`
   **And** se crea el registro de stock en `stock` con `variant_id` como PK y `quantity = initialStock`
   **And** retorna `201 { data: { id, productId, size, color, retailPrice, stock: { quantity } } }`

3. **Given** un admin autenticado
   **When** hace `PUT /api/v1/products/:id` con datos actualizados
   **Then** actualiza el producto y retorna `200 { data: { id, name, description } }`

4. **Given** un usuario sin rol `admin`
   **When** intenta `POST /api/v1/products` o `PUT /api/v1/products/:id`
   **Then** retorna RFC 7807 `403`

5. **Given** un `productId` inexistente
   **When** se hace `GET /api/v1/products/:id`
   **Then** retorna RFC 7807 `404`

## Tasks / Subtasks

- [x] Task 1 — Migración para tablas products, variants, stock (AC: #1, #2)
  - [x] Crear `src/database/migrations/004_products.sql` con tablas `products`, `variants`, `stock`
  - [x] La migración se aplica automáticamente via `runMigrations()` al iniciar la app (runner de Story 1.1)
  - [x] Ver diseño exacto de tablas en Dev Notes

- [x] Task 2 — Interfaces TypeScript de entidades (AC: #1, #2)
  - [x] Crear `src/modules/products/products.entity.ts`: interfaces `Product`, `Variant`, `Stock` en un solo archivo
  - [x] Crear `src/modules/products/variants.entity.ts`: interface `Variant { id, productId, size, color, retailPrice }`
  - [x] Crear `src/modules/products/stock.entity.ts`: interface `Stock { variantId, quantity }`

- [x] Task 3 — Queries SQL del módulo products (AC: #1, #2, #3, #5)
  - [x] `queries/create-product.ts` → INSERT INTO products
  - [x] `queries/find-product-by-id.ts` → SELECT products WHERE id
  - [x] `queries/update-product.ts` → UPDATE products WHERE id
  - [x] `queries/create-variant.ts` → INSERT INTO variants
  - [x] `queries/create-stock.ts` → INSERT INTO stock (variant_id PK)
  - [x] `queries/find-all-with-variants.ts` → JOIN products + variants + stock (preparación para Story 1.5)

- [x] Task 4 — Crear `src/modules/products/products.repository.ts` (AC: #1, #2, #3, #5)
  - [x] `createProduct(name, description)` → usa `create-product.ts` query
  - [x] `findById(id)` → usa `find-product-by-id.ts` query
  - [x] `updateProduct(id, data)` → usa `update-product.ts` query
  - [x] `createVariantWithStock(productId, variantData)` → transacción atómica con pool.connect() + BEGIN/COMMIT/ROLLBACK

- [x] Task 5 — Crear `src/modules/products/products.service.ts` (AC: #1, #2, #3, #5)
  - [x] `createProduct(dto)`: validar name no vacío, llamar repository, retornar `{ id, name, description }`
  - [x] `createVariant(productId, dto)`: verificar que producto existe (404 si no), llamar `createVariantWithStock`, retornar variante con stock
  - [x] `updateProduct(id, dto)`: verificar que producto existe (404 si no), actualizar, retornar producto actualizado
  - [x] `findById(id)`: buscar producto, lanzar AppError 404 si no existe

- [x] Task 6 — Crear `src/modules/products/products.controller.ts` (AC: #1, #2, #3, #4, #5)
  - [x] `createProduct` handler: `POST /api/v1/products`
  - [x] `createVariant` handler: `POST /api/v1/products/:id/variants`
  - [x] `updateProduct` handler: `PUT /api/v1/products/:id`
  - [x] `getProduct` handler: `GET /api/v1/products/:id` (sin autenticación requerida)
  - [x] Todos los errores via `next(err)`

- [x] Task 7 — Crear `src/routes/products.routes.ts` y registrar (AC: #4)
  - [x] `POST /` → `createProduct` (auth + requireRole admin)
  - [x] `POST /:id/variants` → `createVariant` (auth + requireRole admin)
  - [x] `PUT /:id` → `updateProduct` (auth + requireRole admin)
  - [x] `GET /:id` → `getProduct` (sin auth — público)
  - [x] Registrado en `src/routes/index.ts` como `/products`

## Dev Notes

### Diseño de la migración 004_products.sql

```sql
BEGIN;

CREATE TABLE products (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  description TEXT
);

CREATE TABLE variants (
  id           SERIAL PRIMARY KEY,
  product_id   INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  size         VARCHAR(50) NOT NULL,
  color        VARCHAR(50) NOT NULL,
  retail_price NUMERIC(10, 2) NOT NULL
);

CREATE TABLE stock (
  variant_id  INT PRIMARY KEY REFERENCES variants(id) ON DELETE CASCADE,
  quantity    INT NOT NULL DEFAULT 0 CHECK (quantity >= 0)
);

CREATE INDEX idx_variants_product_id ON variants(product_id);

COMMIT;
```

**Puntos críticos del modelo:**
- `stock.variant_id` es PK (no SERIAL) — es un 1-1 exacto con `variants`
- `quantity CHECK >= 0` previene stock negativo a nivel DB
- No hay precio en `products` — el precio vive en `variants.retail_price` (regla arquitectónica)

### Transacción atómica para crear variante + stock

```typescript
// products.repository.ts
export const createVariantWithStock = async (
  productId: number,
  size: string,
  color: string,
  retailPrice: number,
  initialStock: number
): Promise<{ variant: Variant; stock: Stock }> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const variantResult = await client.query(CREATE_VARIANT, [productId, size, color, retailPrice]);
    const variant = variantResult.rows[0];

    await client.query(CREATE_STOCK, [variant.id, initialStock]);

    await client.query('COMMIT');
    return { variant, stock: { variantId: variant.id, quantity: initialStock } };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};
```

**IMPORTANTE:** Usar `pool.connect()` para transacciones (no `pool.query()` directamente) para garantizar que BEGIN/COMMIT/ROLLBACK estén en la misma conexión.

### Respuesta exacta de creación de variante (AC #2)

```json
POST /api/v1/products/1/variants
Body: { "size": "L", "color": "azul", "retailPrice": 1500, "initialStock": 10 }
→ 201
{
  "data": {
    "id": 1,
    "productId": 1,
    "size": "L",
    "color": "azul",
    "retailPrice": 1500,
    "stock": { "quantity": 10 }
  }
}
```

Notar: mapeo snake_case DB → camelCase respuesta:
- `product_id` → `productId`
- `retail_price` → `retailPrice`
- `variant_id` (en stock) → omitir, ya está en el contexto de la variante

### Regla crítica — precio solo en variante

```typescript
// ❌ NO crear campo price en products
// ✅ El precio es retail_price en variants
// ✅ El stock.quantity está en la tabla stock, no en variants
```

### DTO para crear producto

```typescript
interface CreateProductDTO {
  name: string;
  description?: string;
}

interface CreateVariantDTO {
  size: string;
  color: string;
  retailPrice: number;
  initialStock: number;
}
```

### Validaciones mínimas requeridas

```typescript
// En service.createProduct:
if (!dto.name?.trim()) {
  throw new AppError(400, 'Nombre requerido', '/errors/validation', 'El campo name es obligatorio');
}

// En service.createVariant:
if (!productId || !dto.size || !dto.color || dto.retailPrice == null || dto.initialStock == null) {
  throw new AppError(400, 'Datos de variante incompletos', '/errors/validation', 'Faltan campos requeridos');
}
if (dto.retailPrice < 0 || dto.initialStock < 0) {
  throw new AppError(400, 'Valores inválidos', '/errors/validation', 'retailPrice e initialStock deben ser >= 0');
}
```

### Project Structure Notes

Archivos a crear:
```
jedami-bff/src/
├── database/
│   └── migrations/
│       └── 004_products.sql          (NUEVO)
└── modules/
    └── products/
        ├── products.entity.ts         (NUEVO)
        ├── variants.entity.ts         (NUEVO)
        ├── stock.entity.ts            (NUEVO — opcional, puede inline en variants.entity.ts)
        ├── products.repository.ts     (NUEVO)
        ├── products.service.ts        (NUEVO)
        ├── products.controller.ts     (NUEVO)
        └── queries/
            ├── create-product.ts      (NUEVO)
            ├── find-product-by-id.ts  (NUEVO)
            ├── update-product.ts      (NUEVO)
            ├── create-variant.ts      (NUEVO)
            ├── create-stock.ts        (NUEVO)
            └── find-all-with-variants.ts (NUEVO — para Story 1.5)
```

### References

- ACs: [Source: _bmad-output/planning-artifacts/epics.md#Story 1.4: CRUD de Productos con Variantes]
- RF-06: [Source: _bmad-output/planning-artifacts/prd.md]
- Modelo de datos products/variants/stock: [Source: _bmad-output/planning-artifacts/architecture.md#Modelo de Datos]
- D1 (SQL puro, queries en modules/<nombre>/queries/*.ts): [Source: _bmad-output/planning-artifacts/architecture.md#D1 — Acceso a Base de Datos]
- Regla: precio vive en variante, stock 1-1 con variante: [Source: _bmad-output/planning-artifacts/architecture.md#Decisiones de Diseño del Modelo]
- Reglas obligatorias: [Source: _bmad-output/planning-artifacts/architecture.md#Reglas obligatorias para todos los agentes]
- RNF-02 (transacciones atómicas): [Source: _bmad-output/planning-artifacts/prd.md]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Task 1: 004_products.sql creado con productos/variantes/stock. stock.variant_id es PK (1-1). CHECK quantity >= 0.
- Task 2: Todas las interfaces en products.entity.ts (Product, Variant, Stock).
- Task 3: 6 queries creadas. find-all-with-variants.ts incluye COUNT_PRODUCTS y FIND_PRODUCT_WITH_VARIANTS_BY_ID para Story 1.5.
- Task 4: createVariantWithStock usa pool.connect() para transacción atómica garantizada.
- Task 5: Service con validaciones completas. retailPrice se castea a Number() para evitar string de Numeric de PG.
- Task 7: products.routes.ts con guard de admin en mutaciones y público en GET /:id.

### File List

- `jedami-bff/src/database/migrations/004_products.sql` (NUEVO)
- `jedami-bff/src/modules/products/products.entity.ts` (NUEVO)
- `jedami-bff/src/modules/products/products.repository.ts` (NUEVO)
- `jedami-bff/src/modules/products/products.service.ts` (NUEVO)
- `jedami-bff/src/modules/products/products.controller.ts` (NUEVO)
- `jedami-bff/src/modules/products/queries/create-product.ts` (NUEVO)
- `jedami-bff/src/modules/products/queries/find-product-by-id.ts` (NUEVO)
- `jedami-bff/src/modules/products/queries/update-product.ts` (NUEVO)
- `jedami-bff/src/modules/products/queries/create-variant.ts` (NUEVO)
- `jedami-bff/src/modules/products/queries/create-stock.ts` (NUEVO)
- `jedami-bff/src/modules/products/queries/find-all-with-variants.ts` (NUEVO)
- `jedami-bff/src/routes/products.routes.ts` (NUEVO)
- `jedami-bff/src/routes/index.ts` (MODIFICADO — agrega /products)
