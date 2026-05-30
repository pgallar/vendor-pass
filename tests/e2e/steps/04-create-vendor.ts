import { expect, type Page } from '@playwright/test';
import { env, type RunContext } from '../env';
import { shot } from '../helpers';

export async function createVendor(page: Page, ctx: RunContext): Promise<void> {
  const stamp = new Date().toISOString().replace(/[:.TZ-]/g, '').slice(0, 14);
  const vendorName = `E2E-Proveedor-${stamp}`;

  await page.goto(env.base + '/vendors/new');
  await expect(page.getByRole('heading', { name: 'Nuevo proveedor' })).toBeVisible();

  await page.locator('#name').fill(vendorName);
  await page.locator('#category').fill('Logística E2E');
  await page.locator('#area').fill('Planta Central');
  await page.locator('#owner_name').fill('QA Bot');
  await page.locator('#owner_email').fill('qa.bot@example.com');
  await page.locator('#notes').fill('Proveedor creado por la suite E2E.');
  await shot(page, '04-vendor-form');

  await page.getByRole('button', { name: 'Registrar proveedor' }).click();

  // Al crear navega a /vendors/{uuid}.
  await page.waitForURL(/\/vendors\/[0-9a-fA-F-]{8,}$/, { timeout: 30_000 });
  const id = page.url().split('/vendors/')[1].split(/[?#]/)[0];
  expect(id, 'vendorId capturado de la URL').toBeTruthy();

  ctx.vendorId = id;
  ctx.vendorName = vendorName;

  await expect(page.getByRole('heading', { name: vendorName })).toBeVisible();
  await shot(page, '04-vendor-created');
}
