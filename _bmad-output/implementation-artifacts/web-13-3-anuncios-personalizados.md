# Story web-13.3: Anuncios Personalizados — WEB

Status: done

## Story

Como comprador (o visitante),
quiero ver anuncios relevantes en el sidebar del catálogo y del detalle de producto,
para enterarme de promociones y novedades que aplican a mi tipo de cuenta.

Como administrador,
quiero gestionar los anuncios desde el panel admin (crear, editar, activar/desactivar, reordenar, eliminar).

## Acceptance Criteria

1. **Given** el usuario está en `/catalogo`
   **When** hay anuncios vigentes para su audiencia
   **Then** se muestran en un sidebar sticky a la derecha del contenido (visible en pantallas `lg` en adelante)
   **And** en mobile (`< lg`) los anuncios se muestran debajo de la grilla de productos

2. **Given** el usuario está en `/catalogo/:id` (detalle de producto)
   **When** hay anuncios vigentes para su audiencia
   **Then** se muestran en el mismo sidebar a la derecha del contenido del producto

3. **Given** el sidebar se muestra
   **Then** cada card de anuncio muestra: imagen (si existe), título, body (si existe), botón CTA con `link_label` (si existe `link_url`)
   **And** si el link es ruta interna (`/`), navega con `router.push`; si es externo, abre en `_blank`

4. **Given** no hay anuncios vigentes para la audiencia del usuario
   **Then** el sidebar no se renderiza y el contenido ocupa todo el ancho

5. **Given** el usuario es visitante
   **Then** se piden anuncios con `?audience=all`
   **Given** el usuario tiene rol `wholesale`
   **Then** se piden con `?audience=wholesale`
   **Given** el usuario tiene rol `retail`
   **Then** se piden con `?audience=retail`

6. **Given** el admin accede a `/admin/anuncios`
   **Then** ve la lista de todos los anuncios (incluye inactivos)
   **And** puede crear uno nuevo (título, body, imagen, link, label del CTA, audiencia target, fechas de vigencia opcionales)
   **And** puede activar/desactivar, reordenar (↑↓) y eliminar cada anuncio

7. **Given** el admin crea un anuncio con imagen
   **Then** puede subir un archivo de imagen (campo `image`)
   **And** la preview se muestra en la lista

8. **Given** el admin accede a `/admin`
   **Then** ve una card "Anuncios" en el panel principal

## Tasks / Subtasks

- [x] `src/api/announcements.api.ts` — funciones: `fetchAnnouncements(audience)`, `fetchAllAnnouncements`, `createAnnouncement`, `updateAnnouncement`, `reorderAnnouncements`, `deleteAnnouncement`
- [x] `AppLayout.vue` — agregar slot `sidebar` opcional con layout de dos columnas cuando hay contenido en el sidebar
- [x] `AnnouncementSidebar.vue` — componente en `src/components/features/catalog/`:
  - Fetch en `onMounted` con audiencia derivada del authStore
  - Skeleton loader (2 cards)
  - Renderiza cada card: imagen, título, body, botón CTA
  - Se oculta si no hay anuncios
- [x] `CatalogView.vue` — agregar `<template #sidebar>` con `<AnnouncementSidebar>`
- [x] `ProductView.vue` — ídem
- [x] `AdminAnnouncementsView.vue` en `src/views/admin/`:
  - Lista con thumbnail, badge audiencia, badge estado (activo/inactivo), fechas de vigencia
  - Toggle activo/inactivo
  - Reordenar con botones ↑↓
  - Eliminar con confirmación
  - Formulario de creación (inline o sección abajo): título, body, imagen, link_url, link_label, target_audience (select), valid_from, valid_until
- [x] Router: agregar `/admin/anuncios` → `AdminAnnouncementsView`
- [x] `AdminView.vue` — agregar card "Anuncios"

## Dev Notes

### API client — announcements.api.ts
```typescript
export interface Announcement {
  id: number
  title: string
  body: string | null
  imageUrl: string | null
  linkUrl: string | null
  linkLabel: string | null
  targetAudience: 'all' | 'authenticated' | 'wholesale' | 'retail'
  active: boolean
  validFrom: string | null
  validUntil: string | null
  sortOrder: number
}

export function fetchAnnouncements(audience: 'all' | 'wholesale' | 'retail') {
  return api.get<{ data: Announcement[] }>(`/config/announcements?audience=${audience}`)
    .then(r => r.data.data)
}
```

### AppLayout.vue — sidebar slot
```vue
<main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
  <template v-if="$slots.sidebar">
    <div class="flex flex-col lg:flex-row gap-6">
      <div class="flex-1 min-w-0">
        <slot />
      </div>
      <aside class="w-full lg:w-72 flex-none">
        <slot name="sidebar" />
      </aside>
    </div>
  </template>
  <slot v-else />
</main>
```

### AnnouncementSidebar.vue — audiencia según authStore
```typescript
const audience = computed(() => {
  if (!authStore.isAuthenticated) return 'all'
  if (authStore.roles.includes('wholesale')) return 'wholesale'
  return 'retail'
})
```

### Uso en CatalogView y ProductView
```vue
<AppLayout>
  <!-- contenido existente -->
  <template #sidebar>
    <AnnouncementSidebar />
  </template>
</AppLayout>
```

### Badge de audiencia en AdminAnnouncementsView
```
all         → badge gris  "Todos"
authenticated → badge azul "Autenticados"
wholesale   → badge indigo "Mayoristas"
retail      → badge pink  "Minoristas"
```

### Formulario de creación — target_audience
Select con opciones: Todos / Solo autenticados / Mayoristas / Minoristas

### Depende de
- Story 13-3-anuncios-personalizados (BFF) — done

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Completion Notes
- `announcements.api.ts`: tipado completo con interface `Announcement`, `createAnnouncement` usa FormData para imagen opcional
- `AppLayout.vue`: slot `sidebar` con detección `$slots.sidebar` — layout flex col→row en lg, sin cambios en vistas que no lo usan
- `AnnouncementSidebar.vue`: audiencia derivada de `authStore.isWholesale` → wholesale, `isAuthenticated` → retail, guest → all; sticky lg:top-24; skeleton 2 cards; click navega interno vs externo
- `CatalogView.vue` y `ProductView.vue`: `<template #sidebar><AnnouncementSidebar /></template>`
- `AdminAnnouncementsView.vue`: CRUD completo — formulario con preview imagen, badges por audiencia (gris/azul/indigo/pink), toggle active, reorder ↑↓, delete con confirmación inline; vacio state con emoji
- Router: `/admin/anuncios` → `AdminAnnouncementsView` con `requiresRole: ROLES.ADMIN`
- `AdminView.vue`: card "Anuncios" con emoji 📢
- TypeScript sin errores

### File List
- jedami-web/src/api/announcements.api.ts (nuevo)
- jedami-web/src/layouts/AppLayout.vue
- jedami-web/src/components/features/catalog/AnnouncementSidebar.vue (nuevo)
- jedami-web/src/views/CatalogView.vue
- jedami-web/src/views/ProductView.vue
- jedami-web/src/views/admin/AdminAnnouncementsView.vue (nuevo)
- jedami-web/src/views/admin/AdminView.vue
- jedami-web/src/router/index.ts
