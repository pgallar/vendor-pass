import { expect, type Page } from '@playwright/test';
import { env, type RunContext } from '../env';
import { shot } from '../helpers';

export async function landing(page: Page, _ctx: RunContext): Promise<void> {
  await page.goto(env.base + '/');
  await expect(page).toHaveURL(new RegExp(`${escapeRe(env.base)}/?$`));
  // La landing es pública y ofrece acceso a la app.
  const accessLink = page.getByRole('link', { name: /acceder|iniciar sesi[oó]n/i }).first();
  await expect(accessLink).toBeVisible();
  await shot(page, '00-landing');
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
