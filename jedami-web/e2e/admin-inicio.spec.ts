import { test, expect } from '@playwright/test'

const BFF_URL = process.env.E2E_BFF_URL ?? 'http://localhost:3000/api/v1'

const ADMIN = {
  email:    process.env.E2E_ADMIN_EMAIL    ?? 'admin@jedami.com',
  password: process.env.E2E_ADMIN_PASSWORD ?? 'admin123',
}

const NON_ADMIN = {
  email:    'e2e-inicio-retail@jedami.com',
  password: 'Test1234!',
}

// ─── Setup ────────────────────────────────────────────────────────────────────

test.beforeAll(async () => {
  await fetch(`${BFF_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: NON_ADMIN.email, password: NON_ADMIN.password, customerType: 'retail' }),
  })
})

// ─── Suite ────────────────────────────────────────────────────────────────────

test.describe('Admin – Inicio (/admin)', () => {

  test.beforeEach(async ({ page }) => {
    // La sesión admin llega ya autenticada vía storageState (playwright/.auth/admin.json)
    await page.goto('/admin')
    await expect(page.getByRole('heading', { name: 'Panel de administración' })).toBeVisible()
  })

  // ── ADM-001 ──────────────────────────────────────────────────────────────────
  test('ADM-001 | Panel admin carga con accesos rápidos', async ({ page }) => {
    // Verificar todas las cards de acceso rápido por su href (evita ambigüedad con emojis)
    const expectedHrefs = [
      '/admin/dashboard',
      '/admin/pagos',
      '/admin/productos',
      '/admin/usuarios',
      '/admin/configuracion',
      '/admin/despacho',
      '/admin/banners',
      '/admin/anuncios',
      '/admin/point',
    ]
    for (const href of expectedHrefs) {
      await expect(page.locator(`a[href="${href}"]`)).toBeVisible()
    }
  })

  // ── ADM-002 ──────────────────────────────────────────────────────────────────
  test('ADM-002 | Card "Cobros Point" visible y navega a /admin/point', async ({ page }) => {
    const pointCard = page.locator('a[href="/admin/point"]')
    await expect(pointCard).toBeVisible()
    await expect(pointCard).toContainText('Cobros Point')

    await pointCard.click()
    await expect(page).toHaveURL('/admin/point', { timeout: 8_000 })
  })

  // ── ADM-003 ──────────────────────────────────────────────────────────────────
  test('ADM-003 | Todas las cards navegan a su vista correcta', async ({ page }) => {
    const routes: [string, string][] = [
      ['/admin/dashboard',    '/admin/dashboard'],
      ['/admin/pagos',        '/admin/pagos'],
      ['/admin/productos',    '/admin/productos'],
      ['/admin/usuarios',     '/admin/usuarios'],
      ['/admin/configuracion','/admin/configuracion'],
      ['/admin/despacho',     '/admin/despacho'],
      ['/admin/banners',      '/admin/banners'],
      ['/admin/anuncios',     '/admin/anuncios'],
      ['/admin/point',        '/admin/point'],
    ]

    for (const [href, url] of routes) {
      await page.goto('/admin')
      await page.locator(`a[href="${href}"]`).click()
      await expect(page).toHaveURL(url, { timeout: 8_000 })
    }
  })

  // ── ADM-004 ──────────────────────────────────────────────────────────────────
  test('ADM-004 | Usuario sin rol admin es redirigido fuera del panel', async ({ page }) => {
    // Cerrar sesión admin
    await page.getByRole('button', { name: 'Salir' }).click()
    await expect(page).toHaveURL('/login', { timeout: 5_000 })

    // Login como usuario retail
    await page.getByPlaceholder('tu@email.com').fill(NON_ADMIN.email)
    await page.getByPlaceholder('••••••••').fill(NON_ADMIN.password)
    await page.getByRole('button', { name: 'Ingresar' }).click()
    await expect(page).not.toHaveURL('/admin', { timeout: 10_000 })

    // Intentar navegar directo al panel
    await page.goto('/admin')
    await expect(page).not.toHaveURL('/admin', { timeout: 5_000 })
  })

  // ── ADM-005 ──────────────────────────────────────────────────────────────────
  test('ADM-005 | Header muestra el email del admin autenticado', async ({ page }) => {
    await expect(page.getByText(ADMIN.email)).toBeVisible()
  })

})
