# Story 13.2: Banner del Catálogo — BFF

Status: done

## Story

Como administrador,
quiero gestionar un conjunto de imágenes que se muestren como banner rotativo en la parte superior del catálogo,
para poder comunicar promociones, novedades o la identidad visual de la tienda.

## Acceptance Criteria

1. **Given** el admin sube una imagen via `POST /admin/banners`
   **When** el archivo es válido (jpg/png/webp/gif, ≤5 MB)
   **Then** la imagen se guarda en disco en `uploads/banners/` y se registra en la tabla `banners` con `sort_order` = último + 1
   **And** retorna `{ data: { id, imageUrl, linkUrl, sortOrder, active } }`

2. **Given** cualquier cliente llama `GET /config/banners`
   **When** existen banners con `active = true`
   **Then** retorna la lista ordenada por `sort_order ASC`
   **And** el endpoint es público (sin auth)

3. **Given** el admin llama `PATCH /admin/banners/:id`
   **When** el body contiene `active`, `linkUrl` o ambos
   **Then** se actualizan los campos indicados
   **And** retorna el banner actualizado

4. **Given** el admin llama `DELETE /admin/banners/:id`
   **When** el banner existe
   **Then** se elimina el registro de la DB y el archivo del disco
   **And** retorna 204

5. **Given** el admin llama `PATCH /admin/banners/reorder` con `[{ id, sortOrder }]`
   **When** todos los IDs existen
   **Then** se actualizan los `sort_order` de cada banner en una transacción
   **And** retorna 200

6. **Given** se sube un archivo que no es imagen o supera 5 MB
   **When** el BFF procesa el request
   **Then** retorna 400 con mensaje descriptivo

## Tasks / Subtasks

- [ ] **Migration `029_banners.sql`**:
  ```sql
  CREATE TABLE banners (
    id         SERIAL PRIMARY KEY,
    image_url  TEXT        NOT NULL,
    link_url   TEXT        DEFAULT NULL,
    sort_order INT         NOT NULL DEFAULT 0,
    active     BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  ```

- [ ] **`config/upload.ts`**: agregar `UPLOADS_BANNERS_DIR` y `uploadBannersMiddleware`
  ```typescript
  export const UPLOADS_BANNERS_DIR = join(__dirname, '../../uploads/banners');
  mkdirSync(UPLOADS_BANNERS_DIR, { recursive: true });
  export const uploadBannersMiddleware = makeUpload(UPLOADS_BANNERS_DIR);
  ```

- [ ] **`modules/config/config.controller.ts`**: agregar handler `getBanners`
  - Query: `SELECT id, image_url, link_url, sort_order, active FROM banners WHERE active = true ORDER BY sort_order ASC`
  - Mapear `image_url` → URL pública `/uploads/banners/<filename>`

- [ ] **`modules/admin/`**: crear `banners.controller.ts` con handlers:
  - `uploadBanner`: recibe multipart, inserta en DB con sort_order = MAX(sort_order)+1
  - `updateBanner`: PATCH parcial de `active` y/o `link_url`
  - `deleteBanner`: elimina de DB y borra archivo del disco con `fs.unlink`
  - `reorderBanners`: transacción con UPDATE sort_order por id

- [ ] **`routes/config.routes.ts`**: agregar `GET /config/banners` (público)

- [ ] **`routes/admin.routes.ts`**: agregar rutas con auth + ADMIN:
  ```
  POST   /admin/banners          (uploadBannersMiddleware)
  PATCH  /admin/banners/reorder
  PATCH  /admin/banners/:id
  DELETE /admin/banners/:id
  ```

- [ ] **`app.ts`**: servir estáticos `uploads/banners` en `/uploads/banners`

## Dev Notes

### Tabla `banners`
`image_url` almacena solo el filename (ej: `uuid.jpg`). La URL pública se construye en el controller: `/uploads/banners/${row.image_url}`.

### Respuesta de `GET /config/banners`
```json
{
  "data": [
    { "id": 1, "imageUrl": "/uploads/banners/abc.jpg", "linkUrl": null, "sortOrder": 1 },
    { "id": 2, "imageUrl": "/uploads/banners/def.jpg", "linkUrl": "/catalogo?categoria=3", "sortOrder": 2 }
  ]
}
```

### Upload handler
```typescript
export async function uploadBanner(req: Request, res: Response, next: NextFunction) {
  if (!req.file) {
    next(new AppError(400, 'Imagen requerida', '...', 'Debe enviar un archivo de imagen'))
    return
  }
  const { linkUrl } = req.body
  const sortRes = await pool.query('SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM banners')
  const sortOrder = Number(sortRes.rows[0].next)
  const result = await pool.query(
    'INSERT INTO banners (image_url, link_url, sort_order) VALUES ($1, $2, $3) RETURNING *',
    [req.file.filename, linkUrl ?? null, sortOrder],
  )
  const b = result.rows[0]
  res.status(201).json({ data: {
    id: b.id,
    imageUrl: `/uploads/banners/${b.image_url}`,
    linkUrl: b.link_url,
    sortOrder: b.sort_order,
    active: b.active,
  }})
}
```

### Delete handler (con limpieza de archivo)
```typescript
import { unlink } from 'fs/promises'
import { join } from 'path'
import { UPLOADS_BANNERS_DIR } from '../../config/upload.js'

export async function deleteBanner(req: Request, res: Response, next: NextFunction) {
  const id = parseInt(req.params.id, 10)
  const result = await pool.query('DELETE FROM banners WHERE id = $1 RETURNING image_url', [id])
  if (result.rowCount === 0) {
    next(new AppError(404, 'Banner no encontrado', '...', `No existe banner con id ${id}`))
    return
  }
  const filename = result.rows[0].image_url
  try { await unlink(join(UPLOADS_BANNERS_DIR, filename)) } catch { /* ignorar si ya no existe */ }
  res.status(204).send()
}
```

### Ruta reorder — atención al orden
`PATCH /admin/banners/reorder` debe estar ANTES de `PATCH /admin/banners/:id` en el router para que Express no interprete "reorder" como un `:id`.

### Servir estáticos en app.ts
```typescript
app.use('/uploads/banners', express.static(UPLOADS_BANNERS_DIR))
```

### Referencias
- [Source: jedami-bff/src/config/upload.ts]
- [Source: jedami-bff/src/modules/admin/admin.controller.ts]
- [Source: jedami-bff/src/routes/admin.routes.ts]
- [Source: jedami-bff/src/routes/config.routes.ts]
- [Source: jedami-bff/src/app.ts]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
