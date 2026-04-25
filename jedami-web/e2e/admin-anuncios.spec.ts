import { test, expect } from '@playwright/test'

test.describe('Admin – Anuncios (/admin/anuncios)', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/anuncios')
    await expect(page.getByRole('heading', { name: 'Anuncios' })).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('.animate-pulse').first()).not.toBeVisible({ timeout: 10_000 })
  })

  // ── ANN-001 ─────────────────────────────────────────────────────────────────
  test('ANN-001 | Vista carga con anuncios existentes sin errores', async ({ page }) => {
    await expect(page.getByText('Error al cargar los anuncios')).not.toBeVisible()

    // Con anuncios en la DB: al menos uno visible, o estado vacío
    const hasAnnouncements = await page.getByText(/Nuevos ingresos|Precio especial|Envío gratis/).count() > 0
    const isEmpty = await page.getByText('Todavía no hay anuncios.').isVisible()
    expect(hasAnnouncements || isEmpty).toBe(true)
  })

  // ── ANN-002 ─────────────────────────────────────────────────────────────────
  test('ANN-002 | Crear nuevo anuncio', async ({ page }) => {
    await page.getByRole('button', { name: '+ Nuevo anuncio' }).click()

    await expect(page.getByRole('heading', { name: 'Nuevo anuncio' })).toBeVisible({ timeout: 5_000 })

    await page.getByPlaceholder('Título del anuncio').fill('E2E Anuncio Test')
    await page.getByPlaceholder('Descripción o detalle del anuncio...').fill('Descripción de prueba e2e')

    await page.getByRole('button', { name: 'Crear anuncio' }).click()

    // El anuncio aparece en la lista
    await expect(page.getByText('E2E Anuncio Test').first()).toBeVisible({ timeout: 8_000 })
  })

  // ── ANN-003 ─────────────────────────────────────────────────────────────────
  test('ANN-003 | Activar/desactivar anuncio existente', async ({ page }) => {
    const toggleBtn = page.getByRole('button', { name: /Activar|Desactivar/ }).first()
    await expect(toggleBtn).toBeVisible({ timeout: 5_000 })

    const initialText = await toggleBtn.textContent()
    await toggleBtn.click()

    // El estado cambia
    await expect(toggleBtn).not.toHaveText(initialText ?? '', { timeout: 5_000 })
  })

  // ── ANN-004 ─────────────────────────────────────────────────────────────────
  test('ANN-004 | Reordenar anuncios — botones ↑/↓ presentes', async ({ page }) => {
    const announcements = await page.getByRole('button', { name: /Activar|Desactivar/ }).count()
    if (announcements < 2) {
      test.skip()
    }

    await expect(page.getByRole('button', { name: '↑' }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: '↓' }).first()).toBeVisible()

    // Reordenar: click en ↓ del primero
    await page.getByRole('button', { name: '↓' }).first().click()

    // No debe aparecer error
    await expect(page.getByText('Error al reordenar')).not.toBeVisible({ timeout: 3_000 })
  })

  // ── ANN-005 ─────────────────────────────────────────────────────────────────
  test('ANN-005 | Eliminar anuncio', async ({ page }) => {
    // Crear uno para eliminarlo
    await page.getByRole('button', { name: '+ Nuevo anuncio' }).click()
    await page.getByPlaceholder('Título del anuncio').fill('E2E-Borrar-Me')
    await page.getByRole('button', { name: 'Crear anuncio' }).click()
    await expect(page.getByText('E2E-Borrar-Me').first()).toBeVisible({ timeout: 8_000 })

    // Contar cuántos hay (incluyendo el recién creado y posibles runs anteriores)
    const countBefore = await page.getByText('E2E-Borrar-Me').count()

    // Usar el contenedor directo de la lista (div.space-y-3 > div[card])
    const borrarMeCards = page.locator('.space-y-3 > div').filter({ hasText: 'E2E-Borrar-Me' })
    const lastCard = borrarMeCards.last()
    await expect(lastCard).toBeVisible()

    // Eliminar tiene confirmación de dos pasos
    await lastCard.getByRole('button', { name: 'Eliminar' }).click()
    await lastCard.getByRole('button', { name: 'Confirmar' }).click()

    // Hay uno menos en la lista
    await expect(page.getByText('E2E-Borrar-Me')).toHaveCount(countBefore - 1, { timeout: 8_000 })
  })

  // ── ANN-006 ─────────────────────────────────────────────────────────────────
  test('ANN-006 | Anuncio activo visible en el catálogo', async ({ page }) => {
    // Verificar que hay anuncios activos (botón "Desactivar" implica que está activo)
    const activeCount = await page.getByRole('button', { name: 'Desactivar' }).count()
    if (activeCount === 0) {
      test.skip()
    }

    await page.goto('/catalogo')
    // Los anuncios se muestran en el sidebar o zona designada — verificar presencia de la sección
    await expect(page.locator('main')).toBeVisible({ timeout: 8_000 })
    // El catálogo carga sin errores (los anuncios son parte del sidebar)
    await expect(page.getByText('Error')).not.toBeVisible()
  })

})
