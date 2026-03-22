# Story 9.3: Soft Delete de Talles y Colores — BFF

Status: done

## Story

Como administrador,
quiero desactivar talles y colores en lugar de eliminarlos físicamente,
para preservar la integridad de las variantes existentes y mantener el historial de pedidos coherente.

## Acceptance Criteria

1. **Given** un talle o color tiene variantes asociadas (activas o inactivas)
   **When** el admin lo desactiva desde `PATCH /products/sizes/:id` o `PATCH /products/colors/:id`
   **Then** el registro queda con `active = FALSE` y ya no aparece en `GET /products/sizes` ni `GET /products/colors`
   **And** las variantes existentes que lo referencian no se ven afectadas

2. **Given** un talle o color está inactivo
   **When** el admin quiere reactivarlo
   **Then** `PATCH /products/sizes/:id` con `{ active: true }` lo reactiva y vuelve a aparecer en los listados

3. **Given** se llama `DELETE /products/sizes/:id` o `DELETE /products/colors/:id`
   **When** el endpoint recibe la solicitud
   **Then** retorna 405 Method Not Allowed con `{ detail: "Usar PATCH con { active: false } para desactivar" }`

4. **Given** se listan talles o colores via `GET /products/sizes` y `GET /products/colors`
   **When** el endpoint responde
   **Then** solo retorna registros con `active = TRUE`

## Tasks / Subtasks

- [ ] Migración `023_sizes_colors_soft_delete.sql`: agregar columna `active` a ambas tablas (AC: 1, 4)
  ```sql
  ALTER TABLE sizes  ADD COLUMN active BOOLEAN NOT NULL DEFAULT TRUE;
  ALTER TABLE colors ADD COLUMN active BOOLEAN NOT NULL DEFAULT TRUE;
  ```
- [ ] Actualizar `FIND_ALL_SIZES` en `queries/find-sizes-colors.ts`: agregar `WHERE active = TRUE` (AC: 4)
- [ ] Actualizar `FIND_ALL_COLORS` en `queries/find-sizes-colors.ts`: agregar `WHERE active = TRUE` (AC: 4)
- [ ] Agregar handler `updateSizeHandler` en `products.controller.ts`: `PATCH /products/sizes/:id` (AC: 1, 2)
- [ ] Agregar handler `updateColorHandler` en `products.controller.ts`: `PATCH /products/colors/:id` (AC: 1, 2)
- [ ] Agregar servicio `updateSize(id, active)` y `updateColor(id, active)` en `products.service.ts` (AC: 1, 2)
- [ ] Agregar `updateSize`/`updateColor` en `products.repository.ts` (AC: 1, 2)
- [ ] Cambiar handlers `deleteSizeHandler` y `deleteColorHandler` para retornar 405 (AC: 3)
- [ ] Registrar `PATCH /products/sizes/:id` y `PATCH /products/colors/:id` en `products.routes.ts` (AC: 1, 2)

## Dev Notes

### Migración
```sql
-- 023_sizes_colors_soft_delete.sql
ALTER TABLE sizes  ADD COLUMN active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE colors ADD COLUMN active BOOLEAN NOT NULL DEFAULT TRUE;
```

### Queries actualizadas
```typescript
// find-sizes-colors.ts
export const FIND_ALL_SIZES = `
  SELECT id, label, sort_order
  FROM sizes
  WHERE active = TRUE
  ORDER BY sort_order, label
`
export const FIND_ALL_COLORS = `
  SELECT id, name, hex_code
  FROM colors
  WHERE active = TRUE
  ORDER BY name
`
```

### Query de update
```typescript
export const UPDATE_SIZE_ACTIVE = `
  UPDATE sizes SET active = $2 WHERE id = $1
  RETURNING id, label, sort_order, active
`
export const UPDATE_COLOR_ACTIVE = `
  UPDATE colors SET active = $2 WHERE id = $1
  RETURNING id, name, hex_code, active
`
```

### Handler PATCH
```typescript
export async function updateSizeHandler(req, res, next) {
  try {
    const id = parseId(req.params.id)
    if (!id) { res.status(400).json({ detail: 'ID inválido' }); return }
    const { active } = req.body
    if (typeof active !== 'boolean') { res.status(400).json({ detail: 'active debe ser boolean' }); return }
    const size = await productsService.updateSize(id, active)
    if (!size) { res.status(404).json({ detail: 'Talle no encontrado' }); return }
    res.status(200).json({ data: size })
  } catch (err) { next(err) }
}
```

### Handler DELETE → 405
```typescript
export async function deleteSizeHandler(req, res) {
  res.status(405).json({ detail: 'Usar PATCH con { active: false } para desactivar' })
}
```

### Nota: los JOINs en catálogo NO necesitan cambio
Las queries `find-all-with-variants` y `find-by-id-with-variants` joinean `sizes` y `colors` por FK desde `variants`. El label del talle/color sigue siendo visible en variantes existentes aunque el talle/color esté inactivo — esto es correcto porque esas variantes ya existen.

### References
- [Source: jedami-bff/src/modules/products/queries/find-sizes-colors.ts]
- [Source: jedami-bff/src/modules/products/products.controller.ts]
- [Source: jedami-bff/src/modules/products/products.service.ts]
- [Source: jedami-bff/src/modules/products/products.repository.ts]
- [Source: jedami-bff/src/routes/products.routes.ts]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
