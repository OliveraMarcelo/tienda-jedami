# Story 6.4: Categorías de Productos (BFF)

Status: done

## Story

Como administrador,
quiero gestionar categorías y asignarlas a productos,
para que los clientes puedan filtrar el catálogo por tipo de prenda.

**Depende de:** Epic 1 done

## Acceptance Criteria

1. **Given** se hace `GET /api/v1/categories`
   **Then** se devuelve `{ data: [{ id, name, slug }] }` (público, sin auth)

2. **Given** el admin hace `POST /api/v1/categories` con `{ name }`
   **Then** se crea la categoría con slug auto-generado (ej. "Remeras" → "remeras", "Ñoños" → "nonos")
   **And** si ya existe el nombre o slug, devuelve `409 Conflict`

3. **Given** el admin hace `PUT /api/v1/categories/:id` o `DELETE /api/v1/categories/:id`
   **Then** se actualiza/elimina la categoría correctamente

4. **Given** se hace `GET /api/v1/products?categoryId=1`
   **Then** solo se devuelven productos de esa categoría
   **And** `meta.categoryId` refleja el filtro aplicado

## Tasks

- [x] Migración `012_categories.sql`: tabla `categories(id, name, slug)` + `category_id` en `products`
- [x] `categories.entity.ts`, `categories.repository.ts`, `categories.service.ts`, `categories.controller.ts`
- [x] `categories.routes.ts`: GET `/` público, POST/PUT/DELETE admin
- [x] `routes/index.ts`: registrar `/api/v1/categories`
- [x] `find-all-with-variants.ts`: LEFT JOIN categories, filtro `WHERE $3::INT IS NULL OR category_id = $3`
- [x] `update-product.ts`: acepta `category_id` como `$4`
- [x] `products.service`: `createProduct` y `updateProduct` soportan `categoryId`
