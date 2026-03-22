# Story W9.4: Búsqueda de Texto en el Catálogo — Web

Status: done

## Story

Como visitante o comprador,
quiero buscar productos por nombre en el catálogo,
para encontrar rápidamente lo que necesito sin scrollear por todas las categorías.

## Acceptance Criteria

1. **Given** el usuario está en `CatalogView`
   **When** escribe en el campo de búsqueda
   **Then** la lista de productos se actualiza automáticamente (con debounce de 400ms) mostrando solo los que coinciden

2. **Given** hay texto en el campo de búsqueda
   **When** el usuario hace click en ✕
   **Then** el campo se limpia y se muestran todos los productos nuevamente

3. **Given** la búsqueda no tiene resultados
   **When** el catálogo responde
   **Then** se muestra el mensaje `"No encontramos productos para '[término]'. Probá con otra búsqueda."`

4. **Given** hay una búsqueda activa y el usuario cambia de categoría
   **When** selecciona una categoría
   **Then** la búsqueda se combina con el filtro de categoría (ambos activos simultáneamente)

5. **Given** el URL del catálogo
   **When** tiene `?search=remera`
   **Then** el campo de búsqueda se pre-llena con ese término al cargar la página

## Tasks / Subtasks

- [ ] Actualizar `src/api/products.api.ts` o equivalente: agregar `search?: string` al tipo de params de `fetchProducts` (AC: 1)
- [ ] Actualizar `src/stores/products.store.ts` o `CatalogView.vue`: agregar `search` como filtro (AC: 1, 4)
- [ ] Actualizar `CatalogView.vue` (AC: 1, 2, 3, 4, 5):
  - [ ] Agregar input de búsqueda con botón ✕
  - [ ] Implementar debounce de 400ms sobre el valor del input
  - [ ] Pre-llenar desde `?search=` en la URL
  - [ ] Actualizar el URL con `router.push` al buscar (AC: 5)
  - [ ] Mostrar mensaje de "sin resultados" (AC: 3)

## Dev Notes

### Debounce sin librería externa
```typescript
import { ref, watch } from 'vue'

const searchInput = ref('')
const searchApplied = ref('')
let debounceTimer: ReturnType<typeof setTimeout>

watch(searchInput, (val) => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    searchApplied.value = val
    page.value = 1
    loadProducts()
  }, 400)
})
```

### Pre-llenar desde URL y sincronizar
```typescript
import { useRoute, useRouter } from 'vue-router'
const route = useRoute()
const router = useRouter()

onMounted(() => {
  searchInput.value = (route.query.search as string) ?? ''
})

// Al aplicar la búsqueda:
router.replace({ query: { ...route.query, search: searchApplied.value || undefined } })
```

### Template del buscador
```vue
<div class="relative">
  <input
    v-model="searchInput"
    type="text"
    placeholder="Buscar productos..."
    class="h-10 w-full rounded-xl border border-gray-300 pl-4 pr-9 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
  />
  <button
    v-if="searchInput"
    @click="searchInput = ''"
    class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
  >✕</button>
</div>
```

### Mensaje de sin resultados
```vue
<div v-if="!loading && products.length === 0 && searchApplied" class="text-center py-16 text-gray-500">
  <p class="text-lg font-medium">No encontramos productos para "{{ searchApplied }}".</p>
  <p class="text-sm mt-1">Probá con otra búsqueda.</p>
</div>
```

### Pasar search al API
```typescript
const { products, total } = await fetchProducts({
  page: page.value,
  pageSize: 20,
  categoryId: selectedCategory.value,
  search: searchApplied.value || undefined,
})
```

### Depende de
Story 9-5 (BFF búsqueda en catálogo) debe estar done.

### Referencias
- [Source: jedami-web/src/views/CatalogView.vue]
- [Source: jedami-web/src/api/products.api.ts o equivalente]
- [Source: jedami-web/src/stores/products.store.ts]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
