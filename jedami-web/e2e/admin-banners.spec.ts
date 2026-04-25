import { test, expect } from '@playwright/test'

test.describe('Admin – Banners (/admin/banners)', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/banners')
    await expect(page.getByRole('heading', { name: 'Banners del catálogo' })).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('.animate-pulse').first()).not.toBeVisible({ timeout: 10_000 })
  })

  // ── BAN-001 ─────────────────────────────────────────────────────────────────
  test('BAN-001 | Vista carga con banners existentes sin errores', async ({ page }) => {
    await expect(page.getByText('Error al cargar los banners')).not.toBeVisible()

    // Con banners en la DB: debe mostrarse al menos uno
    // Sin banners: debe mostrarse el mensaje vacío
    const hasBanners = await page.locator('img').count() > 0
    const isEmpty = await page.getByText(/Sin banners|no hay banners/i).isVisible()
    expect(hasBanners || isEmpty).toBe(true)
  })

  // ── BAN-003 ─────────────────────────────────────────────────────────────────
  test('BAN-003 | Activar/desactivar banner (toggle)', async ({ page }) => {
    // Necesitamos al menos un banner
    const bannerCount = await page.locator('img').count()
    if (bannerCount === 0) {
      test.skip() // Sin banners en este entorno
    }

    // El toggle (botón activo/inactivo) debe estar presente
    const toggleBtn = page.getByRole('button', { name: /Activo|Inactivo|Activar|Desactivar/ }).first()
    await expect(toggleBtn).toBeVisible({ timeout: 5_000 })

    const initialText = await toggleBtn.textContent()
    await toggleBtn.click()

    // El texto del toggle cambia
    await expect(toggleBtn).not.toHaveText(initialText ?? '', { timeout: 5_000 })
  })

  // ── BAN-004 ─────────────────────────────────────────────────────────────────
  test('BAN-004 | Reordenar banners — botones arriba/abajo presentes', async ({ page }) => {
    const bannerCount = await page.locator('img').count()
    if (bannerCount < 2) {
      test.skip() // Necesita al menos 2 banners
    }

    // Los botones de orden están presentes
    await expect(page.getByRole('button', { name: '↑' }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: '↓' }).first()).toBeVisible()

    // Click en ↓ del primer banner
    await page.getByRole('button', { name: '↓' }).first().click()

    // No debe aparecer error
    await expect(page.getByText('Error al cargar los banners')).not.toBeVisible()
  })

  // ── BAN-005 ─────────────────────────────────────────────────────────────────
  test('BAN-005 | Eliminar banner con confirmación', async ({ page }) => {
    const bannerCount = await page.getByRole('button', { name: 'Eliminar' }).count()
    if (bannerCount === 0) {
      test.skip()
    }

    // Click en Eliminar del primer banner
    const deleteBtn = page.getByRole('button', { name: 'Eliminar' }).first()
    await expect(deleteBtn).toBeVisible()
    await deleteBtn.click()

    // Confirmación inline (Sí / No)
    await expect(page.getByRole('button', { name: 'Sí', exact: true })).toBeVisible({ timeout: 5_000 })
    await expect(page.getByRole('button', { name: 'No', exact: true })).toBeVisible()

    // Cancelar para no destruir datos
    await page.getByRole('button', { name: 'No', exact: true }).click()
  })

  // ── BAN-006 ─────────────────────────────────────────────────────────────────
  test('BAN-006 | Banner activo es visible en el catálogo público', async ({ page }) => {
    // Verificar que hay al menos un banner activo
    const activeBannerCount = await page.getByRole('button', { name: 'Activo' }).count()
    if (activeBannerCount === 0) {
      test.skip() // No hay banners activos
    }

    // Navegar al catálogo y verificar que el banner está visible
    await page.goto('/catalogo')
    // El banner se muestra en carrusel/slider/section
    await expect(page.locator('img').first()).toBeVisible({ timeout: 8_000 })
  })

  // ── BAN-002 ─────────────────────────────────────────────────────────────────
  test('BAN-002 | Sección de subida de nuevo banner presente', async ({ page }) => {
    // La sección de subida siempre visible (formulario al pie)
    await expect(page.getByRole('heading', { name: 'Subir nuevo banner' })).toBeVisible()
    await expect(page.locator('input[type="file"]')).toBeAttached()
    await expect(page.getByRole('button', { name: /Subir banner/ })).toBeVisible()
  })

})
