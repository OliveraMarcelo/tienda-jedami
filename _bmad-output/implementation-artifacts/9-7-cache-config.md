# Story 9.7: Cache de GET /config — BFF

Status: done

## Story

Como sistema,
quiero cachear la respuesta de `GET /config` en Redis,
para que el arranque simultáneo de múltiples instancias del frontend no genere N queries idénticas a la base de datos.

## Acceptance Criteria

1. **Given** se llama `GET /config` por primera vez tras el arranque del BFF
   **When** el endpoint responde
   **Then** la respuesta se almacena en Redis con TTL de 300 segundos bajo la key `config:all`

2. **Given** Redis tiene la key `config:all` vigente
   **When** se llama `GET /config` nuevamente
   **Then** la respuesta se sirve desde Redis sin consultar la DB

3. **Given** el admin agrega, modifica o desactiva un `purchase_type` o `customer_type`
   **When** la operación se completa en `config.controller.ts`
   **Then** la key `config:all` es eliminada de Redis (cache invalidado)

4. **Given** Redis no está disponible
   **When** se llama `GET /config`
   **Then** el endpoint sigue funcionando consultando la DB directamente (degradación silenciosa)

## Tasks / Subtasks

- [ ] Actualizar `getConfig` en `config.controller.ts`: agregar `cacheGet` antes de la query y `cacheSet` después (AC: 1, 2, 4)
- [ ] Agregar `cacheDel('config:all')` al final de: `createPurchaseType`, `updatePurchaseType`, `createCustomerType`, `updateCustomerType` (AC: 3)
- [ ] Definir la constante `CONFIG_CACHE_KEY = 'config:all'` en `config.controller.ts` (AC: 1, 2, 3)
- [ ] TTL de 300 segundos (usar `ENV.CACHE_TTL` si es configurable, o hardcodear 300) (AC: 1)

## Dev Notes

### Patrón de caché (idéntico al catálogo)
```typescript
// config.controller.ts
const CONFIG_CACHE_KEY = 'config:all'

export async function getConfig(_req: Request, res: Response, next: NextFunction) {
  try {
    const cached = await cacheGet(CONFIG_CACHE_KEY)
    if (cached) { res.status(200).json(JSON.parse(cached)); return }

    const result = await pool.query(FIND_CONFIG)
    const row = result.rows[0]
    const body = {
      data: {
        roles: row.roles ?? [],
        priceModes: row.price_modes ?? [],
        purchaseTypes: row.purchase_types ?? [],
        customerTypes: row.customer_types ?? [],
      },
    }
    await cacheSet(CONFIG_CACHE_KEY, JSON.stringify(body), 300)
    res.status(200).json(body)
  } catch (err) { next(err) }
}
```

### Invalidación en mutaciones
```typescript
// Al final de createPurchaseType, updatePurchaseType, createCustomerType, updateCustomerType:
await cacheDel(CONFIG_CACHE_KEY)
```

### Degradación silenciosa (cacheGet ya la maneja)
La función `cacheGet` de `../../config/redis.js` retorna `null` si Redis no está disponible. El flujo caerá directo a la query DB.

### Import
```typescript
import { cacheGet, cacheSet, cacheDel } from '../../config/redis.js'
```

### Referencias
- [Source: jedami-bff/src/modules/config/config.controller.ts]
- [Source: jedami-bff/src/config/redis.ts] — patrón cacheGet/cacheSet/cacheDel
- [Source: jedami-bff/src/modules/products/products.controller.ts] — ver patrón de caché en listProducts

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
