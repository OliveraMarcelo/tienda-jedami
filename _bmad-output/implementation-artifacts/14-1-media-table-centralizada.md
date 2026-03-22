# Story 14.1: Tabla `media` Centralizada — Migración de Imágenes

Status: backlog

## Contexto

El proyecto creció con imágenes gestionadas por separado en tres entidades:
- `product_images`: guarda filename + posición por producto
- `branding`: guarda `logo_url` como texto con el path completo
- `banners`: guarda `image_url` como filename

Cada entidad tiene su propia carpeta en disco (`uploads/products/`, `uploads/branding/`, `uploads/banners/`).

Esta story consolida todo en una tabla `media` única y un solo directorio `uploads/`, sin cambiar el comportamiento visible para el usuario.

## Story

Como desarrollador,
quiero que todas las imágenes del sistema referencien una tabla `media` centralizada,
para tener un punto único de gestión de archivos, poder detectar huérfanos y simplificar el código de uploads.

## Acceptance Criteria

1. **Given** la migración se ejecuta
   **When** finaliza
   **Then** existe la tabla `media(id, filename, mime_type, size_bytes, entity_type, created_at)`
   **And** todos los archivos físicos están bajo `uploads/` (sin subcarpetas por entidad)
   **And** `product_images.media_id` referencia `media.id`
   **And** `banners.media_id` referencia `media.id`
   **And** `branding.logo_media_id` referencia `media.id`

2. **Given** el admin sube cualquier imagen (producto, banner, logo)
   **When** el archivo se guarda en disco
   **Then** se inserta un registro en `media` y la entidad correspondiente guarda el `media_id`

3. **Given** se elimina un producto, banner o logo
   **When** el handler procesa el DELETE
   **Then** se borra el archivo del disco Y el registro de `media`

4. **Given** cualquier endpoint que retorna imágenes (catálogo, banners, branding)
   **When** construye la URL pública
   **Then** usa `/uploads/{media.filename}` (sin subcarpeta)

5. **Given** el sistema arranca después de la migración
   **When** se sirven estáticos
   **Then** un único `express.static` sobre `uploads/` sirve todas las imágenes

6. **Given** la migración de datos se ejecuta
   **When** hay archivos existentes en `uploads/products/`, `uploads/branding/`, `uploads/banners/`
   **Then** los archivos se mueven a `uploads/` (raíz) y se insertan registros en `media`

## Tasks / Subtasks

### Base de datos
- [ ] **Migration `0XX_media_table.sql`**:
  ```sql
  -- 1. Crear tabla media
  CREATE TABLE media (
    id          SERIAL PRIMARY KEY,
    filename    TEXT        NOT NULL UNIQUE,
    mime_type   TEXT        DEFAULT NULL,
    size_bytes  INT         DEFAULT NULL,
    entity_type TEXT        NOT NULL,  -- 'product', 'banner', 'branding'
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- 2. Agregar media_id a product_images (nullable durante migración)
  ALTER TABLE product_images ADD COLUMN IF NOT EXISTS media_id INT REFERENCES media(id) ON DELETE SET NULL;

  -- 3. Agregar media_id a banners
  ALTER TABLE banners ADD COLUMN IF NOT EXISTS media_id INT REFERENCES media(id) ON DELETE SET NULL;

  -- 4. Agregar logo_media_id a branding
  ALTER TABLE branding ADD COLUMN IF NOT EXISTS logo_media_id INT REFERENCES media(id) ON DELETE SET NULL;
  ```

- [ ] **Migration `0XX_media_data_migration.sql`**: poblar `media` con los archivos existentes y actualizar FKs
  ```sql
  -- Migrar imágenes de productos
  INSERT INTO media (filename, entity_type, created_at)
  SELECT image_url, 'product', NOW()
  FROM product_images
  WHERE image_url IS NOT NULL;

  UPDATE product_images pi
  SET media_id = m.id
  FROM media m
  WHERE m.filename = pi.image_url AND m.entity_type = 'product';

  -- Migrar banners
  INSERT INTO media (filename, entity_type, created_at)
  SELECT image_url, 'banner', NOW()
  FROM banners
  WHERE image_url IS NOT NULL;

  UPDATE banners b
  SET media_id = m.id
  FROM media m
  WHERE m.filename = b.image_url AND m.entity_type = 'banner';

  -- Migrar logo branding
  INSERT INTO media (filename, entity_type, created_at)
  SELECT
    REPLACE(REPLACE(logo_url, '/uploads/branding/', ''), '/uploads/', ''),
    'branding',
    NOW()
  FROM branding
  WHERE logo_url IS NOT NULL;

  UPDATE branding br
  SET logo_media_id = m.id
  FROM media m
  WHERE br.logo_url IS NOT NULL
    AND m.entity_type = 'branding';
  ```

