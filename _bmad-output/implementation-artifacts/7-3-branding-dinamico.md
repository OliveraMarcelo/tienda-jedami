# Story 7.3: Branding Dinámico — BFF

Status: review

## Story

Como operador del negocio,
quiero configurar el nombre y colores de la tienda sin redesplegar la app,
para operar bajo la marca del cliente.

## Acceptance Criteria

1. **Given** cualquier cliente hace `GET /api/v1/config/branding`
   **When** el endpoint responde
   **Then** retorna `{ storeName, primaryColor, secondaryColor, logoUrl }`
   **And** el endpoint es público (sin autenticación)

2. **Given** el admin actualiza el branding en la tabla `branding`
   **When** el frontend vuelve a consultar `GET /config/branding`
   **Then** obtiene los valores actualizados sin reiniciar el BFF

3. **Given** la tabla `branding` tiene la fila seed inicial
   **When** se llama al endpoint
   **Then** retorna los valores por defecto: `{ storeName: "Jedami", primaryColor: "#E91E8C", secondaryColor: "#1E1E2E", logoUrl: null }`

## Tasks / Subtasks

- [x] Migración `020_branding.sql`: tabla `branding` con seed inicial (AC: 2, 3)
- [x] Query `modules/config/queries/find-branding.ts` (AC: 1)
- [x] Crear handler `getBranding` en `modules/config/config.controller.ts` (AC: 1, 3)
  - [x] Leer fila id=1 de tabla `branding`
  - [x] Retornar `{ data: { storeName, primaryColor, secondaryColor, logoUrl } }`
- [x] Registrar `GET /branding` en `routes/config.routes.ts` (AC: 1)

## Dev Notes

### Patrón env.ts existente
Ver `jedami-bff/src/config/env.ts` — exporta objeto con los valores de `process.env` ya parseados con defaults.
```typescript
// Agregar al objeto exportado:
storeName:       process.env.STORE_NAME       ?? 'Jedami',
primaryColor:    process.env.PRIMARY_COLOR    ?? '#E91E8C',
secondaryColor:  process.env.SECONDARY_COLOR  ?? '#1E1E2E',
logoUrl:         process.env.LOGO_URL         ?? null,
```

### config.routes.ts actual
```typescript
router.get('/', getConfig)
// Agregar:
router.get('/branding', getBranding)
```

### No requiere nueva migración
Los valores de branding viven en ENV, no en DB. Si en el futuro se quiere en DB, se crea una migration con tabla `branding_config`. Por ahora ENV es suficiente.

### Caché Redis opcional
No es necesario cachear branding ya que solo se llama al inicio de la app. Si se agrega, usar TTL de 300s y key `config:branding`.

### Response shape
```json
{
  "data": {
    "storeName": "Jedami",
    "primaryColor": "#E91E8C",
    "secondaryColor": "#1E1E2E",
    "logoUrl": null
  }
}
```

### Project Structure Notes
- Módulo de config: `jedami-bff/src/modules/config/`
- `config.controller.ts` ya tiene `getConfig` — agregar `getBranding` en el mismo archivo
- Rutas: `jedami-bff/src/routes/config.routes.ts`

### Referencias
- [Source: jedami-bff/src/config/env.ts] — patrón de variables de entorno
- [Source: jedami-bff/src/modules/config/config.controller.ts] — donde agregar getBranding
- [Source: jedami-bff/src/routes/config.routes.ts] — donde registrar la ruta
- [Source: jedami-bff/.env.example] — actualizar con las nuevas variables

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Debug Log References

### Completion Notes List
- Implementación corregida: branding en tabla DB (no ENV) para ser verdaderamente dinámico sin reiniciar el BFF
- Tabla `branding` con una sola fila (id=1), editada con UPDATE desde el panel admin (Story W7.5)
- `tsc --noEmit` sin errores

### File List
- jedami-bff/src/database/migrations/020_branding.sql
- jedami-bff/src/database/migrations/021_seed_branding.sql
- jedami-bff/src/modules/config/queries/find-branding.ts
- jedami-bff/src/modules/config/config.controller.ts
- jedami-bff/src/routes/config.routes.ts
