import { expect, type Page } from '@playwright/test';
import { env, type RunContext } from '../env';
import { shot } from '../helpers';

export async function integrations(page: Page, _ctx: RunContext): Promise<void> {
  await page.goto(env.base + '/integrations');
  // La página de integraciones gestiona API keys / MCP.
  await expect(page.locator('#main-content')).toBeVisible();
  await expect(page.getByRole('heading').first()).toBeVisible();
  await shot(page, '09-integrations');
}
