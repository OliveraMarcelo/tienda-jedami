import { test, expect, type Page } from '@playwright/test'

// ─── Credenciales de prueba ───────────────────────────────────────────────────
const BFF_URL = process.env.E2E_BFF_URL ?? 'http://localhost:3000/api/v1'

const ADMIN = {
  email:    process.env.E2E_ADMIN_EMAIL    ?? 'admin@jedami.com',
  password: process.env.E2E_ADMIN_PASSWORD ?? 'admin123',
}
const WHOLESALE = {
  email:    process.env.E2E_WHOLESALE_EMAIL    ?? 'e2e-mayorista@jedami.com',
  password: process.env.E2E_WHOLESALE_PASSWORD ?? 'Test1234!',
}
const RETAIL = {
  email:    process.env.E2E_RETAIL_EMAIL    ?? 'e2e-retail@jedami.com',
  password: process.env.E2E_RETAIL_PASSWORD ?? 'Test1234!',
}

// ─── Setup: crear usuarios de prueba si no existen ────────────────────────────
test.beforeAll(async () => {
  await fetch(`${BFF_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: WHOLESALE.email, password: WHOLESALE.password, customerType: 'wholesale' }),
  })
  await fetch(`${BFF_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: RETAIL.email, password: RETAIL.password, customerType: 'retail' }),
  })
  // Ignoramos el resultado — si ya existen (400) está bien
})

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function fillLoginForm(page: Page, email: string, password: string) {
  await page.getByPlaceholder('tu@email.com').fill(email)
  await page.getByPlaceholder('••••••••').fill(password)
}

async function clickSubmit(page: Page) {
  await page.getByRole('button', { name: 'Ingresar' }).click()
}

