import { test, expect } from '@playwright/test'

const BFF_URL = process.env.E2E_BFF_URL ?? 'http://localhost:3000/api/v1'

const ADMIN = {
  email:    process.env.E2E_ADMIN_EMAIL    ?? 'admin@jedami.com',
  password: process.env.E2E_ADMIN_PASSWORD ?? 'admin123',
}

const TEST_USER = {
  email:    'e2e-usuarios@jedami.com',
  password: 'Test1234!',
}

// Sube 2 niveles desde el <p> del email para llegar al div-fila que contiene
// tanto los badges como el combobox y el botón "Asignar".
function userRowContainer(page: Parameters<Parameters<typeof test>[1]>[0], email: string) {
  return page.locator('p').filter({ hasText: email }).locator('xpath=../..')
}

// El selector de roles está plegado en "Otros roles"
async function openOtherRoles(row: ReturnType<typeof userRowContainer>) {
  const summary = row.getByText('Otros roles')
  if (await row.locator('details[open]').count() === 0) await summary.click()
}

// ─── Setup ────────────────────────────────────────────────────────────────────

test.beforeAll(async () => {
  await fetch(`${BFF_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TEST_USER.email, password: TEST_USER.password, customerType: 'retail' }),
  })
})

// ─── Suite ────────────────────────────────────────────────────────────────────

test.describe('Admin – Clientes (/admin/usuarios)', () => {

  test.beforeEach(async ({ page }) => {
    // La sesión admin llega ya autenticada vía storageState (playwright/.auth/admin.json)
    await page.goto('/admin/usuarios')
    await expect(page.getByRole('heading', { name: 'Clientes' })).toBeVisible()
  })

  // ── AUST-001 ─────────────────────────────────────────────────────────────────
  test('AUST-001 | Lista de usuarios carga con email, roles y paginación', async ({ page }) => {
    await expect(page.getByRole('paragraph').filter({ hasText: ADMIN.email })).toBeVisible()
    await expect(page.getByText(/cuentas · Página/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Buscar' })).toBeVisible()
  })

  // ── AUST-002 ─────────────────────────────────────────────────────────────────
  test('AUST-002 | Asignar rol wholesale a usuario', async ({ page }) => {
    const row = userRowContainer(page, TEST_USER.email)
    await expect(row).toBeVisible()

    await openOtherRoles(row)
    await row.getByRole('combobox').selectOption({ label: 'Mayorista' })
    await row.getByRole('button', { name: 'Asignar' }).click()

    // Usar locator('span') para no coincidir con el <option> del combobox
    await expect(row.locator('span').filter({ hasText: /^Mayorista/ })).toBeVisible({ timeout: 8_000 })
  })

  // ── AUST-003 ─────────────────────────────────────────────────────────────────
  test('AUST-003 | Asignar rol admin muestra confirmación antes de aplicar', async ({ page }) => {
    const row = userRowContainer(page, TEST_USER.email)

    await openOtherRoles(row)
    await row.getByRole('combobox').selectOption({ label: 'Administrador' })
    await row.getByRole('button', { name: 'Asignar' }).click()

    await expect(page.getByText(/Esto da acceso total al panel/)).toBeVisible({ timeout: 5_000 })
    await expect(page.getByRole('button', { name: 'Confirmar' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Cancelar' })).toBeVisible()

    // Cancelar para no dejar el estado sucio
    await page.getByRole('button', { name: 'Cancelar' }).click()
  })

  // ── AUST-004 ─────────────────────────────────────────────────────────────────
  test('AUST-004 | Remover rol de usuario hace desaparecer el badge', async ({ page }) => {
    const row = userRowContainer(page, TEST_USER.email)

    // Asegurar que el usuario tiene wholesale para poder removerlo
    const wholesaleBadge = row.locator('span').filter({ hasText: /^Mayorista/ })
    if (await wholesaleBadge.count() === 0) {
      await openOtherRoles(row)
      await row.getByRole('combobox').selectOption({ label: 'Mayorista' })
      await row.getByRole('button', { name: 'Asignar' }).click()
      await expect(wholesaleBadge).toBeVisible({ timeout: 8_000 })
    }

    // Remover wholesale: el badge <span> tiene un botón × junto al texto
    await wholesaleBadge.getByRole('button', { name: '×' }).click()
    await expect(wholesaleBadge).not.toBeVisible({ timeout: 8_000 })
  })

  // ── AUST-005 ─────────────────────────────────────────────────────────────────
  test('AUST-005 | No se puede remover tu propio rol admin (self-demotion bloqueado)', async ({ page }) => {
    const adminRow = userRowContainer(page, ADMIN.email)

    // El único × button en la fila del admin pertenece al badge "admin"
    await adminRow.getByRole('button', { name: '×' }).first().click()

    await expect(page.getByText(/propio rol admin/i)).toBeVisible({ timeout: 5_000 })
    // Usar locator('span') para apuntar solo al badge, evitando email/opciones/error msg
    await expect(adminRow.locator('span').filter({ hasText: /^Administrador/ })).toBeVisible()
  })

  // ── AUST-007 ─────────────────────────────────────────────────────────────────
  test('AUST-007 | "Pasar a mayorista" y volver a minorista', async ({ page }) => {
    const row = userRowContainer(page, TEST_USER.email)
    const toWholesale = row.getByRole('button', { name: 'Pasar a mayorista' })
    if (await toWholesale.count() === 0) {
      await row.getByRole('button', { name: 'Pasar a minorista' }).click()
      await expect(toWholesale).toBeVisible({ timeout: 8_000 })
    }

    await toWholesale.click()
    await expect(row.getByText('✓ Ahora es mayorista')).toBeVisible({ timeout: 8_000 })
    await expect(row.locator('span').filter({ hasText: /^Mayorista/ })).toBeVisible()
    await expect(row.locator('span').filter({ hasText: /^Minorista/ })).not.toBeVisible()

    // Dejarlo como estaba
    await row.getByRole('button', { name: 'Pasar a minorista' }).click()
    await expect(row.getByRole('button', { name: 'Pasar a mayorista' })).toBeVisible({ timeout: 8_000 })
  })

  // ── AUST-006 ─────────────────────────────────────────────────────────────────
  test('AUST-006 | Sin sesión activa, /admin/usuarios redirige fuera del panel', async ({ page }) => {
    await page.getByRole('button', { name: 'Salir' }).click()
    await expect(page).toHaveURL('/login', { timeout: 5_000 })

    await page.goto('/admin/usuarios')
    await expect(page).not.toHaveURL('/admin/usuarios', { timeout: 5_000 })
  })

})
