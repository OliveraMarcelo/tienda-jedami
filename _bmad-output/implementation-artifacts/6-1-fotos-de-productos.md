# Story 6.1: Fotos de Productos (BFF)

Status: done

## Story

Como administrador,
quiero poder agregar y eliminar fotos a cada producto desde el panel de administración,
para que los clientes vean imágenes reales en el catálogo y en el detalle de producto.

**Depende de:** Epic 1 done

## Acceptance Criteria

1. **Given** el admin hace `POST /api/v1/products/:id/images` con `{ url, position? }`
   **Then** se inserta una fila en `product_images` y se devuelve `{ data: { id, productId, url, position } }`

2. **Given** el admin hace `DELETE /api/v1/products/:id/images/:imageId`
   **Then** se elimina la imagen y se responde `204 No Content`

3. **Given** se hace `GET /api/v1/products` (catálogo)
   **Then** cada producto incluye `imageUrl` con la URL de la primera imagen (por `position ASC, id ASC`)
   **And** si no hay imágenes, `imageUrl` es `null`

4. **Given** se hace `GET /api/v1/products/:id`
   **Then** el producto incluye `images: [{ id, url, position }]` ordenados por posición

## Tasks

- [x] Migración `010_product_images.sql`: tabla `product_images(id, product_id, url, position, created_at)`
- [x] Query `find-images-by-product.ts`
- [x] `products.repository`: `findImagesByProductId`, `addImage`, `deleteImage`
- [x] `products.service`: `addImage(productId, url, position?)`, `deleteImage(productId, imageId)`
- [x] `products.controller`: `addImageHandler`, `deleteImageHandler`
- [x] `products.routes`: `POST /:id/images`, `DELETE /:id/images/:imageId` (admin)
- [x] LATERAL JOIN en `find-all-with-variants.ts` para `image_url`
- [x] `getProductWithVariants` incluye `images[]` en paralelo con variantes
- [x] Migración `014_seed_product_images.sql`: 2 fotos por producto para dev
