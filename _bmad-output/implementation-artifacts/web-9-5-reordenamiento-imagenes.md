# Story W9.5: Reordenamiento de Imágenes de Producto — Web

Status: done

## Story

Como administrador,
quiero reordenar las imágenes de un producto desde el panel de edición,
para controlar cuál imagen aparece como thumbnail en el catálogo.

## Acceptance Criteria

1. **Given** el admin está editando un producto con múltiples imágenes
   **When** ve la lista de imágenes
   **Then** cada imagen tiene botones ↑ y ↓ para moverla en el orden
   **And** la primera imagen de la lista está marcada como "Principal"

2. **Given** el admin reordena las imágenes usando los botones
   **When** hace click en ↑ o ↓
   **Then** el orden visual cambia inmediatamente en la UI

3. **Given** el admin termina de reordenar y hace click en "Guardar orden"
   **When** se llama `PATCH /products/:id/images/reorder`
   **Then** el nuevo orden se persiste en el BFF
   **And** se muestra `"Orden guardado"` por 2.5 segundos

4. **Given** el guardado falla
   **When** ocurre el error
   **Then** se muestra el mensaje de error del BFF

## Tasks / Subtasks

- [ ] Agregar `reorderProductImages(productId, items: {id, position}[])` en `src/api/admin.products.api.ts` o equivalente (AC: 3)
- [ ] Actualizar la vista de edición de producto en `AdminProductsView.vue` o la vista de detalle de producto admin (AC: 1, 2, 3, 4):
  - [ ] Mostrar lista de imágenes con orden actual
  - [ ] Botones ↑ / ↓ que reordenan el array local
  - [ ] Badge "Principal" en la primera imagen
  - [ ] Botón "Guardar orden" que llama al endpoint
  - [ ] Estado `reorderSaving`, `reorderSuccess`, `reorderError`

## Dev Notes

### Función API
```typescript
// admin.products.api.ts o equivalente
export async function reorderProductImages(
  productId: number,
  items: { id: number; position: number }[]
): Promise<void> {
  await apiClient.patch(`/products/${productId}/images/reorder`, items)
}
```

### Lógica de move up / move down
```typescript
// images: ref<{ id: number; url: string; position: number }[]>

function moveImage(index: number, direction: 'up' | 'down') {
  const arr = [...images.value]
  const swapWith = direction === 'up' ? index - 1 : index + 1
  if (swapWith < 0 || swapWith >= arr.length) return
  ;[arr[index], arr[swapWith]] = [arr[swapWith], arr[index]]
  images.value = arr
}
```

### Guardar el orden
```typescript
const reorderSaving = ref(false)
const reorderSuccess = ref(false)
const reorderError = ref('')

async function saveImageOrder() {
  reorderSaving.value = true
  reorderError.value = ''
  try {
    const items = images.value.map((img, i) => ({ id: img.id, position: i + 1 }))
    await reorderProductImages(props.productId, items)
    reorderSuccess.value = true
    setTimeout(() => { reorderSuccess.value = false }, 2500)
  } catch (e: any) {
    reorderError.value = e?.response?.data?.detail ?? 'Error al guardar el orden'
  } finally {
    reorderSaving.value = false }
}
```

### Template de imagen con controles
```vue
<div class="space-y-2">
  <div
    v-for="(img, idx) in images"
    :key="img.id"
    class="flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-2"
  >
    <img :src="img.url" class="h-14 w-14 object-cover rounded-lg" />
    <span v-if="idx === 0" class="text-xs font-semibold text-[var(--color-primary)]">Principal</span>
    <div class="ml-auto flex gap-1">
      <button @click="moveImage(idx, 'up')" :disabled="idx === 0" class="text-gray-400 hover:text-gray-700 disabled:opacity-20 text-lg leading-none">↑</button>
      <button @click="moveImage(idx, 'down')" :disabled="idx === images.length - 1" class="text-gray-400 hover:text-gray-700 disabled:opacity-20 text-lg leading-none">↓</button>
    </div>
  </div>
</div>
<div class="flex items-center gap-3 mt-3">
  <button
    @click="saveImageOrder"
    :disabled="reorderSaving"
    class="h-9 px-4 rounded-lg border border-gray-300 text-sm font-medium hover:border-[var(--color-primary)] disabled:opacity-40"
  >{{ reorderSaving ? 'Guardando…' : 'Guardar orden' }}</button>
  <span v-if="reorderSuccess" class="text-xs text-green-600 font-semibold">✓ Orden guardado</span>
  <span v-if="reorderError" class="text-xs text-red-500">{{ reorderError }}</span>
</div>
```

### Dónde integrar
Buscar en `AdminProductsView.vue` la sección donde se muestran las imágenes del producto. El array de imágenes ya debería estar disponible desde la carga del producto. Agregar el bloque de reordenamiento después de la lista de imágenes existente.

### Depende de
Story 9-6 (BFF reordenamiento imágenes) debe estar done.

### Referencias
- [Source: jedami-web/src/views/admin/AdminProductsView.vue]
- [Source: jedami-web/src/api/admin.products.api.ts o equivalente]

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Debug Log References
N/A

### Completion Notes List
- `reorderProductImages` importado en `ProductFormDialog.vue` desde `admin.api`
- `moveImage(index, direction)` intercambia elementos en `localImages` localmente
- `saveImageOrder()` mapea posiciones 1-based y llama al PATCH endpoint
- Badge "Principal" en la primera imagen de la lista
- Botones ↑/↓ visibles al hacer hover sobre cada imagen
- Feedback de estado: "Guardando...", "Orden guardado" (2.5s), mensaje de error

### File List
- jedami-web/src/components/features/admin/ProductFormDialog.vue
- jedami-web/src/api/admin.api.ts (reorderProductImages ya agregado en sesión anterior)
