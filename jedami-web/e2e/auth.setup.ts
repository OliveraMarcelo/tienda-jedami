import { test as setup, expect } from '@playwright/test'

export const ADMIN_AUTH_FILE = 'playwright/.auth/admin.json'

const ADMIN = {
  email:    process.env.E2E_ADMIN_EMAIL    ?? 'admin@jedami.com',
  password: process.env.E2E_ADMIN_PASSWORD ?? 'admin123',
}

setup('autenticar admin', async ({ page }) => {
  await page.goto('/login')
  await page.getByPlaceholder('tu@email.com').fill(ADMIN.email)
  await page.getByPlaceholder('••••••••').fill(ADMIN.password)
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page).toHaveURL('/admin', { timeout: 10_000 })

  await page.context().storageState({ path: ADMIN_AUTH_FILE })
})
