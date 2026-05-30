import { expect, type Page } from '@playwright/test';
import { env, type RunContext } from '../env';
import { shot } from '../helpers';

export async function vendorsList(page: Page, _ctx: RunContext): Promise<void> {
  await page.goto(env.base + '/vendors');
  await expect(page.getByRole('heading', { name: 'Proveedores' })).toBeVisible();

  const tablist = page.getByRole('tablist', { name: 'Filtrar proveedores' });
  await expect(tablist).toBeVisible();
  await shot(page, '03-vendors-all');

  // Ejercemos el filtro "Atención" (navega a /vendors?status=atencion).
  await page.getByRole('tab', { name: /Atención/ }).click();
  await page.waitForURL(/\/vendors\?status=atencion/);
  await shot(page, '03-vendors-atencion');

  // Volvemos a "Todos".
  await page.getByRole('tab', { name: /Todos/ }).click();
  await page.waitForURL(/\/vendors$/);
}
