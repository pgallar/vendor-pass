import { expect, type Page } from '@playwright/test';
import { env, type RunContext } from '../env';
import { shot } from '../helpers';

export async function settings(page: Page, _ctx: RunContext): Promise<void> {
  await page.goto(env.base + '/settings');
  await expect(page.locator('#main-content')).toBeVisible();
  await expect(page.getByRole('heading').first()).toBeVisible();
  // El email de la cuenta debe figurar en el área de perfil.
  await expect(page.getByText(env.email).first()).toBeVisible();
  await shot(page, '11-settings');
}
