import fs from 'node:fs';
import path from 'node:path';
import { expect, type Page, type BrowserContext } from '@playwright/test';
import { env, type RunContext } from './env';

const STATE_FILE = path.join(env.artifactsDir, 'state.json');
const STORAGE_FILE = path.join(env.artifactsDir, 'storageState.json');
const SHOTS_DIR = path.join(env.artifactsDir, 'screenshots');

export function ensureDirs(): void {
  fs.mkdirSync(env.artifactsDir, { recursive: true });
  fs.mkdirSync(SHOTS_DIR, { recursive: true });
}

export function loadContext(): RunContext {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) as RunContext;
  } catch {
    return {};
  }
}

export function saveContext(ctx: RunContext): void {
  ensureDirs();
  fs.writeFileSync(STATE_FILE, JSON.stringify(ctx, null, 2), 'utf8');
}

export const storageStatePath = STORAGE_FILE;
export function hasStorageState(): boolean {
  return fs.existsSync(STORAGE_FILE);
}

export async function persistStorageState(context: BrowserContext): Promise<void> {
  ensureDirs();
  await context.storageState({ path: STORAGE_FILE });
}

/** Captura una screenshot full-page numerada para revisión visual. */
export async function shot(page: Page, name: string): Promise<void> {
  ensureDirs();
  await page.screenshot({
    path: path.join(SHOTS_DIR, `${name}.png`),
    fullPage: true,
  });
}

/** Navega con reintentos ante errores transitorios del servidor (p. ej. Arkiv RPC). */
export async function gotoUntilHeading(
  page: Page,
  url: string,
  heading: string | RegExp,
  timeout = 30_000,
): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.goto(url);
    const target = page.getByRole('heading', { name: heading });
    if (await target.isVisible({ timeout }).catch(() => false)) return;

    const errorPage = page.getByRole('heading', { name: "This page couldn't load" });
    if (await errorPage.isVisible().catch(() => false)) {
      await page.reload();
      if (await target.isVisible({ timeout }).catch(() => false)) return;
    }
  }

  await expect(page.getByRole('heading', { name: heading })).toBeVisible({ timeout });
}
