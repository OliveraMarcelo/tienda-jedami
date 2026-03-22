# Story 9.5: Búsqueda de Texto en el Catálogo — BFF

Status: done

## Story

Como visitante o comprador,
quiero buscar productos por nombre en el catálogo,
para encontrar rápidamente lo que necesito sin navegar por todas las categorías.

## Acceptance Criteria

1. **Given** el cliente hace `GET /products?search=remera`
   **When** el endpoint responde
   **Then** retorna solo los productos cuyo `name` contiene "remera" (búsqueda case-insensitive)
   **And** la paginación sigue funcionando (`page`, `pageSize`)
   **And** se puede combinar con `categoryId`

2. **Given** `search` está vacío o no se envía
   **When** el endpoint responde
   **Then** el comportamiento es idéntico al actual (retorna todos los productos)

3. **Given** se busca un término sin resultados
   **When** el endpoint responde
   **Then** retorna `{ data: [], meta: { total: 0, ... } }`

4. **Given** hay un resultado cacheado con un search diferente al actual
   **When** se hace una búsqueda nueva
   **Then** el cache key incluye el término de búsqueda y los resultados no se mezclan

## Tasks / Subtasks

- [ ] Actualizar `FIND_ALL_WITH_VARIANTS` en `queries/find-all-with-variants.ts`: agregar parámetro `$4 = search` con `ILIKE` (AC: 1, 2)
- [ ] Actualizar `COUNT_PRODUCTS` para aceptar parámetro search (AC: 1, 2, 3)
- [ ] Actualizar `findAllWithVariants(pageSize, offset, categoryId, search?)` en `products.repository.ts` (AC: 1, 2)
- [ ] Actualizar `countProducts(categoryId?, search?)` en `products.repository.ts` (AC: 1, 3)
- [ ] Actualizar `listProducts` handler en `products.controller.ts` para leer `req.query.search` (AC: 1, 2)
- [ ] Actualizar la cache key para incluir el término search (AC: 4)

## Dev Notes

### Actualización de la query SQL
```typescript
// find-all-with-variants.ts
// $1 = pageSize, $2 = offset, $3 = categoryId, $4 = search (VARCHAR | null)
export const FIND_ALL_WITH_VARIANTS = `
  SELECT ...
  FROM (
    SELECT id, name, description, category_id
    FROM products
    WHERE ($3::INT IS NULL OR category_id = $3)
      AND ($4::VARCHAR IS NULL OR name ILIKE '%' || $4 || '%')
    ORDER BY id
    LIMIT $1 OFFSET $2
  ) p
  ...
`

// count_products.ts
// $1 = categoryId, $2 = search
export const COUNT_PRODUCTS = `
  SELECT COUNT(*)::int AS total
  FROM products
  WHERE ($1::INT IS NULL OR category_id = $1)
    AND ($2::VARCHAR IS NULL OR name ILIKE '%' || $2 || '%')
`
```

### Cache key con search
```typescript
// products.controller.ts
const search = (req.query.search as string | undefined)?.trim() || null
const cacheKey = `catalog:page:${page}:size:${pageSize}:cat:${categoryId ?? 'all'}:search:${search ?? ''}`
```

### Sanitización del input
```typescript
const rawSearch = req.query.search as string | undefined
const search = rawSearch?.trim() ? rawSearch.trim() : null
```
No es necesario escapar manualmente el `%` porque se usa la sintaxis parametrizada `$4` — pg lo maneja.

### Response (sin cambios)
El response shape `{ data: [], meta: { page, pageSize, total, categoryId } }` se extiende con `search`:
```json
{
  "data": [...],
  "meta": { "page": 1, "pageSize": 20, "total": 5, "categoryId": null, "search": "remera" }
}
```

### Referencias
- [Source: jedami-bff/src/modules/products/queries/find-all-with-variants.ts]
- [Source: jedami-bff/src/modules/products/products.repository.ts]
- [Source: jedami-bff/src/modules/products/products.controller.ts]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
