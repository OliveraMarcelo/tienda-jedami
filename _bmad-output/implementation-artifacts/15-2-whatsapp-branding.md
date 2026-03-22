# Story 15.2: WhatsApp en Branding — BFF

Status: review

## Story

Como administrador,
quiero configurar el número de WhatsApp del negocio en el panel
para que los compradores puedan avisar por WhatsApp cuando realizaron una transferencia.

## Acceptance Criteria

1. **Given** la migración se ejecuta
   **Then** la tabla `branding` tiene la columna `whatsapp_number VARCHAR(20)`

2. **Given** se llama `PUT /config/branding` con `{ whatsappNumber: "5491112345678" }`
   **Then** el campo se guarda en la DB y se retorna en la respuesta

3. **Given** se llama `GET /config/branding`
   **Then** la respuesta incluye `whatsappNumber` (string o null)

## Tasks / Subtasks

- [x] **Migration `036_whatsapp_branding.sql`** — agregar columna `whatsapp_number VARCHAR(20)` a `branding`

- [x] **`find-branding.ts`** — agregar `whatsapp_number` al SELECT

- [x] **`config.controller.ts`** — `mapBranding`: agregar `whatsappNumber: row.whatsapp_number ?? null`; `updateBranding`: aceptar campo `whatsappNumber` → `whatsapp_number`

## Dev Notes

### Migration

```sql
ALTER TABLE branding
  ADD COLUMN IF NOT EXISTS whatsapp_number VARCHAR(20);
```

### find-branding.ts

Agregar `whatsapp_number` al SELECT existente.

### config.controller.ts — mapBranding

```typescript
whatsappNumber: row.whatsapp_number ?? null,
```

### config.controller.ts — updateBranding

```typescript
if (whatsappNumber !== undefined) { fields.push(`whatsapp_number = $${idx++}`); values.push(whatsappNumber ?? null); }
```

El RETURNING del UPDATE dinámico también debe incluir `whatsapp_number`.

### Depende de
- Story 15-1 (BFF) — done

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Completion Notes
Columna `whatsapp_number VARCHAR(20)` agregada a `branding`. Expuesta en GET `/config/branding` y aceptada en PUT `/config/branding`. `mapBranding` retorna `whatsappNumber`. TypeScript compila sin errores.

### File List
- jedami-bff/src/database/migrations/036_whatsapp_branding.sql (nuevo)
- jedami-bff/src/modules/config/queries/find-branding.ts
- jedami-bff/src/modules/config/config.controller.ts
