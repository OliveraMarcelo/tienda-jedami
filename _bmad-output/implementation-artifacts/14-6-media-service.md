# Story 14.6: Extracción del Servicio de Medios (media-service)

Status: backlog

## Story

Como desarrollador,
quiero extraer toda la lógica de upload y serving de imágenes del BFF a un microservicio independiente (`jedami-media`),
para poder escalar el almacenamiento de archivos de forma independiente, centralizar la gestión de medios y preparar la migración a S3/CDN en el futuro.

## Contexto

Actualmente el BFF maneja uploads de imágenes de forma dispersa:
- `upload.ts` — 4 middlewares multer (products, branding, banners, announcements)
- `app.ts` — 4 rutas `express.static`
- controllers de productos, banners, branding y anuncios — cada uno llama `unlink` para borrar archivos

El media-service centraliza todo esto: recibe archivos, los guarda, los sirve, y los elimina. El BFF deja de tocar disco.

**Prerrequisito:** Story 14-1 (tabla `media` centralizada) debe estar done antes de implementar esta story.

## Acceptance Criteria

1. **Given** existe el directorio `jedami-media/` en el monorepo
   **Then** es una app Express independiente con su propio `package.json`, puerto y Dockerfile

2. **Given** el BFF necesita subir una imagen
   **When** llama `POST http://media-service/upload/:folder`  con `multipart/form-data` campo `image`
   **Then** el media-service guarda el archivo en disco bajo `uploads/:folder/`
   **And** retorna `{ data: { filename, url } }`

3. **Given** el BFF necesita eliminar una imagen
   **When** llama `DELETE http://media-service/media/:folder/:filename`
   **Then** el archivo se elimina del disco
   **And** retorna 204

4. **Given** cualquier cliente hace `GET /media/:folder/:filename`
   **Then** el media-service sirve el archivo estático con Content-Type correcto

5. **Given** docker-compose levanta
   **Then** el servicio `media` corre en el puerto `3002` (interno) y está accesible desde el BFF como `http://media:3002`

6. **Given** el BFF está actualizado
   **Then** `upload.ts` ya no tiene middlewares multer propios
   **And** `app.ts` ya no tiene rutas `express.static` para imágenes
   **And** los controllers llaman al media-service para upload y delete

7. **Given** el comportamiento externo del sistema
   **Then** las URLs de imágenes siguen resolviendo igual para los clientes (o el BFF proxea las URLs)

## Tasks / Subtasks

### jedami-media/ — nuevo servicio

- [ ] Inicializar `jedami-media/` con `npm init`, TypeScript, Express, Multer
  ```
  jedami-media/
  ├── src/
  │   ├── app.ts          — Express + rutas
  │   ├── routes/
  │   │   └── media.routes.ts
  │   └── config/
  │       └── upload.ts   — multer config
  ├── uploads/            — gitignored
  ├── package.json
  ├── tsconfig.json
  └── Dockerfile
  ```

- [ ] `POST /upload/:folder` — recibe `multipart/form-data`, guarda archivo, retorna `{ data: { filename, url } }`
  - Validar `folder` ∈ `['products', 'branding', 'banners', 'announcements']`
  - Filename: `randomUUID() + ext`
  - Limit: 5 MB, solo imágenes (jpg, png, webp, gif)

- [ ] `DELETE /media/:folder/:filename` — elimina archivo del disco, 404 si no existe, 204 si OK

- [ ] `GET /media/:folder/:filename` — `express.static` sobre `uploads/` (subdirectorios)

- [ ] `GET /health` — retorna `{ status: 'ok' }` para health check de Docker

### jedami-bff/ — adaptar para usar media-service

- [ ] `src/lib/media-client.ts` — cliente HTTP interno:
  ```typescript
  export async function uploadToMediaService(
    folder: string,
    file: Express.Multer.File
  ): Promise<{ filename: string; url: string }>

  export async function deleteFromMediaService(
    folder: string,
    filename: string
  ): Promise<void>
  ```
  Usa `fetch` nativo (Node 18+) con `FormData`

