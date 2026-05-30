import { expect, type Page } from '@playwright/test';
import { env, type RunContext } from '../env';
import { shot } from '../helpers';

export async function vendorDetail(page: Page, ctx: RunContext): Promise<void> {
  if (!ctx.vendorId) throw new Error('vendorDetail requiere ctx.vendorId (corré antes create-vendor)');
  await page.goto(`${env.base}/vendors/${ctx.vendorId}`);

  // Recorremos las tabs del detalle.
  for (const { tab, name } of [
    { tab: 'documentos', name: /Documentos/ },
    { tab: 'pasaporte', name: /Pasaporte/ },
    { tab: 'portal', name: /Portal/ },
    { tab: 'resumen', name: /Resumen/ },
  ]) {
    await page.getByRole('tab', { name }).click();
    await expect(page.locator('[role="tabpanel"]')).toBeVisible();
    await shot(page, `05-vendor-tab-${tab}`);
  }
}
