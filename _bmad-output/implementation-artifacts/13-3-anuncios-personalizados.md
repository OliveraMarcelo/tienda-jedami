# Story 13.3: Anuncios Personalizados — BFF

Status: review

## Story

Como administrador,
quiero crear anuncios con texto, imagen opcional y fecha de vigencia dirigidos a segmentos específicos de clientes (todos, mayoristas, minoristas o solo autenticados),
para comunicar promociones y novedades de forma relevante a cada tipo de comprador.

## Acceptance Criteria

1. **Given** se corre la migración
   **Then** existe la tabla `announcements` con columnas: `id`, `title`, `body`, `image_url`, `link_url`, `link_label`, `target_audience`, `active`, `valid_from`, `valid_until`, `sort_order`, `created_at`
   **And** `target_audience` acepta solo `'all' | 'authenticated' | 'wholesale' | 'retail'`

2. **Given** cualquier cliente hace `GET /announcements?audience=all`
   **Then** recibe los anuncios con `active=TRUE` y `target_audience='all'` vigentes (respeta `valid_from`/`valid_until`)

3. **Given** un usuario mayorista hace `GET /announcements?audience=wholesale`
   **Then** recibe anuncios de `target_audience IN ('all', 'authenticated', 'wholesale')` vigentes

4. **Given** un usuario minorista hace `GET /announcements?audience=retail`
   **Then** recibe anuncios de `target_audience IN ('all', 'authenticated', 'retail')` vigentes

5. **Given** el admin hace `GET /admin/announcements`
   **Then** recibe todos los anuncios (incluye inactivos y vencidos)

6. **Given** el admin hace `POST /admin/announcements` con `{ title, body?, imageUrl?, linkUrl?, linkLabel?, targetAudience, validFrom?, validUntil? }`
   **Then** se crea el anuncio y responde 201

7. **Given** el admin hace `POST /admin/announcements` con imagen (`multipart/form-data`, campo `image`)
   **Then** la imagen se guarda en `uploads/announcements/` y `image_url` almacena solo el filename
   **And** el BFF construye la URL completa al devolver el recurso

8. **Given** el admin hace `PATCH /admin/announcements/:id` con cualquier campo
   **Then** solo se actualizan los campos enviados y responde 200

9. **Given** el admin hace `PATCH /admin/announcements/reorder` con `[{ id, sortOrder }]`
   **Then** los sort_order se actualizan en transacción y responde `{ reordered: true }`

10. **Given** el admin hace `DELETE /admin/announcements/:id`
    **Then** el anuncio y su archivo de imagen (si es local) se eliminan y responde 204

## Tasks / Subtasks

- [x] Migración `032_announcements.sql`: crear tabla `announcements`
- [x] Endpoint público `GET /announcements` con filtro por `audience` query param (AC: 2, 3, 4)
  - Query SQL filtra por `active=TRUE`, vigencia y `target_audience`
- [x] Multer config en `upload.ts`: agregar `UPLOADS_ANNOUNCEMENTS_DIR` y `uploadAnnouncementsMiddleware`
- [x] Servir archivos estáticos en `app.ts`: `app.use('/uploads/announcements', express.static(...))`
- [x] Controller `announcements.controller.ts` en `modules/admin/`:
  - `getAnnouncements` (público)
  - `getAllAnnouncements` (admin)
  - `createAnnouncement` (admin, soporta multipart con imagen opcional)
  - `updateAnnouncement` (admin, PATCH parcial)
  - `reorderAnnouncements` (admin, transacción)
  - `deleteAnnouncement` (admin, elimina archivo local si existe)
  - `buildAnnouncementUrl` helper (igual que banners: externas se devuelven tal cual, locales se prefijan)
- [x] Rutas en `config.routes.ts`: `GET /config/announcements` → `getAnnouncements` (público)
- [x] Rutas en `admin.routes.ts`: CRUD completo bajo `/admin/announcements`

## Dev Notes

### Migración 032_announcements.sql
```sql
CREATE TABLE announcements (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT,
  image_url TEXT,
  link_url TEXT,
  link_label VARCHAR(60) DEFAULT 'Ver más',
  target_audience VARCHAR(20) NOT NULL DEFAULT 'all'
    CHECK (target_audience IN ('all', 'authenticated', 'wholesale', 'retail')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  valid_from  TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Query pública con filtro de audiencia
```sql
SELECT id, title, body, image_url, link_url, link_label, target_audience, sort_order
FROM announcements
WHERE active = TRUE
  AND (valid_from IS NULL OR valid_from <= NOW())
  AND (valid_until IS NULL OR valid_until >= NOW())
  AND (
    target_audience = 'all'
    OR target_audience = $1
    OR ($1 != 'all' AND target_audience = 'authenticated')
  )
ORDER BY sort_order ASC
```
Parámetro `$1` = valor del query param `audience` (`all` | `wholesale` | `retail`).

### upload.ts — agregar
```typescript
export const UPLOADS_ANNOUNCEMENTS_DIR = join(UPLOADS_BASE_DIR, 'announcements');
await mkdir(UPLOADS_ANNOUNCEMENTS_DIR, { recursive: true });

export const uploadAnnouncementsMiddleware = multer({
  storage: multer.diskStorage({
    destination: UPLOADS_ANNOUNCEMENTS_DIR,
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
  }),
  fileFilter: imageFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
}).single('image');
```

### buildAnnouncementUrl helper
```typescript
function buildAnnouncementUrl(imageUrl: string): string {
  if (!imageUrl) return imageUrl;
  if (imageUrl.startsWith('http') || imageUrl.startsWith('/')) return imageUrl;
  return `/uploads/announcements/${imageUrl}`;
}
```

### createAnnouncement — manejo de imagen opcional
El endpoint acepta `multipart/form-data`. Si se envía `image`, se guarda el filename.
Si no hay imagen, `image_url` queda NULL. Los demás campos vienen en `req.body`.

### Depende de
- Story 9-6 (reorder pattern) — done
- Story 13-2 (banners — mismo patrón de imagen) — done

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Completion Notes
- Migración `032_announcements.sql`: tabla con CHECK constraint en `target_audience`
- `upload.ts`: agregado `UPLOADS_ANNOUNCEMENTS_DIR` y `uploadAnnouncementsMiddleware` usando `makeUpload` existente
- `app.ts`: agregada ruta estática `/uploads/announcements`
- `announcements.controller.ts`: CRUD completo con `buildAnnouncementUrl` (igual que banners), query pública con lógica de audiencia (`all` + `authenticated` + audience específica), reorder en transacción, delete elimina archivo local si no es URL externa
- `config.routes.ts`: `GET /config/announcements?audience=` público con doc Swagger
- `admin.routes.ts`: GET/POST/PATCH reorder/PATCH :id/DELETE con doc Swagger; reorder ANTES de /:id para evitar conflicto Express
- TypeScript sin errores

### File List
- jedami-bff/src/database/migrations/032_announcements.sql (nuevo)
- jedami-bff/src/config/upload.ts
- jedami-bff/src/app.ts
- jedami-bff/src/modules/admin/announcements.controller.ts (nuevo)
- jedami-bff/src/routes/config.routes.ts
- jedami-bff/src/routes/admin.routes.ts
