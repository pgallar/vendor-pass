import fs from 'node:fs';
import path from 'node:path';
import { test as setup, expect } from '@playwright/test';
import { env, STORAGE_STATE } from './documents/support';

setup('autenticar y guardar sesión', async ({ page }) => {
  fs.mkdirSync(path.dirname(STORAGE_STATE), { recursive: true });

  await page.goto(`${env.base}/login`);
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();

  await page.locator('#email').fill(env.email);
  await page.locator('#password').fill(env.password);
  await page.getByRole('button', { name: 'Entrar' }).click();

  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
  
  const heading = page.getByRole('heading', { name: 'Dashboard' });
  const errorPage = page.getByRole('heading', { name: "This page couldn't load" });
  for (let attempt = 0; attempt < 5; attempt++) {
    const result = await Promise.race([
      heading.waitFor({ state: 'visible', timeout: 20_000 }).then(() => 'success' as const),
      errorPage.waitFor({ state: 'visible', timeout: 20_000 }).then(() => 'error' as const),
    ]).catch(() => 'timeout' as const);

    if (result === 'success') break;
    await page.reload();
  }
  await expect(heading).toBeVisible({ timeout: 30_000 });

  await page.context().storageState({ path: STORAGE_STATE });
});
