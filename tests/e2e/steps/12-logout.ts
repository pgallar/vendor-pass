import { expect, type Page } from '@playwright/test';
import { env, type RunContext } from '../env';
import { shot, gotoUntilHeading } from '../helpers';

export async function logout(page: Page, _ctx: RunContext): Promise<void> {
  // Settings usa AppShell (sidebar con logout) sin depender de Arkiv como el dashboard.
  await gotoUntilHeading(page, `${env.base}/settings`, 'Mi perfil');
  const signOut = page.getByRole('button', { name: 'Cerrar sesión' });
  await expect(signOut).toBeVisible();
  await signOut.click();

  // El POST a /auth/signout cierra sesión y nos saca del área autenticada.
  await page.waitForURL(/\/login/, { timeout: 30_000 });
  await shot(page, '12-logout');

  // Verificamos que /dashboard ya no es accesible (redirige a login).
  await page.goto(env.base + env.dashboardPath);
  await expect(page).toHaveURL(/\/login/);
}
