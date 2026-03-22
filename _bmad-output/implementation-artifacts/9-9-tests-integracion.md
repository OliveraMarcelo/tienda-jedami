# Story 9.9: Tests de Integración Básicos — BFF

Status: done

## Story

Como desarrollador,
quiero un set mínimo de tests de integración para los flujos críticos del BFF,
para detectar regresiones antes de que lleguen a producción.

## Acceptance Criteria

1. **Given** se corre `npm test` en `jedami-bff`
   **When** los tests se ejecutan
   **Then** todos pasan en verde y el proceso termina con exit code 0

2. **Given** los tests de autenticación
   **When** se ejecutan
   **Then** cubren: registro exitoso, registro con email duplicado (409), login correcto, login con password incorrecto (401)

3. **Given** los tests de catálogo
   **When** se ejecutan
   **Then** cubren: listar productos (200 + estructura), obtener producto por id, obtener producto inexistente (404)

4. **Given** los tests de autorización
   **When** se ejecutan
   **Then** cubren: acceso a ruta admin sin token (401), acceso con token sin rol admin (403), acceso con token admin (200)

5. **Given** los tests de webhook de MP
   **When** se ejecutan
   **Then** cubren: webhook válido con firma correcta, webhook con firma inválida (401), webhook duplicado (200 sin doble procesamiento)

## Tasks / Subtasks

- [ ] Instalar dependencias: `vitest`, `supertest`, `@types/supertest` (AC: 1)
- [ ] Configurar `vitest.config.ts` en `jedami-bff/` (AC: 1)
- [ ] Agregar script `"test": "vitest run"` en `package.json` (AC: 1)
- [ ] Crear `src/__tests__/helpers/app.ts`: factory que levanta la app Express sin escuchar en puerto (AC: 1)
- [ ] Crear `src/__tests__/helpers/db.ts`: helpers para limpiar/seedear tablas de test (AC: 1)
- [ ] Crear `src/__tests__/auth.test.ts`: tests de registro y login (AC: 2)
- [ ] Crear `src/__tests__/catalog.test.ts`: tests de catálogo público (AC: 3)
- [ ] Crear `src/__tests__/auth-guards.test.ts`: tests de middleware auth y roles (AC: 4)
- [ ] Crear `src/__tests__/webhook.test.ts`: tests del webhook de MP (AC: 5)
- [ ] Configurar DB de test separada via variable `TEST_DATABASE_URL` (AC: 1)

## Dev Notes

### Setup de Vitest + Supertest
```bash
npm install -D vitest supertest @types/supertest
```

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: 10000,
    setupFiles: ['./src/__tests__/helpers/setup.ts'],
  },
})
```

### Factory de la app (sin .listen)
```typescript
// src/__tests__/helpers/app.ts
import { createApp } from '../../app.js'  // exportar la app sin llamar listen
export const testApp = createApp()
```
Asegurarse de que `app.ts` exporte la app sin llamar a `app.listen()` — el listen debe estar solo en `index.ts`.

### Patrón de test de auth
```typescript
// auth.test.ts
import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { testApp } from './helpers/app'

describe('POST /api/v1/auth/register', () => {
  it('registra un usuario nuevo', async () => {
    const res = await request(testApp)
      .post('/api/v1/auth/register')
      .send({ email: 'test@example.com', password: 'password123' })
    expect(res.status).toBe(201)
    expect(res.body.data).toHaveProperty('token')
  })

  it('rechaza email duplicado', async () => {
    // primer registro
    await request(testApp).post('/api/v1/auth/register').send({ email: 'dup@test.com', password: '123456' })
    // segundo registro con el mismo email
    const res = await request(testApp).post('/api/v1/auth/register').send({ email: 'dup@test.com', password: '123456' })
    expect(res.status).toBe(409)
  })
})
```

### DB de test
Usar una base de datos separada `jedami_test` con las mismas migraciones. La variable `TEST_DATABASE_URL` se inyecta en el proceso de test.

```typescript
// helpers/setup.ts
import { pool } from '../../config/database.js'
afterEach(async () => {
  await pool.query('TRUNCATE users, customers, orders, payments RESTART IDENTITY CASCADE')
})
afterAll(async () => pool.end())
```

### Mock de Mercado Pago en tests de webhook
No llamar a la API real de MP. Usar `vi.mock` para mockear el módulo de MP:
```typescript
vi.mock('../../lib/mercadopago.js', () => ({
  verifyWebhookSignature: vi.fn().mockReturnValue(true),
}))
```

### CI
Agregar el step en `.github/workflows/` (si existe):
```yaml
- name: Run tests
  run: npm test
  working-directory: jedami-bff
  env:
    TEST_DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
```

### Referencias
- [Source: jedami-bff/src/app.ts] — separar createApp() de listen()
- [Source: jedami-bff/src/config/database.ts] — pool
- [Source: jedami-bff/package.json] — agregar script test

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