- [ ] `config/upload.ts` — mantener multer solo en memoria (`multer.memoryStorage()`) para recibir el archivo del cliente y luego reenviarlo al media-service. Eliminar los 4 disk-storage middlewares.

- [ ] `app.ts` — eliminar los 4 `express.static` de uploads. El BFF ya no sirve imágenes directamente.

- [ ] Adaptar controllers:
  - `products.controller.ts` — reemplazar `req.file.filename` + `unlink` con `uploadToMediaService` + `deleteFromMediaService`
  - `admin/banners.controller.ts` — ídem
  - `config.controller.ts` (logo branding) — ídem
  - `admin/announcements.controller.ts` — ídem

- [ ] Variables de entorno:
  ```env
  MEDIA_SERVICE_URL=http://media:3002
  ```

### Docker / infraestructura

- [ ] `jedami-media/Dockerfile`:
  ```dockerfile
  FROM node:24-alpine
  WORKDIR /app
  COPY package*.json ./
  RUN npm ci --omit=dev
  COPY dist/ dist/
  VOLUME ["/app/uploads"]
  EXPOSE 3002
  CMD ["node", "dist/app.js"]
  ```

- [ ] `docker-compose.yml` — agregar servicio `media`:
  ```yaml
  media:
    build: ./jedami-media
    ports:
      - "3002:3002"
    volumes:
      - media_uploads:/app/uploads
    environment:
      - NODE_ENV=production
    restart: unless-stopped

  volumes:
    media_uploads:
  ```
  Agregar `media` a la lista de dependencias del servicio `bff`.

- [ ] Makefile — agregar targets `media-dev`, `media-build`

### Prueba de regresión manual

- [ ] Subir imagen de producto → URL accesible desde browser
- [ ] Subir logo de branding → visible en WEB
- [ ] Eliminar imagen de producto → archivo borrado del disco
- [ ] BFF y media corriendo en docker-compose sin errores

## Dev Notes

### Comunicación BFF → media-service

El BFF actúa como proxy: recibe el archivo del cliente web con multer (memory storage), lo reenvía al media-service vía HTTP multipart, y devuelve la URL al cliente.

```
Cliente → [multipart] → BFF → [multipart] → media-service → disco
                          ↑
                    (multer memoryStorage: buffer en RAM, no toca disco)
```

### URL pública de las imágenes

Dos opciones (elegir una):

**Opción A — BFF proxea** (más simple, sin cambios en el frontend):
```
BFF expone:  GET /api/v1/media/:folder/:filename
BFF llama:   GET http://media:3002/media/:folder/:filename
```

**Opción B — media-service expuesto directamente** (mejor performance):
```
Nginx/proxy expone puerto 3002 al exterior
URLs en BD apuntan a http://dominio:3002/media/...
```

Para la primera iteración usar **Opción A** (sin cambios de infraestructura exterior).

### Multer memory storage en BFF

```typescript
// BFF upload.ts — simplificado
export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFileFilter,
}).single('image')
```

El buffer `req.file.buffer` se reenvía al media-service.

### media-client.ts — envío con FormData nativo

```typescript
export async function uploadToMediaService(
  folder: string,
  file: Express.Multer.File,
): Promise<{ filename: string; url: string }> {
  const form = new FormData()
  form.append('image', new Blob([file.buffer], { type: file.mimetype }), file.originalname)

  const res = await fetch(`${ENV.MEDIA_SERVICE_URL}/upload/${folder}`, {
    method: 'POST',
    body: form,
  })
  if (!res.ok) throw new AppError(502, 'Error en media-service', '...', 'No se pudo subir la imagen')
  const json = await res.json() as { data: { filename: string; url: string } }
  return json.data
}
```

### Depende de
- Story 14-1 (tabla media centralizada) — requiere que esté done

### Riesgo principal
Latencia adicional por el hop BFF → media-service. En localhost/Docker es ~1ms. Aceptable para uploads (no es un hot path).

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
