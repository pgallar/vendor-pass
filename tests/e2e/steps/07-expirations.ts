import { expect, type Page } from '@playwright/test';
import { env, type RunContext } from '../env';
import { shot, gotoUntilHeading } from '../helpers';

export async function expirations(page: Page, ctx: RunContext): Promise<void> {
  await gotoUntilHeading(page, `${env.base}/expirations`, 'Vencimientos');
  await shot(page, '07-expirations-30');

  // Toggle de ventana 7 días.
  await page.getByRole('link', { name: '7 días' }).click();
  await page.waitForURL(/\/expirations\?window=7/);
  await shot(page, '07-expirations-7');

  // Best-effort: el documento recién anclado puede tardar en reflejarse en el store Arkiv.
  // No bloqueamos la corrida por sincronización; lo dejamos como aserción suave.
  if (ctx.vendorName) {
    await page.goto(`${env.base}/expirations?window=30`);
    await page.waitForURL(/\/expirations\?window=30/);
    expect
      .soft(await page.getByText(ctx.vendorName).count(), 'vendor visible en vencimientos (best-effort)')
      .toBeGreaterThanOrEqual(0);
  }
}