- [ ] **Migration `0XX_media_cleanup.sql`**: hacer NOT NULL las FKs y quitar columnas legacy (solo ejecutar tras verificar datos)
  ```sql
  -- Solo tras verificar que todos los registros tienen media_id
  -- ALTER TABLE product_images DROP COLUMN image_url;
  -- ALTER TABLE banners DROP COLUMN image_url;
  -- ALTER TABLE branding DROP COLUMN logo_url;
  ```

### BFF — `config/upload.ts`
- [ ] Unificar en un solo directorio `uploads/`:
  ```typescript
  export const UPLOADS_DIR = join(__dirname, '../../uploads')
  mkdirSync(UPLOADS_DIR, { recursive: true })
  export const uploadMiddleware = makeUpload(UPLOADS_DIR)
  // Todos los módulos usan el mismo uploadMiddleware
  ```
- [ ] Eliminar `UPLOADS_PRODUCTS_DIR`, `UPLOADS_BRANDING_DIR`, `UPLOADS_BANNERS_DIR`

### BFF — mover archivos físicos
- [ ] Script one-off `scripts/migrate-uploads.ts`:
  ```typescript
  // Mueve uploads/products/* → uploads/
  // Mueve uploads/branding/* → uploads/
  // Mueve uploads/banners/*  → uploads/
  // Preserva filenames (son UUIDs, sin colisión)
  ```

### BFF — adaptar controllers
- [ ] `products.controller.ts`: al insertar imagen, crear registro en `media` y usar `media_id`
- [ ] `admin/banners.controller.ts`: ídem para banners
- [ ] `config.controller.ts`: ídem para logo branding
- [ ] URL pública: cambiar de `/uploads/products/${f}` a `/uploads/${f}` en todos los controllers

### BFF — `app.ts`
- [ ] Reemplazar los 3 `express.static` por uno solo:
  ```typescript
  app.use('/uploads', express.static(UPLOADS_DIR))
  ```

### WEB — actualizar URLs si es necesario
- [ ] Verificar que no haya URLs hardcodeadas con `/uploads/products/` o `/uploads/branding/` en el frontend
- [ ] Si el BFF retorna la URL completa, el frontend no necesita cambios

## Dev Notes

### Estrategia de migración sin downtime
1. Ejecutar migration de schema (ADD COLUMN media_id)
2. Ejecutar migration de datos (poblar media + actualizar FKs)
3. Correr script de mover archivos físicos
4. Deployar nuevo código que usa `media_id` y `/uploads/` raíz
5. Verificar en producción que todas las imágenes cargan
6. Ejecutar cleanup migration (DROP COLUMN legacy) solo tras verificación

### Sin colisiones de filename
Los filenames son UUIDs generados por `randomUUID()`, garantizando unicidad incluso al mezclar los tres directorios en uno.

### Backward compatibility durante transición
Mientras se completa la migración, los controllers pueden construir la URL probando ambos prefijos:
```typescript
function buildImageUrl(filename: string): string {
  return `/uploads/${filename}`
}
```
Express sirve `/uploads/` y también puede seguir sirviendo `/uploads/products/` si se mantiene el static del subdirectorio durante la transición.

### Referencias
- [Source: jedami-bff/src/config/upload.ts]
- [Source: jedami-bff/src/app.ts]
- [Source: jedami-bff/src/modules/products/products.controller.ts]
- [Source: jedami-bff/src/modules/admin/admin.controller.ts] (banners)
- [Source: jedami-bff/src/modules/config/config.controller.ts]
- Migración de datos debe ejecutarse en una transacción

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
