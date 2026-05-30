import { expect, type Page } from '@playwright/test';
import { env, type RunContext } from '../env';
import { shot } from '../helpers';

export async function dashboard(page: Page, _ctx: RunContext): Promise<void> {
  const heading = page.getByRole('heading', { name: 'Dashboard' });

  // Tras login ya estamos en /dashboard; evitar un goto redundante (Arkiv puede fallar en recarga).
  if (!(await heading.isVisible().catch(() => false))) {
    await gotoDashboard(page);
  }

  await expect(heading).toBeVisible({ timeout: 30_000 });
  // KPIs clave del panel de cumplimiento.
  const kpis = page.getByLabel('Indicadores clave');
  await expect(kpis.getByText('Proveedores', { exact: true })).toBeVisible();
  await expect(kpis.getByText('Atención', { exact: true })).toBeVisible();
  await expect(kpis.getByText('Bloqueados', { exact: true })).toBeVisible();
  await shot(page, '02-dashboard');
}

async function gotoDashboard(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.goto(env.base + env.dashboardPath);
    const heading = page.getByRole('heading', { name: 'Dashboard' });
    if (await heading.isVisible({ timeout: 20_000 }).catch(() => false)) return;

    const errorPage = page.getByRole('heading', { name: "This page couldn't load" });
    if (await errorPage.isVisible().catch(() => false)) {
      await page.reload();
      if (await heading.isVisible({ timeout: 30_000 }).catch(() => false)) return;
    }
  }
}
