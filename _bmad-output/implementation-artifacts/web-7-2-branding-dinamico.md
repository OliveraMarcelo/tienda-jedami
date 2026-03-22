# Story W7.2: Branding Dinámico — Web

Status: done

## Story

Como operador del negocio,
quiero que la tienda web aplique el branding configurado en el servidor,
para que los colores y nombre de la tienda se actualicen sin modificar el código.

## Acceptance Criteria

1. **Given** la app inicia
   **When** `App.vue` monta
   **Then** se hace `GET /api/v1/config/branding` junto con `GET /api/v1/config`
   **And** los valores se aplican como CSS variables en `:root`: `--color-primary`, `--color-secondary`

2. **Given** el branding está cargado
   **When** se muestra la UI
   **Then** el nombre de la tienda (`storeName`) aparece en el `<title>` del documento y en el header/navbar

3. **Given** el branding define un `logoUrl`
   **When** no es `null`
   **Then** el logo se muestra en el header junto al nombre de la tienda (logo + nombre, uno al lado del otro)

4. **Given** el `GET /config/branding` falla o retorna null
   **When** la app sigue cargando
   **Then** usa los valores por defecto hardcodeados: `#E91E8C`, `#1E1E2E`, "Jedami"

## Tasks / Subtasks

- [x] Agregar `fetchBranding()` en `src/api/config.api.ts`: `GET /api/v1/config/branding` (AC: 1)
  - [x] Tipar `BrandingConfig`: `{ storeName, primaryColor, secondaryColor, logoUrl: string | null }`
- [x] Agregar estado y acción `loadBranding()` al `config.store.ts` (AC: 1, 4)
  - [x] Estado: `branding: BrandingConfig` (con DEFAULT_BRANDING como valor inicial)
  - [x] Fallback a valores default si la llamada falla
- [x] Actualizar `App.vue`: llamar `loadBranding()` junto con `loadConfig()` en `Promise.all` (AC: 1)
- [x] Aplicar CSS variables dinámicas en `App.vue` o `main.ts` (AC: 1)
  ```typescript
  document.documentElement.style.setProperty('--color-primary', branding.primaryColor)
  document.documentElement.style.setProperty('--color-secondary', branding.secondaryColor)
  ```
- [x] Actualizar `<title>` del documento con `storeName` (AC: 2)
  ```typescript
  document.title = branding.storeName
  ```
- [x] Actualizar el header/AppLayout para mostrar `storeName` o logo (AC: 2, 3)
  - [x] Si `logoUrl` → `<img :src="branding.logoUrl" />`
  - [x] Si no → `<span>{{ branding.storeName }}</span>`

## Dev Notes

### Dónde aplicar CSS variables
En `App.vue` dentro del `onMounted`, después de cargar el branding:
```typescript
const applyBranding = (b: BrandingConfig) => {
  document.documentElement.style.setProperty('--color-primary', b.primaryColor)
  document.documentElement.style.setProperty('--color-secondary', b.secondaryColor)
  document.title = b.storeName
}
```
Las clases Tailwind hardcodeadas con `text-[#E91E8C]` o `bg-[#E91E8C]` deben migrar a `text-[var(--color-primary)]` en los componentes clave (AppLayout header, botones principales).

### Config store extensión (no reescribir)
Agregar al store existente en `config.store.ts`:
```typescript
branding: ref<BrandingConfig | null>(null)

async loadBranding() {
  try {
    const data = await fetchBranding()
    branding.value = data
    applyBrandingCSSVars(data)
  } catch {
    // fallback silencioso — la app usa defaults del CSS
  }
}
```

### Promise.all en App.vue
```typescript
onMounted(async () => {
  await Promise.all([
    configStore.loadConfig(),
    configStore.loadBranding(),
  ])
})
```
El skeleton debe mostrarse mientras cualquiera de los dos esté cargando.

### Tailwind CSS variables
El color `#E91E8C` ya aparece hardcodeado en muchos componentes con la sintaxis `text-[#E91E8C]`. Para esta story, actualizar al menos los componentes del layout principal (header, botones de acción primaria). Los componentes internos de views pueden quedar para una futura story de cleanup.

### Fallback default
```typescript
const DEFAULT_BRANDING: BrandingConfig = {
  storeName: 'Jedami',
  primaryColor: '#E91E8C',
  secondaryColor: '#1E1E2E',
  logoUrl: null,
}
```

### Project Structure Notes
- `config.api.ts`: agregar `fetchBranding()` al archivo existente
- `config.store.ts`: extender el store, no reescribir
- `App.vue`: ya tiene lógica de carga, extender con branding
- Buscar con grep `#E91E8C` para identificar qué componentes actualizar

### Branding viene de DB, no de ENV
El endpoint `GET /config/branding` lee la tabla `branding` (una sola fila, id=1). El admin puede editarla desde el panel en Story W7.5. El frontend no necesita saber esto — solo consume el endpoint normalmente.

### Depende de
Story 7.3 (BFF branding endpoint) debe estar done antes de implementar esta story.

### Referencias
- [Source: jedami-web/src/api/config.api.ts] — agregar fetchBranding
- [Source: jedami-web/src/stores/config.store.ts] — extender
- [Source: jedami-web/src/App.vue] — punto de entrada de carga
- [Source: jedami-web/src/layouts/AppLayout.vue] — header a actualizar

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Debug Log References

### Completion Notes List
- `App.vue` usa `onMounted` + `Promise.all([loadConfig(), loadBranding()])` y `ready` ref local para el skeleton
- CSS vars aplicadas via `watchEffect` sobre `configStore.branding` — reactivo a cambios futuros
- `AppLayout.vue` migrado de `text-[#E91E8C]` hardcodeado a `text-[var(--color-primary)]` y `hover:text-[var(--color-primary)]`
- Logo y nombre de la tienda se muestran siempre juntos (`flex items-center gap-2`); si `logoUrl` es truthy se muestra la imagen además del texto
- Fallback silencioso: si `GET /config/branding` falla, se mantiene DEFAULT_BRANDING

### File List
- jedami-web/src/api/config.api.ts
- jedami-web/src/stores/config.store.ts
- jedami-web/src/App.vue
- jedami-web/src/layouts/AppLayout.vue
