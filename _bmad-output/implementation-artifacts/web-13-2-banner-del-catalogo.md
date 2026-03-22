# Story web-13.2: Banner del Catálogo — WEB

Status: done

Depende de: **13-2-banner-del-catalogo** (BFF done)

## Story

Como visitante del catálogo,
quiero ver un banner rotativo con imágenes en la parte superior del catálogo,
para conocer las novedades y promociones de la tienda.

Como administrador,
quiero gestionar esas imágenes desde el panel de admin (subir, activar/desactivar, reordenar, eliminar),
para mantener el banner siempre actualizado.

## Acceptance Criteria

1. **Given** hay banners activos configurados
   **When** el usuario entra al catálogo
   **Then** se muestra un carrusel con las imágenes en la parte superior, ordenadas por `sortOrder`
   **And** el carrusel avanza automáticamente cada 4 segundos
   **And** hay indicadores (dots) para navegar manualmente

2. **Given** un banner tiene `linkUrl` configurado
   **When** el usuario hace click en esa imagen
   **Then** navega a la URL indicada

3. **Given** no hay banners activos
   **When** el usuario entra al catálogo
   **Then** el banner no se renderiza (sin espacio vacío)

4. **Given** el admin está en `/admin/banners`
   **When** sube una imagen (jpg/png/webp, ≤5 MB) con el formulario
   **Then** el banner aparece al final de la lista

5. **Given** el admin ve la lista de banners
   **When** hace click en ↑ o ↓ en un banner
   **Then** se llama `PATCH /admin/banners/reorder` y la lista se reordena visualmente

6. **Given** el admin hace click en el toggle de un banner
   **When** confirma el cambio
   **Then** se llama `PATCH /admin/banners/:id` con `{ active }` y el estado se actualiza

7. **Given** el admin hace click en "Eliminar" en un banner
   **When** confirma el dialog
   **Then** se llama `DELETE /admin/banners/:id` y el banner desaparece de la lista

## Tasks / Subtasks

### API (`src/api/banners.api.ts`)
- [ ] Crear `banners.api.ts` con:
  - `fetchBanners()` → `GET /config/banners`
  - `uploadBanner(file, linkUrl?)` → `POST /admin/banners` (FormData)
  - `updateBanner(id, dto)` → `PATCH /admin/banners/:id`
  - `reorderBanners(items)` → `PATCH /admin/banners/reorder`
  - `deleteBanner(id)` → `DELETE /admin/banners/:id`

### Carrusel en `CatalogView.vue`
- [ ] Importar `fetchBanners` y cargar en `onMounted`
- [ ] Componente inline (o extraer `BannerCarousel.vue`) con:
  - `v-if="banners.length > 0"` para no mostrar nada si está vacío
  - Auto-slide con `setInterval` de 4s, limpiado en `onUnmounted`
  - Dots de navegación: click en dot va al índice
  - Click en imagen: si tiene `linkUrl`, `router.push(linkUrl)` o `window.open` según si es relativa o absoluta
  - Altura fija responsive: `h-40 sm:h-56 md:h-72`
  - Imagen con `object-cover w-full h-full`
  - Transición suave entre slides (fade o slide)

### Panel Admin `AdminBannersView.vue` (`/admin/banners`)
- [ ] Crear vista en `src/views/admin/AdminBannersView.vue`
- [ ] Lista de banners con thumbnail (80×60px), estado active/inactivo, link, botones ↑ ↓ y Eliminar
- [ ] Toggle `active` con click directo (sin modal)
- [ ] Confirmación de eliminación inline (botón "Eliminar" → "¿Seguro? Sí / No")
- [ ] Formulario de upload al final:
  - `<input type="file" accept="image/*">` + campo opcional "Link URL"
  - Botón "Subir banner"
  - Validación client-side: solo imágenes, ≤5 MB
- [ ] Skeleton de carga y manejo de errores

### Router y navegación
- [ ] Agregar ruta `/admin/banners` → `AdminBannersView` en `router/index.ts`
- [ ] Agregar link "Banners" en el panel de admin (`AdminView.vue` o sidebar)

## Dev Notes

### `banners.api.ts`
```typescript
import apiClient from './client'

export interface Banner {
  id: number
  imageUrl: string
  linkUrl: string | null
  sortOrder: number
  active?: boolean
}

export async function fetchBanners(): Promise<Banner[]> {
  const res = await apiClient.get<{ data: Banner[] }>('/config/banners')
  return res.data.data
}

export async function uploadBanner(file: File, linkUrl?: string): Promise<Banner> {
  const form = new FormData()
  form.append('image', file)
  if (linkUrl) form.append('linkUrl', linkUrl)
  const res = await apiClient.post<{ data: Banner }>('/admin/banners', form)
  return res.data.data
}

export async function updateBanner(id: number, dto: { active?: boolean; linkUrl?: string | null }): Promise<Banner> {
  const res = await apiClient.patch<{ data: Banner }>(`/admin/banners/${id}`, dto)
  return res.data.data
}

export async function reorderBanners(items: { id: number; sortOrder: number }[]): Promise<void> {
  await apiClient.patch('/admin/banners/reorder', items)
}

export async function deleteBanner(id: number): Promise<void> {
  await apiClient.delete(`/admin/banners/${id}`)
}
```

### Carrusel — lógica mínima
```typescript
const currentIndex = ref(0)
let timer: ReturnType<typeof setInterval> | null = null

function startAutoPlay() {
  timer = setInterval(() => {
    currentIndex.value = (currentIndex.value + 1) % banners.value.length
  }, 4000)
}

onMounted(() => { fetchBanners().then(b => { banners.value = b; if (b.length > 1) startAutoPlay() }) })
onUnmounted(() => { if (timer) clearInterval(timer) })
```

### Reordenamiento con botones ↑ / ↓
```typescript
async function moveBanner(index: number, dir: -1 | 1) {
  const newList = [...banners.value]
  const target = index + dir
  if (target < 0 || target >= newList.length) return
  ;[newList[index], newList[target]] = [newList[target], newList[index]]
  banners.value = newList.map((b, i) => ({ ...b, sortOrder: i + 1 }))
  await reorderBanners(banners.value.map(b => ({ id: b.id, sortOrder: b.sortOrder })))
}
```

### Validación de archivo client-side
```typescript
function onFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) { uploadError.value = 'Solo se permiten imágenes'; return }
  if (file.size > 5 * 1024 * 1024) { uploadError.value = 'La imagen no puede superar 5 MB'; return }
  selectedFile.value = file
  uploadError.value = ''
}
```

### Ruta admin
```typescript
{ path: '/admin/banners', component: AdminBannersView, meta: { requiresAdmin: true } }
```

### Referencias
- [Source: jedami-web/src/views/CatalogView.vue]
- [Source: jedami-web/src/views/admin/AdminView.vue]
- [Source: jedami-web/src/api/admin.dashboard.api.ts] (patrón API)
- [Source: jedami-web/src/router/index.ts]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
