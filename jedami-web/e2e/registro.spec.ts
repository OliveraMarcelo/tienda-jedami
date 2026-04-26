import { test, expect, type Page } from '@playwright/test'

// ─── Config ───────────────────────────────────────────────────────────────────
const BFF_URL = process.env.E2E_BFF_URL ?? 'http://localhost:3000/api/v1'

// Email único por ejecución para evitar conflictos
const TS = Date.now()
const NEW_USER = {
  email:    `e2e-reg-${TS}@jedami.com`,
  password: 'Test1234!',
}
const EXISTING_USER = {
  email:    'admin@jedami.com',
  password: 'admin123',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function goToRegister(page: Page) {
  await page.goto('/registro')
  await expect(page.getByRole('heading', { name: 'Crear cuenta' })).toBeVisible()
}

async function fillForm(
  page: Page,
  email: string,
  password: string,
  confirm: string,
) {
  await page.getByPlaceholder('tu@email.com').fill(email)
  await page.getByPlaceholder('Mínimo 8 caracteres').fill(password)
  await page.getByPlaceholder('Repetí tu contraseña').fill(confirm)
}

async function clickCrearCuenta(page: Page) {
  await page.getByRole('button', { name: 'Crear cuenta' }).click()
}

// ─── Suite ────────────────────────────────────────────────────────────────────
test.describe('Registro — /registro', () => {

  // Sin storageState: los tests de registro necesitan usuario NO autenticado
  test.use({ storageState: { cookies: [], origins: [] } })

  test.beforeEach(async ({ page }) => {
    await goToRegister(page)
  })

  // ── REG-001 ──────────────────────────────────────────────────────────────────
  test('REG-001 | Registro exitoso como Mayorista → redirige a /catalogo', async ({ page }) => {
    // Seleccionar tipo Mayorista
    await page.locator('form button', { hasText: /mayorista/i }).click()

    await fillForm(page, NEW_USER.email, NEW_USER.password, NEW_USER.password)
    await clickCrearCuenta(page)

    await expect(page).toHaveURL('/catalogo', { timeout: 10_000 })
  })

  // ── REG-002 ──────────────────────────────────────────────────────────────────
  test('REG-002 | Registro exitoso como Minorista → redirige a /catalogo', async ({ page }) => {
    const emailMinorista = `e2e-min-${TS}@jedami.com`

    // Usar locator dentro del formulario para evitar colisión con el botón del navbar
    await page.locator('form button', { hasText: /minorista/i }).click()

    await fillForm(page, emailMinorista, NEW_USER.password, NEW_USER.password)
    await clickCrearCuenta(page)

    await expect(page).toHaveURL('/catalogo', { timeout: 10_000 })
  })

  // ── REG-003 ──────────────────────────────────────────────────────────────────
  test('REG-003 | Email ya registrado → error de servidor visible', async ({ page }) => {
    await fillForm(page, EXISTING_USER.email, NEW_USER.password, NEW_USER.password)
    await clickCrearCuenta(page)

    await expect(page).toHaveURL('/registro')
    await expect(page.locator('p.text-red-500').last()).toBeVisible({ timeout: 8_000 })
    await expect(page.locator('p.text-red-500').last()).not.toBeEmpty()
  })

  // ── REG-004 ──────────────────────────────────────────────────────────────────
  test('REG-004 | Campos vacíos → botón deshabilitado', async ({ page }) => {
    // Sin llenar nada, el botón debe estar deshabilitado
    await expect(page.getByRole('button', { name: 'Crear cuenta' })).toBeDisabled()
  })

  // ── REG-005 ──────────────────────────────────────────────────────────────────
  test('REG-005 | Password menor a 8 caracteres → "al menos 8 caracteres"', async ({ page }) => {
    await page.getByPlaceholder('tu@email.com').fill('test@example.com')
    await page.getByPlaceholder('Mínimo 8 caracteres').fill('corto')
    await page.getByPlaceholder('Mínimo 8 caracteres').blur()

    await expect(page.getByText('La contraseña debe tener al menos 8 caracteres')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Crear cuenta' })).toBeDisabled()
  })

  // ── REG-006 ──────────────────────────────────────────────────────────────────
  test('REG-006 | Email con formato inválido → "El email no es válido"', async ({ page }) => {
    await page.getByPlaceholder('tu@email.com').fill('noesunmail')
    await page.getByPlaceholder('tu@email.com').blur()

    await expect(page.getByText('El email no es válido')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Crear cuenta' })).toBeDisabled()
  })

  // ── REG-007 ──────────────────────────────────────────────────────────────────
  test('REG-007 | Contraseñas que no coinciden → "Las contraseñas no coinciden"', async ({ page }) => {
    await fillForm(page, 'test@example.com', 'Password1!', 'Password2!')
    await page.getByPlaceholder('Repetí tu contraseña').blur()

    await expect(page.getByText('Las contraseñas no coinciden')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Crear cuenta' })).toBeDisabled()
  })

  // ── REG-008 ──────────────────────────────────────────────────────────────────
  test('REG-008 | Link "Ingresá" navega a /login', async ({ page }) => {
    await page.getByRole('link', { name: 'Ingresá' }).click()
    await expect(page).toHaveURL('/login')
  })

  // ── REG-009 ──────────────────────────────────────────────────────────────────
  test('REG-009 | Selector de tipo de cliente visible y funcional', async ({ page }) => {
    // Deben existir al menos los botones Minorista y Mayorista dentro del formulario
    await expect(page.locator('form button', { hasText: /minorista/i })).toBeVisible()
    await expect(page.locator('form button', { hasText: /mayorista/i })).toBeVisible()

    // Al hacer click en Mayorista, cambia la selección
    await page.locator('form button', { hasText: /mayorista/i }).click()
    // Verificar que el click no causó un submit
    await expect(page).toHaveURL('/registro')
  })

  // ── REG-010 ──────────────────────────────────────────────────────────────────
  test('REG-010 | Blur en email vacío → "El email es requerido"', async ({ page }) => {
    await page.getByPlaceholder('tu@email.com').click()
    await page.getByPlaceholder('Mínimo 8 caracteres').click() // blur del email

    await expect(page.getByText('El email es requerido')).toBeVisible()
  })

  // ── REG-011 ──────────────────────────────────────────────────────────────────
  test('REG-011 | Blur en confirmación vacía → "Confirmá tu contraseña"', async ({ page }) => {
    await fillForm(page, 'test@example.com', 'Password1!', '')
    await page.getByPlaceholder('Repetí tu contraseña').click()
    await page.keyboard.press('Tab')

    await expect(page.getByText('Confirmá tu contraseña')).toBeVisible()
  })

  // ── REG-012 ──────────────────────────────────────────────────────────────────
  test('REG-012 | Spinner "Creando cuenta…" visible durante el request', async ({ page }) => {
    await page.route('**/api/v1/auth/register', async route => {
      await new Promise(r => setTimeout(r, 1500))
      await route.continue()
    })

    await fillForm(page, `e2e-spinner-${TS}@jedami.com`, NEW_USER.password, NEW_USER.password)
    await clickCrearCuenta(page)

    await expect(page.getByRole('button', { name: 'Creando cuenta…' })).toBeVisible()
  })

})
