import { test, expect } from '@playwright/test'

const BFF_URL = process.env.E2E_BFF_URL ?? 'http://localhost:3000/api/v1'

const NON_ADMIN = {
  email:    'e2e-dashboard-retail@jedami.com',
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

test.describe('Admin – Dashboard (/admin/dashboard)', () => {

  test.beforeEach(async ({ page }) => {
    // La sesión admin llega ya autenticada vía storageState (playwright/.auth/admin.json)
    await page.goto('/admin/dashboard')
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 10_000 })
  })

  // ── DASH-001 ──────────────────────────────────────────────────────────────────
  test('DASH-001 | Dashboard carga con métricas de ventas', async ({ page }) => {
    // Esperar que desaparezca el skeleton
    await expect(page.locator('.animate-pulse').first()).not.toBeVisible({ timeout: 10_000 })

    // Las 3 métricas principales deben estar visibles
    await expect(page.getByText('Total Pedidos')).toBeVisible()
    await expect(page.getByText('Revenue Total')).toBeVisible()
    await expect(page.getByText('Últimos 30 días')).toBeVisible()

    // No debe mostrar mensaje de error
    await expect(page.getByText('Error al cargar el dashboard.')).not.toBeVisible()
  })

  // ── DASH-002 ──────────────────────────────────────────────────────────────────
  test('DASH-002 | Monto de Revenue Total visible en formato ARS', async ({ page }) => {
    await expect(page.locator('.animate-pulse').first()).not.toBeVisible({ timeout: 10_000 })

    // La card "Revenue Total" tiene un <p class="text-3xl"> con formato ARS ($)
    const revenueCard = page.locator('div.bg-white').filter({ hasText: /^Revenue Total/ })
    await expect(revenueCard.locator('p.text-3xl')).toContainText('$')
  })

  // ── DASH-003 ──────────────────────────────────────────────────────────────────
  test('DASH-003 | Dashboard no accesible sin rol admin', async ({ page }) => {
    // Cerrar sesión admin
    await page.getByRole('button', { name: 'Salir' }).click()
    await expect(page).toHaveURL('/login', { timeout: 5_000 })

    // Login como usuario retail (no admin)
    await page.getByPlaceholder('tu@email.com').fill(NON_ADMIN.email)
    await page.getByPlaceholder('••••••••').fill(NON_ADMIN.password)
    await page.getByRole('button', { name: 'Ingresar' }).click()
    await expect(page).not.toHaveURL('/admin', { timeout: 10_000 })

    // Intentar navegar directo al dashboard
    await page.goto('/admin/dashboard')
    await expect(page).not.toHaveURL('/admin/dashboard', { timeout: 5_000 })
  })

  // ── DASH-004 ──────────────────────────────────────────────────────────────────
  test('DASH-004 | Dashboard carga sin errores de consola críticos', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })

    await page.goto('/admin/dashboard')
    await expect(page.getByText('Total Pedidos')).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('.animate-pulse').first()).not.toBeVisible({ timeout: 10_000 })

    expect(consoleErrors).toHaveLength(0)
    await expect(page.getByText('Error al cargar el dashboard.')).not.toBeVisible()
  })

})
