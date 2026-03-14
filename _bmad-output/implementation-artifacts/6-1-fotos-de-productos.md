# Story 6.1: Fotos de Productos (BFF)

Status: done

## Story

Como administrador,
quiero poder agregar y eliminar fotos a cada producto desde el panel de administración,
para que los clientes vean imágenes reales en el catálogo y en el detalle de producto.

**Depende de:** Epic 1 done

## Decisión de diseño: upload de archivos, NO URLs externas

Las imágenes se suben como archivos (`multipart/form-data`) desde el panel admin.
El BFF las almacena en un volumen local (`/uploads/products/`) y las sirve como archivos estáticos.
El frontend consume las URLs del propio BFF (ej. `http://localhost:3000/uploads/products/abc123.jpg`).
**No se usan URLs de servicios externos** — todo el contenido queda bajo control propio.

## Acceptance Criteria

1. **Given** el admin hace `POST /api/v1/products/:id/images/upload` con `multipart/form-data` (campo `image`)
   **Then** el archivo se guarda en el servidor en `/uploads/products/`
   **And** se inserta una fila en `product_images` con la URL interna del archivo
   **And** se devuelve `{ data: { id, productId, url, position } }`

2. **Given** el admin hace `DELETE /api/v1/products/:id/images/:imageId`
   **Then** se elimina el archivo del disco y la fila de `product_images`
   **And** se responde `204 No Content`

3. **Given** se hace `GET /api/v1/products` (catálogo)
   **Then** cada producto incluye `imageUrl` con la URL servida por el BFF
   **And** si no hay imágenes, `imageUrl` es `null`

4. **Given** se hace `GET /api/v1/products/:id`
   **Then** el producto incluye `images: [{ id, url, position }]` ordenados por posición

5. **Given** el frontend hace `<input type="file">` en el panel admin
   **Then** el archivo seleccionado se sube al BFF con `FormData`
   **And** la imagen aparece en la lista de fotos del producto inmediatamente

## Tasks

- [x] Migración `010_product_images.sql`: tabla `product_images(id, product_id, url, position, created_at)`
- [x] LATERAL JOIN en `find-all-with-variants.ts` para `image_url`
- [x] `getProductWithVariants` incluye `images[]`
- [ ] Instalar `multer` en BFF
- [ ] Configurar directorio `/uploads/products/` y servirlo como estático en Express
- [ ] Endpoint `POST /products/:id/images/upload` acepta `multipart/form-data`, guarda el archivo, inserta en `product_images`
- [ ] `deleteImage` elimina también el archivo del disco (`fs.unlink`)
- [ ] Actualizar `admin.api.ts`: `uploadImage(productId, file: File)` usando `FormData`
- [ ] Reemplazar input URL por `<input type="file">` en `ProductFormDialog`
- [ ] Seed de imágenes existente puede quedar como fallback (URLs Unsplash para datos iniciales)
