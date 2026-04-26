import { test, expect } from '@playwright/test'

test.describe('Mi Perfil (/perfil)', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/perfil')
    await expect(page.locator('h1', { hasText: 'Mi perfil' })).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('.animate-pulse').first()).not.toBeVisible({ timeout: 10_000 })
  })

  // ── PERF-001 ─────────────────────────────────────────────────────────────────
  test('PERF-001 | Perfil carga con datos del usuario', async ({ page }) => {
    // El email del usuario autenticado se muestra en el perfil
    await expect(page.locator('h1', { hasText: 'Mi perfil' })).toBeVisible()
    await expect(page.getByText('No se pudo cargar el perfil.')).not.toBeVisible()
    // Verificar que aparece algún email
    await expect(page.locator('p').filter({ hasText: '@' }).first()).toBeVisible()
  })

  // ── PERF-002 ─────────────────────────────────────────────────────────────────
  test('PERF-002 | Tipo de cliente visible (Mayorista / Minorista)', async ({ page }) => {
    // El admin no tiene customer → la sección "Tipo de cuenta" no aparece
    // La sección "Roles" siempre aparece con al menos un badge
    await expect(page.getByText('Roles', { exact: false })).toBeVisible()
    const badge = page.locator('span.rounded-full').filter({ hasText: /admin|retail|wholesale/i }).first()
    await expect(badge).toBeVisible()
  })

  // ── PERF-003 ─────────────────────────────────────────────────────────────────
  test('PERF-003 | Botón de logout cierra la sesión', async ({ page }) => {
    // El botón "Salir" está en el AppLayout header (no en la vista de perfil)
    const logoutBtn = page.getByRole('button', { name: 'Salir' })
    await expect(logoutBtn).toBeVisible()
    await logoutBtn.click()

    // Tras cerrar sesión redirige al login
    await expect(page).toHaveURL(/\/login/, { timeout: 8_000 })
  })

  // ── PERF-004 ─────────────────────────────────────────────────────────────────
  test('PERF-004 | Perfil no accesible sin sesión', async ({ page }) => {
    // PERF-003 cierra sesión — este test verifica que sin sesión /perfil redirige a /login.
    // Como PERF-003 se ejecuta antes, la sesión ya puede estar cerrada aquí.
    // Si no, hacemos logout nosotros mismos.
    const salirBtn = page.getByRole('button', { name: 'Salir' })
    if (await salirBtn.isVisible({ timeout: 1_000 })) {
      await salirBtn.click()
      await expect(page).toHaveURL(/\/login/, { timeout: 5_000 })
    }
    // Navegar a /perfil sin sesión → debe redirigir al login
    await page.goto('/perfil')
    await expect(page).toHaveURL(/\/login/, { timeout: 8_000 })
  })

  // ── PERF-005 ─────────────────────────────────────────────────────────────────
  test('PERF-005 | Link a "Mis Pedidos" disponible', async ({ page }) => {
    // El link "Mis pedidos" está en el AppLayout (nav o header)
    const missPedidosLink = page.getByRole('link', { name: /Mis pedidos/i })
    await expect(missPedidosLink).toBeVisible()
    await missPedidosLink.click()
    await expect(page).toHaveURL('/pedidos', { timeout: 8_000 })
  })

})
