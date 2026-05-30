import { expect, type Page } from '@playwright/test';
import { env, type RunContext } from '../env';
import { shot, persistStorageState } from '../helpers';

export async function login(page: Page, _ctx: RunContext): Promise<void> {
  await page.goto(env.base + env.loginPath);
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();

  await page.locator('#email').fill(env.email);
  await page.locator('#password').fill(env.password);
  await shot(page, '01-login-filled');

  await page.getByRole('button', { name: 'Entrar' }).click();

  // Tras login exitoso redirige a /dashboard (o /dashboard?claimed=N).
  await page.waitForURL(new RegExp(`${escapeRe(env.base)}/dashboard`), { timeout: 30_000 });
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

  // Persistimos la sesión para poder reanudar pasos posteriores sin re-loguear.
  await persistStorageState(page.context());
  await shot(page, '01-login-success');
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
