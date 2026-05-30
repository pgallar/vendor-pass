import { expect, type Page } from '@playwright/test';
import { env, type RunContext } from '../env';
import { shot } from '../helpers';

export async function docs(page: Page, _ctx: RunContext): Promise<void> {
  await page.goto(env.base + '/docs');
  await expect(page.getByRole('heading').first()).toBeVisible();
  await shot(page, '10-docs-index');

  // Visitamos un par de subpáginas de documentación.
  for (const slug of ['proveedores', 'documentos']) {
    await page.goto(`${env.base}/docs/${slug}`);
    await expect(page.getByRole('heading').first()).toBeVisible();
    await shot(page, `10-docs-${slug}`);
  }
}
