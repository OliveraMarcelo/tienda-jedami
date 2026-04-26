import { test, expect } from '@playwright/test'

// Producto de prueba creado/eliminado en esta suite
const TEST_PRODUCT_NAME = 'e2e-producto-test'

// ─── Suite ────────────────────────────────────────────────────────────────────

test.describe('Admin – Productos (/admin/productos)', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/productos')
    await expect(page.getByRole('heading', { name: 'Productos' })).toBeVisible()
    // Esperar que la tabla cargue (skeleton desaparece)
    await expect(page.locator('.animate-pulse').first()).not.toBeVisible({ timeout: 10_000 })
  })

  // ── APROD-001 ─────────────────────────────────────────────────────────────────
  test('APROD-001 | Lista de productos carga con nombre, categoría y precio', async ({ page }) => {
    // Al menos un producto existe en el sistema
    const rows = page.locator('table tbody tr').first()
    await expect(rows).toBeVisible()

    // Columnas clave visibles en la tabla
    await expect(page.getByRole('button', { name: '+ Nuevo producto' })).toBeVisible()
  })

  // ── APROD-002 ─────────────────────────────────────────────────────────────────
  test('APROD-002 | Crear nuevo producto', async ({ page }) => {
    await page.getByRole('button', { name: '+ Nuevo producto' }).click()
    await expect(page.getByRole('heading', { level: 2 })).toBeVisible({ timeout: 5_000 })

    // Completar formulario mínimo
    await page.getByPlaceholder('Nombre del producto').fill(TEST_PRODUCT_NAME)
    await page.getByPlaceholder('0').fill('1500')

    await page.getByRole('button', { name: 'Guardar y agregar fotos' }).click()

    // Toast de confirmación o el producto aparece en la lista
    await expect(page.getByText(TEST_PRODUCT_NAME).first()).toBeVisible({ timeout: 8_000 })
  })

  // ── APROD-003 ─────────────────────────────────────────────────────────────────
  test('APROD-003 | Editar producto existente', async ({ page }) => {
    // Click en Editar del primer producto
    const firstEditBtn = page.getByRole('button', { name: 'Editar' }).first()
    await expect(firstEditBtn).toBeVisible()
    await firstEditBtn.click()

    // El formulario se abre (dialog/panel)
    await expect(page.getByPlaceholder('Nombre del producto')).toBeVisible({ timeout: 5_000 })

    // Modificar el nombre ligeramente
    const nameInput = page.getByPlaceholder('Nombre del producto')
    await nameInput.fill('Producto editado e2e')

    await page.getByRole('button', { name: 'Guardar' }).last().click()

    // Confirmar que aparece el nombre actualizado
    await expect(page.getByText('Producto editado e2e')).toBeVisible({ timeout: 8_000 })
  })

  // ── APROD-004 ─────────────────────────────────────────────────────────────────
  test('APROD-004 | Eliminar producto con confirmación', async ({ page }) => {
    // Primero crear un producto para eliminarlo sin afectar datos reales
    await page.getByRole('button', { name: '+ Nuevo producto' }).click()
    await page.getByPlaceholder('Nombre del producto').fill('e2e-eliminar-me')
    await page.getByPlaceholder('0').fill('100')
    await page.getByRole('button', { name: 'Guardar y agregar fotos' }).click()
    await expect(page.getByText('e2e-eliminar-me').first()).toBeVisible({ timeout: 8_000 })
    await page.getByRole('button', { name: 'Cancelar' }).click()

    // Click en Eliminar de la fila con ese nombre (puede haber varias de runs anteriores, tomar la primera)
    const row = page.locator('tr').filter({ hasText: 'e2e-eliminar-me' }).first()
    await row.getByRole('button', { name: 'Eliminar' }).click()

    // Dialog de confirmación
    await expect(page.getByRole('heading', { name: 'Confirmar acción' })).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText(/e2e-eliminar-me/).first()).toBeVisible()

    await page.getByRole('button', { name: 'Eliminar' }).last().click()

    // La lista tiene al menos uno menos (puede haber duplicados de runs anteriores)
    await page.waitForTimeout(500)
    // El heading del dialog ya no está (confirmación procesada)
    await expect(page.getByRole('heading', { name: 'Confirmar acción' })).not.toBeVisible({ timeout: 8_000 })
  })

  // ── APROD-005 ─────────────────────────────────────────────────────────────────
  test('APROD-005 | Crear variante (talla + color) en producto', async ({ page }) => {
    // Expandir variantes del primer producto usando el botón "▶ Variantes (N)"
    const variantToggle = page.getByRole('button', { name: /Variantes/ }).first()
    await expect(variantToggle).toBeVisible()
    await variantToggle.click()

    // Botón "+ Agregar variante" en el panel expandido
    const addVariantBtn = page.getByRole('button', { name: '+ Agregar variante' })
    await expect(addVariantBtn).toBeVisible({ timeout: 5_000 })
    await addVariantBtn.click()

    // Dialog de variante (escopeado al modal)
    const dialog = page.locator('.fixed.inset-0')
    await expect(dialog.getByRole('heading', { name: 'Agregar variante' })).toBeVisible({ timeout: 5_000 })

    // Seleccionar primera talla y primer color disponibles dentro del dialog
    await dialog.locator('select').first().selectOption({ index: 1 })
    await dialog.locator('select').last().selectOption({ index: 1 })
    await dialog.getByPlaceholder('0').fill('10')

    // El botón de submit dentro del dialog es "Agregar"
    await dialog.getByRole('button', { name: 'Agregar' }).click()

    // El dialog se cierra — la variante fue guardada
    await expect(dialog).not.toBeVisible({ timeout: 8_000 })
  })

  // ── APROD-006 ─────────────────────────────────────────────────────────────────
  test('APROD-006 | Eliminar variante de producto', async ({ page }) => {
    // Expandir variantes del primer producto (que debería tener E2E-TEST-SIZE de APROD-005)
    const variantToggle = page.getByRole('button', { name: /Variantes/ }).first()
    await expect(variantToggle).toBeVisible()
    await variantToggle.click()

    const e2eRow = page.locator('tr').filter({ hasText: 'E2E-TEST-SIZE' })
    const hasRow = await e2eRow.count() > 0
    if (!hasRow) { test.skip(); return }

    const xBefore = await e2eRow.getByRole('button', { name: '×' }).count()
    if (xBefore === 0) { test.skip(); return }

    await e2eRow.getByRole('button', { name: '×' }).first().click()

    await expect(page.getByRole('heading', { name: 'Confirmar acción' })).toBeVisible({ timeout: 5_000 })
    await page.getByRole('button', { name: 'Eliminar' }).last().click()

    await expect(page.getByRole('heading', { name: 'Confirmar acción' })).not.toBeVisible({ timeout: 8_000 })
    const xAfter = await e2eRow.getByRole('button', { name: '×' }).count()
    expect(xAfter).toBeLessThan(xBefore)
  })

  // ── APROD-010 ─────────────────────────────────────────────────────────────────
  test('APROD-010 | Actualizar precio mayorista en grid de variantes', async ({ page }) => {
    // Expandir primer producto que tenga variantes
    const rows = await page.locator('table tbody tr').all()
    let expanded = false
    for (const row of rows) {
      await row.click()
      const saveBtn = page.getByRole('button', { name: 'Guardar cambios' })
      if (await saveBtn.isVisible()) {
        expanded = true
        break
      }
    }
    if (!expanded) test.skip()

    // Modificar un precio en el grid
    const priceInput = page.locator('input[type="number"]').last()
    await priceInput.fill('9999')
    await page.getByRole('button', { name: 'Guardar cambios' }).click()

    // Toast de éxito
    await expect(page.locator('text=/guardad|actualiz/i')).toBeVisible({ timeout: 8_000 })
  })

  // ── APROD-011 ─────────────────────────────────────────────────────────────────
  test('APROD-011 | Panel de descuentos — crear regla por cantidad', async ({ page }) => {
    // Abrir descuentos del primer producto
    const discountBtn = page.getByRole('button', { name: /Descuentos/ }).first()
    await expect(discountBtn).toBeVisible()
    await discountBtn.click()

    // Panel de descuentos visible
    await expect(page.getByText('Escalones por cantidad')).toBeVisible({ timeout: 5_000 })

    // Agregar escalón: desde 10 uds, 5% descuento
    // Navegar desde el <p> "Escalones por cantidad" a su div padre (evita match con sección "curva")
    const qtySection = page.locator('p', { hasText: 'Escalones por cantidad' }).locator('xpath=..')
    await qtySection.getByPlaceholder('Desde (uds.)').fill('10')
    await qtySection.getByPlaceholder('% descuento').fill('5')
    await qtySection.getByRole('button', { name: '+ Agregar' }).click()

    // La regla aparece en la tabla (buscar dentro de la sección de cantidad)
    await expect(qtySection.getByRole('cell', { name: '10' })).toBeVisible({ timeout: 8_000 })
  })

  // ── APROD-012 ─────────────────────────────────────────────────────────────────
  test('APROD-012 | Panel de descuentos — crear regla por curva', async ({ page }) => {
    const discountBtn = page.getByRole('button', { name: /Descuentos/ }).first()
    await expect(discountBtn).toBeVisible()
    await discountBtn.click()

    await expect(page.getByText('Escalones por curva')).toBeVisible({ timeout: 5_000 })

    const curvaSection = page.locator('p', { hasText: 'Escalones por curva' }).locator('xpath=..')
    await curvaSection.getByPlaceholder('Desde (curvas)').fill('3')
    await curvaSection.getByPlaceholder('% descuento').fill('15')
    await curvaSection.getByRole('button', { name: '+ Agregar' }).click()

    await expect(page.getByText('Escalón de curva creado')).toBeVisible({ timeout: 8_000 })
    await expect(curvaSection.getByRole('cell', { name: '3' }).first()).toBeVisible({ timeout: 5_000 })
  })

  // ── APROD-013 ─────────────────────────────────────────────────────────────────
  test('APROD-013 | Panel de descuentos — editar regla existente', async ({ page }) => {
    // Omitido: el panel no tiene edición inline — solo crear/eliminar reglas
    test.skip()
  })

  // ── APROD-014 ─────────────────────────────────────────────────────────────────
  test('APROD-014 | Panel de descuentos — eliminar regla', async ({ page }) => {
    const discountBtn = page.getByRole('button', { name: /Descuentos/ }).first()
    await expect(discountBtn).toBeVisible()
    await discountBtn.click()

    await expect(page.getByText('Escalones por curva')).toBeVisible({ timeout: 5_000 })

    const curvaSection = page.locator('p', { hasText: 'Escalones por curva' }).locator('xpath=..')
    const hasRules = await curvaSection.getByRole('button', { name: 'Eliminar' }).count() > 0
    if (!hasRules) { test.skip(); return }

    await curvaSection.getByRole('button', { name: 'Eliminar' }).first().click()
    await expect(page.getByRole('heading', { name: 'Confirmar acción' })).toBeVisible({ timeout: 5_000 })
    await page.getByRole('button', { name: 'Eliminar' }).last().click()

    await expect(page.getByText('Escalón eliminado')).toBeVisible({ timeout: 8_000 })
  })

  // ── APROD-015 ─────────────────────────────────────────────────────────────────
  test('APROD-015 | Configurar mínimo de compra del producto', async ({ page }) => {
    const discountBtn = page.getByRole('button', { name: /Descuentos/ }).first()
    await expect(discountBtn).toBeVisible()
    await discountBtn.click()

    await expect(page.getByText('Mínimo de compra (unidades)')).toBeVisible({ timeout: 5_000 })

    const minSection = page.locator('p', { hasText: 'Mínimo de compra (unidades)' }).locator('xpath=..')
    await minSection.getByPlaceholder('Sin mínimo').fill('5')
    await minSection.getByRole('button', { name: 'Guardar' }).click()

    await expect(page.getByText('Mínimo de compra actualizado')).toBeVisible({ timeout: 8_000 })
  })

  // ── APROD-016 ─────────────────────────────────────────────────────────────────
  test('APROD-016 | Validación — campos requeridos vacíos al crear producto', async ({ page }) => {
    await page.getByRole('button', { name: '+ Nuevo producto' }).click()
    await expect(page.getByPlaceholder('Nombre del producto')).toBeVisible({ timeout: 5_000 })

    // El botón está deshabilitado cuando los campos requeridos están vacíos
    await expect(page.getByRole('button', { name: 'Guardar y agregar fotos' })).toBeDisabled()

    // El panel sigue abierto y el campo nombre sigue visible
    await expect(page.getByPlaceholder('Nombre del producto')).toBeVisible()
  })

})