// ─── Suite ────────────────────────────────────────────────────────────────────
test.describe('Login — /login', () => {

  // Sin storageState: los tests de login necesitan usuario NO autenticado
  test.use({ storageState: { cookies: [], origins: [] } })

  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: 'Ingresar' })).toBeVisible()
  })

  // ── L-001 ───────────────────────────────────────────────────────────────────
  test('L-001 | Login exitoso como Admin → redirige a /admin', async ({ page }) => {
    await fillLoginForm(page, ADMIN.email, ADMIN.password)
    await clickSubmit(page)

    await expect(page).toHaveURL('/admin', { timeout: 10_000 })
  })

  // ── L-002 ───────────────────────────────────────────────────────────────────
  test('L-002 | Login exitoso como Mayorista → redirige a /catalogo', async ({ page }) => {
    await fillLoginForm(page, WHOLESALE.email, WHOLESALE.password)
    await clickSubmit(page)

    await expect(page).toHaveURL('/catalogo', { timeout: 10_000 })
  })

  // ── L-003 ───────────────────────────────────────────────────────────────────
  test('L-003 | Login exitoso como Minorista (Retail) → redirige a /catalogo', async ({ page }) => {
    await fillLoginForm(page, RETAIL.email, RETAIL.password)
    await clickSubmit(page)

    await expect(page).toHaveURL('/catalogo', { timeout: 10_000 })
  })

  // ── L-004 ───────────────────────────────────────────────────────────────────
  test('L-004 | Email inexistente → error de servidor visible', async ({ page }) => {
    await fillLoginForm(page, 'noexiste@example.com', 'cualquiera123')
    await clickSubmit(page)

    await expect(page).toHaveURL('/login')
    await expect(page.locator('p.text-red-500').last()).toBeVisible({ timeout: 8_000 })
    await expect(page.locator('p.text-red-500').last()).not.toBeEmpty()
  })

  // ── L-005 ───────────────────────────────────────────────────────────────────
  test('L-005 | Password incorrecto → error de servidor visible', async ({ page }) => {
    await fillLoginForm(page, ADMIN.email, 'password_malo')
    await clickSubmit(page)

    await expect(page).toHaveURL('/login')
    await expect(page.locator('p.text-red-500').last()).toBeVisible({ timeout: 8_000 })
  })

  // ── L-006 ───────────────────────────────────────────────────────────────────
  test('L-006 | Ambos campos vacíos → botón deshabilitado', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Ingresar' })).toBeDisabled()
  })

  // ── L-007 ───────────────────────────────────────────────────────────────────
  test('L-007 | Blur en email vacío → mensaje "El email es requerido"', async ({ page }) => {
    await page.getByPlaceholder('tu@email.com').click()
    await page.getByPlaceholder('••••••••').click()

    await expect(page.getByText('El email es requerido')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Ingresar' })).toBeDisabled()
  })

  // ── L-008 ───────────────────────────────────────────────────────────────────
  test('L-008 | Blur en contraseña vacía → mensaje "La contraseña es requerida"', async ({ page }) => {
    await page.getByPlaceholder('tu@email.com').fill('alguien@email.com')
    await page.getByPlaceholder('••••••••').click()
    await page.keyboard.press('Tab')

    await expect(page.getByText('La contraseña es requerida')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Ingresar' })).toBeDisabled()
  })

  // ── L-009 ───────────────────────────────────────────────────────────────────
  test('L-009 | Email con formato inválido → mensaje "El email no es válido"', async ({ page }) => {
    await page.getByPlaceholder('tu@email.com').fill('noesunmail')
    await page.getByPlaceholder('••••••••').fill('algo123')
    await page.getByPlaceholder('tu@email.com').click()
    await page.keyboard.press('Tab')

    await expect(page.getByText('El email no es válido')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Ingresar' })).toBeDisabled()
  })

  // ── L-010 ───────────────────────────────────────────────────────────────────
  test('L-010 | Link "Registrate" navega a /registro', async ({ page }) => {
    await page.getByRole('link', { name: 'Registrate' }).click()
    await expect(page).toHaveURL('/registro')
  })

  // ── L-012 ───────────────────────────────────────────────────────────────────
  test('L-012 | Usuario ya logueado que navega a /login es redirigido', async ({ page }) => {
    await fillLoginForm(page, ADMIN.email, ADMIN.password)
    await clickSubmit(page)
    await expect(page).toHaveURL('/admin', { timeout: 10_000 })

    await page.goto('/login')

    await expect(page).not.toHaveURL('/login', { timeout: 5_000 })
  })

  // ── L-013 ───────────────────────────────────────────────────────────────────
  test('L-013 | Toggle de visibilidad de contraseña', async ({ page }) => {
    const passwordInput = page.getByPlaceholder('••••••••')
    await passwordInput.fill('mipassword')

    await expect(passwordInput).toHaveAttribute('type', 'password')

    await page.getByRole('button', { name: /mostrar contraseña/i }).click()
    await expect(passwordInput).toHaveAttribute('type', 'text')

    await page.getByRole('button', { name: /ocultar contraseña/i }).click()
    await expect(passwordInput).toHaveAttribute('type', 'password')
  })

  // ── L-014 ───────────────────────────────────────────────────────────────────
  test('L-014 | Spinner "Ingresando…" visible mientras el request está en vuelo', async ({ page }) => {
    await page.route('**/api/v1/auth/login', async route => {
      await new Promise(r => setTimeout(r, 1500))
      await route.continue()
    })

    await fillLoginForm(page, ADMIN.email, ADMIN.password)
    await page.getByRole('button', { name: 'Ingresar' }).click()

    await expect(page.getByRole('button', { name: 'Ingresando…' })).toBeVisible()
  })

  // ── L-015 ───────────────────────────────────────────────────────────────────
  test('L-015 | Error de red → mensaje de error genérico visible (no crashea)', async ({ page }) => {
    await page.route('**/api/v1/auth/login', route => route.abort('failed'))

    await fillLoginForm(page, ADMIN.email, ADMIN.password)
    await clickSubmit(page)

    await expect(page).toHaveURL('/login')
    await expect(page.locator('p.text-red-500').last()).toBeVisible({ timeout: 8_000 })
    await expect(page.locator('p.text-red-500').last()).toContainText(/error|intente/i)
  })

})
