# Story 1.5: Catálogo Público de Productos

Status: review

## Story

Como visitante (autenticado o no),
quiero ver el catálogo de productos con todas sus variantes, precios y stock disponible,
para que pueda explorar la oferta antes de decidir si comprar.

## Acceptance Criteria

1. **Given** productos con variantes cargados en la base de datos
   **When** se hace `GET /api/v1/products` sin token de autenticación
   **Then** retorna `200 { data: [...], meta: { page, pageSize, total } }` con todos los productos y sus variantes
   **And** cada variante incluye: `id`, `size`, `color`, `retailPrice`, `stock.quantity`

2. **Given** query param `mode=retail` (o sin `mode`)
   **When** se hace `GET /api/v1/products`
   **Then** el precio devuelto es `retailPrice` de cada variante

3. **Given** query param `mode=wholesale`
   **When** se hace `GET /api/v1/products`
   **Then** en Fase 1 también retorna `retailPrice` (el precio mayorista es extensión futura)

4. **Given** query params `page=2&pageSize=10`
   **When** se hace `GET /api/v1/products`
   **Then** retorna la página correspondiente con el total correcto en `meta`

5. **Given** un `productId` existente
   **When** se hace `GET /api/v1/products/:id` sin autenticación
   **Then** retorna `200 { data: { id, name, description, variants: [...] } }` con todas las variantes

6. **Given** un `productId` inexistente
   **When** se hace `GET /api/v1/products/:id`
   **Then** retorna RFC 7807 `404`

## Tasks / Subtasks

