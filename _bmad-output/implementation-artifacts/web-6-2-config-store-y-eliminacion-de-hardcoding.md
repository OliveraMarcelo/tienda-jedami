# Story W6.2: Config Store y Eliminación de Hardcoding — Web

Status: done

## Story

Como usuario de la aplicación,
quiero que la app cargue la configuración del sistema desde el servidor al iniciar,
para que los tipos de compra, roles y modos de precio sean dinámicos y no estén hardcodeados en el frontend.

## Acceptance Criteria

1. **Given** la app inicia
   **When** `App.vue` monta
   **Then** se hace `GET /api/v1/config` antes de renderizar las rutas
   **And** mientras carga se muestra un skeleton de pantalla completa (header + contenido)

2. **Given** el config store está cargado
   **When** cualquier componente necesita los tipos de compra, roles o modos de precio
   **Then** los obtiene de `useConfigStore()` en lugar de strings literales

3. **Given** el código del frontend
   **When** se revisa
   **Then** no hay strings `'admin'`, `'wholesale'`, `'retail'`, `'curva'`, `'cantidad'` hardcodeados
   **And** todos los valores de dominio vienen de `@/lib/constants.ts` o del config store

4. **Given** la UI del `RegisterView` y `ProductView`
   **When** se renderizan
   **Then** los botones de tipo de cliente y las tabs de tipo de compra se generan con `v-for` desde `configStore.config`

## Tasks / Subtasks

- [x] Crear `src/api/config.api.ts`: `fetchConfig()` → `GET /api/v1/config`
- [x] Crear `src/stores/config.store.ts`: estado `{ roles, priceModes, purchaseTypes, customerTypes }`, acción `loadConfig()` idempotente
- [x] Crear `src/lib/constants.ts`: `ROLES`, `MODES`, `PURCHASE_TYPES`, `CUSTOMER_TYPES` como constantes tipadas
- [x] Actualizar `App.vue`: `await configStore.loadConfig()` en `onMounted`, mostrar `AppSkeleton` mientras `configStore.loading`
- [x] Crear `src/components/AppSkeleton.vue`: placeholder header + 8-card grid con `animate-pulse`
- [x] `RegisterView.vue`: customer type buttons con `v-for="ct in configStore.config.customerTypes"`
- [x] `ProductView.vue`: tabs mayoristas con `v-for="tab in wholesaleTabs"` filtradas por `pt.code !== MODES.RETAIL`
- [x] `ModeIndicator.vue`: icon y label desde `configStore.config.priceModes` en lugar de emojis hardcodeados
- [x] `OrdersView.vue`, `OrderDetailView.vue`: `purchaseTypeLabel` desde `configStore.purchaseTypeLabel`
- [x] `ProfileView.vue`: role badges y customer type label desde config store

## Dev Notes

### Stack Web
- Vue 3 + Composition API + TypeScript + Pinia + Axios (apiClient default export)
- Vite 7.x + shadcn-vue + Tailwind CSS
- `src/api/client.ts` exporta `export default apiClient` — importar como `import apiClient from './client'` (NO named import)

### Config store patrón
```typescript
// stores/config.store.ts — acción idempotente
async loadConfig() {
  if (this.loaded || this.loading) return
  this.loading = true
  const data = await fetchConfig()
  this.config = data
  this.loaded = true
  this.loading = false
}
// computed maps para lookups O(1)
purchaseTypeLabel: computed → Record<code, label>
customerTypeLabel: computed → Record<code, label>
priceModeLabel:    computed → Record<code, label>
```

### App.vue skeleton pattern
```vue
<AppSkeleton v-if="configStore.loading" />
<RouterView v-else />
```

### ProductView tabs dinámicas
```typescript
const wholesaleTabs = computed(() =>
  configStore.config.purchaseTypes.filter(pt => pt.code !== MODES.RETAIL)
)
```
El contenido de los tabs usa `v-if="wholesaleTab === 'curva'"` / `v-else-if="wholesaleTab === 'cantidad'"` + `v-else` fallback para tipos futuros.

### Error conocido resuelto
`client.ts` usa `export default` — `config.api.ts` debe importar como `import apiClient from './client'` (no `{ apiClient }`).

### Referencias
- [Source: jedami-web/src/api/config.api.ts]
- [Source: jedami-web/src/stores/config.store.ts]
- [Source: jedami-web/src/lib/constants.ts]
- [Source: jedami-web/src/components/AppSkeleton.vue]
- [Source: jedami-web/src/App.vue]
- [Source: jedami-web/src/views/RegisterView.vue]
- [Source: jedami-web/src/views/ProductView.vue]
- [Source: jedami-web/src/components/features/catalog/ModeIndicator.vue]

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Completion Notes List
- Implementado en sesión 2026-03-15
- La UI de RegisterView y ProductView se volvió completamente dinámica desde la DB
- Se agregó icon VARCHAR(10) a las tablas de config para soportar emojis en UI
- El error "apiClient is not exported" fue causado por usar named import sobre default export

### File List
- jedami-web/src/api/config.api.ts
- jedami-web/src/stores/config.store.ts
- jedami-web/src/lib/constants.ts
- jedami-web/src/components/AppSkeleton.vue
- jedami-web/src/App.vue
- jedami-web/src/views/RegisterView.vue
- jedami-web/src/views/ProductView.vue
- jedami-web/src/components/features/catalog/ModeIndicator.vue
- jedami-web/src/views/OrdersView.vue
- jedami-web/src/views/OrderDetailView.vue
- jedami-web/src/views/ProfileView.vue
- jedami-web/src/api/orders.api.ts
- jedami-web/src/api/auth.api.ts
- jedami-web/src/api/profile.api.ts
