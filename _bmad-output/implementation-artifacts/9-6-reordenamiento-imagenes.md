# Story 9.6: Reordenamiento de Imágenes de Producto — BFF

Status: done

## Story

Como administrador,
quiero reordenar las imágenes de un producto para elegir cuál es la imagen principal,
para que el catálogo muestre la foto más representativa como thumbnail.

## Acceptance Criteria

1. **Given** un producto tiene múltiples imágenes
   **When** el admin llama `PATCH /products/:id/images/reorder` con `[{ id, position }]`
   **Then** las imágenes se actualizan con el nuevo orden
   **And** el caché del producto se invalida

2. **Given** el array enviado contiene IDs que no pertenecen al producto
   **When** el BFF procesa la solicitud
   **Then** retorna 400 con `{ detail: "IDs de imágenes inválidos para este producto" }`

3. **Given** el array está vacío o malformado
   **When** el BFF procesa la solicitud
   **Then** retorna 400 con mensaje descriptivo

4. **Given** se completa el reordenamiento
   **When** se llama `GET /products/:id`
   **Then** las imágenes se retornan ordenadas por el nuevo `position`

## Tasks / Subtasks

- [ ] Crear handler `reorderImagesHandler` en `products.controller.ts` (AC: 1, 2, 3)
- [ ] Crear función de servicio `reorderProductImages(productId, items: {id, position}[])` en `products.service.ts` (AC: 1, 2)
  - Verificar que todos los IDs pertenezcan al producto (`SELECT id FROM product_images WHERE product_id = $1`)
  - En transacción: UPDATE position para cada imagen
  - Invalidar caché del producto
- [ ] Agregar `reorderImages(productId, items)` en `products.repository.ts` (AC: 1)
- [ ] Registrar `PATCH /products/:id/images/reorder` en `products.routes.ts` con `authMiddleware + requireRole(ADMIN)` (AC: 1)

## Dev Notes

### Body del request
```json
[
  { "id": 3, "position": 1 },
  { "id": 1, "position": 2 },
  { "id": 5, "position": 3 }
]
```

### Lógica transaccional
```typescript
// repository
export const reorderImages = async (
  productId: number,
  items: { id: number; position: number }[]
): Promise<void> => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    // Verificar ownership
    const ids = items.map(i => i.id)
    const check = await client.query(
      `SELECT id FROM product_images WHERE product_id = $1 AND id = ANY($2::int[])`,
      [productId, ids]
    )
    if (check.rows.length !== ids.length) throw new AppError(400, 'IDs inválidos', ...)
    // Actualizar posiciones
    for (const item of items) {
      await client.query(
        'UPDATE product_images SET position = $1 WHERE id = $2',
        [item.position, item.id]
      )
    }
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}
```

### Validación del body en el controller
```typescript
const items = req.body
if (!Array.isArray(items) || items.length === 0) {
  res.status(400).json({ detail: 'El body debe ser un array no vacío de { id, position }' })
  return
}
```

### Invalidar caché
```typescript
await cacheDel(PRODUCT_KEY(productId))
await cacheDel(CATALOG_KEY)
```

### Ruta
```typescript
router.patch('/:id/images/reorder', authMiddleware, requireRole([ROLES.ADMIN]), reorderImagesHandler)
```

### Referencias
- [Source: jedami-bff/src/modules/products/products.controller.ts]
- [Source: jedami-bff/src/modules/products/products.service.ts]
- [Source: jedami-bff/src/modules/products/products.repository.ts]
- [Source: jedami-bff/src/routes/products.routes.ts]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