- [x] Task 1 — Query de listado con variantes y paginación (AC: #1, #2, #3, #4)
  - [x] Actualizar `src/modules/products/queries/find-all-with-variants.ts` con alias consistentes (variant_size, etc.)
  - [x] COUNT_PRODUCTS incluido en el mismo archivo
  - [x] Ver diseño exacto de la query en Dev Notes

- [x] Task 2 — Query de producto por id con variantes (AC: #5, #6)
  - [x] Crear `src/modules/products/queries/find-by-id-with-variants.ts`
  - [x] Devuelve todas las variantes del producto con stock

- [x] Task 3 — Extender `src/modules/products/products.repository.ts` (AC: #1, #4, #5)
  - [x] `findAllWithVariants(limit, offset)`: retorna CatalogRow[]
  - [x] `countProducts()`: retorna total de productos
  - [x] `findByIdWithVariants(id)`: retorna CatalogRow[] (vacío si no existe)

- [x] Task 4 — Extender `src/modules/products/products.service.ts` (AC: #1, #2, #3, #4, #5, #6)
  - [x] `getCatalog(page, pageSize)`: Promise.all para paginación + count. Agrupa con Map por product_id
  - [x] `getProductWithVariants(id)`: lanza AppError 404 si rows vacío
  - [x] mode se acepta en controller pero no cambia la lógica (retailPrice siempre)

- [x] Task 5 — Agregar handlers en `src/modules/products/products.controller.ts` (AC: #1, #4, #5, #6)
  - [x] Handler `listProducts` con defaults page=1, pageSize=20, max=100
  - [x] Handler `getProduct` actualizado para usar `getProductWithVariants`

- [x] Task 6 — Registrar rutas públicas en `src/routes/products.routes.ts` (AC: #1, #4, #5)
  - [x] `GET /` → `listProducts` (sin auth, público)
  - [x] `GET /:id` confirmado sin auth

## Dev Notes

### Dependencia en Story 1.4

Esta story extiende directamente lo construido en Story 1.4:
- Las tablas `products`, `variants`, `stock` ya existen (migración 004)
- `products.repository.ts` y `products.service.ts` ya existen — esta story AGREGA métodos, no reemplaza
- `products.routes.ts` ya existe — esta story AGREGA las rutas GET públicas

### Query find-all-with-variants con paginación

La query debe devolver filas donde hay una fila por variante (se agrupa en el servicio):

```typescript
// src/modules/products/queries/find-all-with-variants.ts
export const FIND_ALL_PRODUCTS_WITH_VARIANTS = `
  SELECT
    p.id           AS product_id,
    p.name         AS product_name,
    p.description  AS product_description,
    v.id           AS variant_id,
    v.size         AS variant_size,
    v.color        AS variant_color,
    v.retail_price AS variant_retail_price,
    s.quantity     AS stock_quantity
  FROM products p
  LEFT JOIN variants v ON v.product_id = p.id
  LEFT JOIN stock s ON s.variant_id = v.id
  ORDER BY p.id, v.id
  LIMIT $1 OFFSET $2
`;

export const COUNT_PRODUCTS = `
  SELECT COUNT(DISTINCT p.id)::int AS total FROM products p
`;
```

**IMPORTANTE:** La query devuelve N filas por producto (una por variante). El service debe agrupar por `product_id` para construir la respuesta anidada.

### Agrupación en el service

```typescript
// products.service.ts — getCatalog
const rows = await productsRepository.findAllWithVariants(page, pageSize);
const total = await productsRepository.countProducts();

// Agrupar variantes por producto
const productsMap = new Map<number, ProductWithVariants>();
for (const row of rows) {
  if (!productsMap.has(row.productId)) {
    productsMap.set(row.productId, {
      id: row.productId,
      name: row.productName,
      description: row.productDescription,
      variants: [],
    });
  }
  if (row.variantId) {
    productsMap.get(row.productId)!.variants.push({
      id: row.variantId,
      size: row.variantSize,
      color: row.variantColor,
      retailPrice: row.variantRetailPrice,
      stock: { quantity: row.stockQuantity ?? 0 },
    });
  }
}
return { products: Array.from(productsMap.values()), total };
```

### Respuesta exacta del catálogo (AC #1)

```json
GET /api/v1/products?page=1&pageSize=2
→ 200
{
  "data": [
    {
      "id": 1,
      "name": "Remera Bebé",
      "description": "Remera de algodón para bebé",
      "variants": [
        { "id": 1, "size": "0-3m", "color": "celeste", "retailPrice": 1200, "stock": { "quantity": 15 } },
        { "id": 2, "size": "3-6m", "color": "celeste", "retailPrice": 1200, "stock": { "quantity": 8 } }
      ]
    }
  ],
  "meta": { "page": 1, "pageSize": 2, "total": 10 }
}
```

### Manejo de query params — defaults y tipos

```typescript
// En el controller:
const page = parseInt(req.query.page as string) || 1;
const pageSize = Math.min(parseInt(req.query.pageSize as string) || 20, 100); // max 100
const mode = (req.query.mode as string) ?? 'retail';  // 'retail' | 'wholesale'

// Calcular offset:
const offset = (page - 1) * pageSize;
```

### Comportamiento mode=wholesale en Fase 1

```typescript
// En Fase 1, mode no cambia el precio — siempre devuelve retailPrice
// Esto es intencional según el AC #3: "en Fase 1 también retorna retailPrice"
// El campo se acepta y se procesa para no romper futura compatibilidad
// No lanzar error si mode es un valor desconocido — ignorarlo silenciosamente
```

### Ruta GET /:id es pública — sin auth middleware

```typescript
// products.routes.ts
router.get('/', listProducts);           // ✅ sin auth
router.get('/:id', getProduct);          // ✅ sin auth
router.post('/', authMiddleware, requireRole(['admin']), createProduct);    // protegido
router.post('/:id/variants', authMiddleware, requireRole(['admin']), createVariant); // protegido
router.put('/:id', authMiddleware, requireRole(['admin']), updateProduct);  // protegido
```

### Query find-by-id-with-variants

```typescript
// src/modules/products/queries/find-by-id-with-variants.ts
export const FIND_PRODUCT_BY_ID_WITH_VARIANTS = `
  SELECT
    p.id           AS product_id,
    p.name         AS product_name,
    p.description  AS product_description,
    v.id           AS variant_id,
    v.size         AS variant_size,
    v.color        AS variant_color,
    v.retail_price AS variant_retail_price,
    s.quantity     AS stock_quantity
  FROM products p
  LEFT JOIN variants v ON v.product_id = p.id
  LEFT JOIN stock s ON s.variant_id = v.id
  WHERE p.id = $1
  ORDER BY v.id
`;
```

### Manejo de producto sin variantes

Si un producto existe pero no tiene variantes, la query retorna 1 fila con todos los campos de variante en NULL (por el LEFT JOIN). El service debe manejar esto:

```typescript
// Si variant_id es null, el producto existe pero no tiene variantes
if (row.variantId !== null) {
  productsMap.get(row.productId)!.variants.push(...);
}
```

### Project Structure Notes

Archivos a crear/modificar en esta story:
```
jedami-bff/src/
└── modules/
    └── products/
        ├── products.repository.ts     (MODIFICAR: agregar findAllWithVariants, findByIdWithVariants, countProducts)
        ├── products.service.ts        (MODIFICAR: agregar getCatalog, getProduct)
        ├── products.controller.ts     (MODIFICAR: agregar listProducts handler)
        └── queries/
            ├── find-all-with-variants.ts    (NUEVO o completar skeleton de Story 1.4)
            ├── find-by-id-with-variants.ts  (NUEVO o completar skeleton de Story 1.4)
            └── count-products.ts            (NUEVO)
```

**No se crean archivos de rutas nuevos** — las rutas GET ya deben estar en `products.routes.ts` de Story 1.4.

### References

- ACs: [Source: _bmad-output/planning-artifacts/epics.md#Story 1.5: Catálogo Público de Productos]
- RF-07, RF-09 (modo visualización): [Source: _bmad-output/planning-artifacts/prd.md]
- Formato respuesta con meta paginación: [Source: _bmad-output/planning-artifacts/architecture.md#Formato de Respuestas API]
- Regla 12 (queries de productos deben JOIN con variants): [Source: _bmad-output/planning-artifacts/architecture.md#Reglas obligatorias para todos los agentes]
- D5 (versionado /api/v1/): [Source: _bmad-output/planning-artifacts/architecture.md#D5 — Versionado de API]
- Adicional PRD: "Visitante puede navegar catálogo sin registrarse (RF-09, Journey 0)": [Source: _bmad-output/planning-artifacts/prd.md#Additional Requirements]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Task 1: find-all-with-variants.ts actualizado con alias de columnas explícitos para evitar colisiones al mapear rows. COUNT_PRODUCTS en el mismo archivo.
- Task 2: find-by-id-with-variants.ts creado con mismo esquema de alias.
- Task 3: Repository extendido con findAllWithVariants, countProducts, findByIdWithVariants. Tipo CatalogRow exportado para tipado en service.
- Task 4: Service usa groupRowsIntoProducts() helper privado para Map. Promise.all para paralelizar count y fetch. retailPrice se castea con Number() (PG retorna NUMERIC como string).
- Task 5: listProducts handler con max pageSize=100. getProduct actualizado a getProductWithVariants.
- Task 6: GET / agregado a products.routes.ts como ruta pública.

### File List

- `jedami-bff/src/modules/products/queries/find-all-with-variants.ts` (MODIFICADO — alias explícitos)
- `jedami-bff/src/modules/products/queries/find-by-id-with-variants.ts` (NUEVO)
- `jedami-bff/src/modules/products/products.repository.ts` (MODIFICADO — findAllWithVariants, countProducts, findByIdWithVariants)
- `jedami-bff/src/modules/products/products.service.ts` (MODIFICADO — getCatalog, getProductWithVariants, groupRowsIntoProducts)
- `jedami-bff/src/modules/products/products.controller.ts` (MODIFICADO — listProducts, getProduct actualizado)
- `jedami-bff/src/routes/products.routes.ts` (MODIFICADO — GET / público)
