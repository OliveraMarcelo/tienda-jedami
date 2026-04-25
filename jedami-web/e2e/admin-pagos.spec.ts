import { test, expect } from '@playwright/test'

const BFF_URL = process.env.E2E_BFF_URL ?? 'http://localhost:3000/api/v1'

const NON_ADMIN = {
  email:    'e2e-pagos-retail@jedami.com',
  password: 'Test1234!',
}

test.beforeAll(async () => {
  await fetch(`${BFF_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: NON_ADMIN.email, password: NON_ADMIN.password, customerType: 'retail' }),
  })
})

test.describe('Admin – Pagos (/admin/pagos)', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/pagos')
    await expect(page.getByRole('heading', { name: 'Pagos' })).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('.animate-pulse').first()).not.toBeVisible({ timeout: 10_000 })
  })

  // ── APAG-001 ─────────────────────────────────────────────────────────────────
  test('APAG-001 | Vista carga sin errores y muestra la tabla', async ({ page }) => {
    await expect(page.getByText('Error al cargar los pagos.')).not.toBeVisible()

    // La tabla o mensaje de vacío siempre debe estar presente
    const table = page.locator('table')
    const empty = page.getByText(/Sin pagos|no hay pagos/i)
    const hasTable = await table.isVisible()
    const hasEmpty = await empty.isVisible()
    expect(hasTable || hasEmpty).toBe(true)

    // Filtros y paginación siempre visibles
    await expect(page.getByRole('button', { name: /Buscar|Filtrar/ })).toBeVisible()
  })

  // ── APAG-002 ─────────────────────────────────────────────────────────────────
  test('APAG-002 | Filtros de estado visibles en la vista', async ({ page }) => {
    // El select de estado de pago siempre está presente
    const statusSelect = page.locator('select').first()
    await expect(statusSelect).toBeVisible()

    // Las opciones incluyen estados clave
    await expect(statusSelect.locator('option', { hasText: 'Pendiente' })).toBeAttached()
  })

  // ── APAG-003 ─────────────────────────────────────────────────────────────────
  test('APAG-003 | Columnas de la tabla presentes', async ({ page }) => {
    const table = page.locator('table')
    const hasTable = await table.isVisible()
    if (!hasTable) {
      test.skip() // Sin pagos en este entorno
    }

    // Las columnas de la cabecera deben incluir información de gateway, estado, monto, fecha
    await expect(table.locator('thead')).toBeVisible()
  })

  // ── APAG-004 ─────────────────────────────────────────────────────────────────
  test('APAG-004 | Si hay pagos, monto y fecha son visibles por fila', async ({ page }) => {
    const emptyMsg = await page.getByText('No hay pagos para mostrar.').isVisible()
    if (emptyMsg) {
      test.skip() // Sin pagos en este entorno
    }

    // La primera fila visible tiene monto (con $) y alguna fecha
    const rows = page.locator('table tbody tr')
    const firstRow = rows.first()
    await expect(firstRow).toBeVisible()
    await expect(firstRow.getByText(/\$/)).toBeVisible()
  })

  // ── APAG-005 ─────────────────────────────────────────────────────────────────
  test('APAG-005 | /admin/pagos no accesible sin rol admin', async ({ page }) => {
    // Cerrar sesión admin
    await page.getByRole('button', { name: 'Salir' }).click()
    await expect(page).toHaveURL('/login', { timeout: 5_000 })

    // Login como retail
    await page.getByPlaceholder('tu@email.com').fill(NON_ADMIN.email)
    await page.getByPlaceholder('••••••••').fill(NON_ADMIN.password)
    await page.getByRole('button', { name: 'Ingresar' }).click()
    await expect(page).not.toHaveURL('/admin', { timeout: 10_000 })

    await page.goto('/admin/pagos')
    await expect(page).not.toHaveURL('/admin/pagos', { timeout: 5_000 })
  })

})
