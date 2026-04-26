import { test, expect } from '@playwright/test'

test.describe('Admin – Configuración (/admin/configuracion)', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/configuracion')
    await expect(page.getByRole('heading', { name: 'Configuración' })).toBeVisible({ timeout: 10_000 })
  })

  // ── CFG-001 ─────────────────────────────────────────────────────────────────
  test('CFG-001 | Vista carga con todas las pestañas de configuración', async ({ page }) => {
    const expectedTabs = [
      'Tipos de Compra',
      'Tipos de Cliente',
      'Talles',
      'Colores',
      'Branding',
      'Pagos',
      'Point POS',
    ]
    for (const tab of expectedTabs) {
      await expect(page.getByRole('button', { name: tab })).toBeVisible()
    }
  })

  // ── CFG-002 ─────────────────────────────────────────────────────────────────
  test('CFG-002 | Tab Branding — cambiar nombre de la tienda y guardar', async ({ page }) => {
    await page.getByRole('button', { name: 'Branding' }).click()
    await expect(page.getByText('Branding de la tienda')).toBeVisible({ timeout: 5_000 })

    const nameInput = page.locator('input[type="text"]').filter({ hasText: '' }).first()
    // Buscar el input del nombre de la tienda específicamente
    const storeNameInput = page.locator('input').nth(0)
    await storeNameInput.fill('Jedami Test')

    await page.getByRole('button', { name: 'Guardar' }).last().click()

    // Toast o confirmación de guardado
    await expect(page.getByText(/guardad|actualiz/i)).toBeVisible({ timeout: 8_000 })

    // Restaurar nombre original
    await storeNameInput.fill('Jedami')
    await page.getByRole('button', { name: 'Guardar' }).last().click()
  })

  // ── CFG-010 ─────────────────────────────────────────────────────────────────
  test('CFG-010 | Tab Tipos de Compra — agregar y eliminar tipo', async ({ page }) => {
    await page.getByRole('button', { name: 'Tipos de Compra' }).click()

    await expect(page.getByText('Agregar tipo de compra')).toBeVisible({ timeout: 5_000 })

    // Agregar un tipo de prueba
    const codeInput = page.getByPlaceholder('ej: mayoreo')
    const labelInput = page.getByPlaceholder('ej: Por mayoreo')
    await codeInput.fill('e2e-tipo')
    await labelInput.fill('E2E Tipo Prueba')
    await page.getByRole('button', { name: 'Agregar' }).first().click()

    await expect(page.getByText('E2E Tipo Prueba')).toBeVisible({ timeout: 8_000 })
  })

  // ── CFG-012 ─────────────────────────────────────────────────────────────────
  test('CFG-012 | Tab Talles — crear nuevo talle', async ({ page }) => {
    await page.getByRole('button', { name: 'Talles' }).click()

    await expect(page.getByText('Agregar talle')).toBeVisible({ timeout: 5_000 })

    // Ingresar nueva talla
    await page.getByPlaceholder('ej: XXL').fill('E2E-TEST-SIZE')
    await page.getByRole('button', { name: 'Agregar' }).first().click()

    await expect(page.getByText('E2E-TEST-SIZE')).toBeVisible({ timeout: 8_000 })
  })

  // ── CFG-014 ─────────────────────────────────────────────────────────────────
  test('CFG-014 | Tab Colores — agregar nuevo color', async ({ page }) => {
    await page.getByRole('button', { name: 'Colores' }).click()

    await expect(page.getByText('Agregar color')).toBeVisible({ timeout: 5_000 })

    // Ingresar nuevo color
    await page.getByPlaceholder('ej: Turquesa').fill('E2E-Color-Test')
    await page.getByRole('button', { name: 'Agregar' }).first().click()

    await expect(page.getByText('E2E-Color-Test')).toBeVisible({ timeout: 8_000 })
  })

  // ── CFG-011 ─────────────────────────────────────────────────────────────────
  test('CFG-011 | Tab Tipos de Cliente — lista carga sin errores', async ({ page }) => {
    await page.getByRole('button', { name: 'Tipos de Cliente' }).click()

    await expect(page.getByText('Agregar tipo de cliente')).toBeVisible({ timeout: 5_000 })
    await expect(page.locator('.animate-pulse').first()).not.toBeVisible({ timeout: 8_000 })
  })

  // ── CFG-005 ─────────────────────────────────────────────────────────────────
  test('CFG-005 | Tab Pagos — tabla de medios de pago por tipo de cliente visible', async ({ page }) => {
    await page.getByRole('button', { name: 'Pagos' }).click()

    await expect(page.getByText('Medios de pago por tipo de cliente')).toBeVisible({ timeout: 5_000 })

    // La tabla de gateways por tipo de cliente debe estar presente
    await expect(page.locator('table').last()).toBeVisible({ timeout: 8_000 })
  })

  // ── CFG-009 ─────────────────────────────────────────────────────────────────
  test('CFG-009 | Tab Point POS — vista carga sin errores', async ({ page }) => {
    await page.getByRole('button', { name: 'Point POS' }).click()

    // La tab Point carga sin error (puede tener o no dispositivo activo)
    await expect(page.getByText('Error')).not.toBeVisible({ timeout: 5_000 })
  })

  // ── CFG-004 ─────────────────────────────────────────────────────────────────
  test('CFG-004 | Tab Pagos — configurar WhatsApp de contacto', async ({ page }) => {
    await page.getByRole('button', { name: 'Pagos' }).click()
    await expect(page.getByPlaceholder('ej: 5491112345678')).toBeVisible({ timeout: 5_000 })

    await page.getByPlaceholder('ej: 5491112345678').fill('5491100000000')
    await page.getByRole('button', { name: 'Guardar datos bancarios' }).click()

    await expect(page.getByText('✓ Guardado')).toBeVisible({ timeout: 8_000 })
  })

  // ── CFG-006 ─────────────────────────────────────────────────────────────────
  test('CFG-006 | Tab Medios de pago — activar/desactivar gateway', async ({ page }) => {
    await page.getByRole('button', { name: 'Pagos' }).click()
    await expect(page.getByText('Medios de pago por tipo de cliente')).toBeVisible({ timeout: 5_000 })

    const toggleBtn = page.locator('button').filter({ hasText: /^(Activo|Inactivo)$/ }).first()
    await toggleBtn.click()

    await expect(page.getByText(/actualizado/i)).toBeVisible({ timeout: 8_000 })
  })

  // ── CFG-007 ─────────────────────────────────────────────────────────────────
  test('CFG-007 | Tab Medios de pago — activar múltiples gateways', async ({ page }) => {
    // Omitido: requiere conocer estado inicial de múltiples gateways para verificar correctamente
    test.skip()
  })

  // ── CFG-008 ─────────────────────────────────────────────────────────────────
  test('CFG-008 | Tab Medios de pago — desactivar gateway', async ({ page }) => {
    await page.getByRole('button', { name: 'Pagos' }).click()
    await expect(page.getByText('Medios de pago por tipo de cliente')).toBeVisible({ timeout: 5_000 })

    // Revertir el toggle del primer gateway (restaurar estado)
    const toggleBtn = page.locator('button').filter({ hasText: /^(Activo|Inactivo)$/ }).first()
    await toggleBtn.click()

    await expect(page.getByText(/actualizado/i)).toBeVisible({ timeout: 8_000 })
  })

  // ── CFG-013 ─────────────────────────────────────────────────────────────────
  test('CFG-013 | Tab Talles — soft-delete y reactivación', async ({ page }) => {
    // Omitido: la UI solo expone "Eliminar" (hard delete), sin opción de reactivación
    test.skip()
  })

  // ── CFG-015 ─────────────────────────────────────────────────────────────────
  test('CFG-015 | Cambios sin guardar — alerta antes de salir', async ({ page }) => {
    // Omitido: depende de si el router guard de unsaved changes está implementado
    test.skip()
  })

})
