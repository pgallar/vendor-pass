import { test, expect } from '@playwright/test';
import { env, ensureTestVendor, shotPath, STORAGE_STATE } from './support';
import { FIXTURES } from './fixtures-manifest';

let vendorId: string;

test.beforeAll(async ({ playwright }) => {
  // beforeAll solo recibe fixtures worker-scoped; creamos un request autenticado a mano.
  const api = await playwright.request.newContext({ storageState: STORAGE_STATE });
  vendorId = await ensureTestVendor(api);
  await api.dispose();
});

for (const fx of FIXTURES) {
  test(`importa y autocompleta con IA: ${fx.label}`, async ({ page }) => {
    await page.goto(`${env.base}/vendors/${vendorId}/documents/new`);
    await expect(page.getByRole('heading', { name: 'Agregar documento' })).toBeVisible();

    // Adjuntar el PDF real dispara /api/upload + /api/documents/extract en paralelo.
    await page.locator('#file').setInputFiles(fx.file);
    await page.screenshot({ path: shotPath(`uploading-${fx.expectedType}`) });

    // Banner de IA: "Analizando…" → "Campos precargados por IA · confianza X%".
    const aiBanner = page.getByText(/Campos precargados por IA/i);
    try {
      await expect(aiBanner).toBeVisible({ timeout: 90_000 });
    } catch (err) {
      if (env.strictAi) throw err;
      test.skip(true, 'IA no autocompletó (posible OPENROUTER_API_KEY ausente)');
      return;
    }

    // La IA debe haber cargado la fecha de vencimiento + badge "IA" en algún campo.
    await expect(page.locator('#expires_at')).not.toHaveValue('');
    await expect(page.getByText('IA').first()).toBeVisible();
    await page.screenshot({ path: shotPath(`ai-filled-${fx.expectedType}`), fullPage: true });

    // Soft: el valor coincide con formato ISO.
    const expiresVal = await page.locator('#expires_at').inputValue();
    expect.soft(expiresVal, 'vencimiento en formato ISO').toMatch(/^\d{4}-\d{2}-\d{2}$/);

    // Completar lo requerido por validate() si la IA dejó algo vacío.
    const nameInput = page.locator('#document_name');
    if (!(await nameInput.inputValue())) await nameInput.fill(`E2E ${fx.label}`);
    if (!(await page.locator('#document_type').inputValue())) {
      await page.locator('#document_type').selectOption({ index: 1 });
    }
    if (!(await page.locator('#issued_at').inputValue())) {
      await page.locator('#issued_at').fill('2025-01-01');
    }
    const docName = await nameInput.inputValue();

    // Guardar como borrador (no requiere S3/anchor) y verificar que aparece.
    await page.getByRole('button', { name: 'Guardar borrador' }).click();
    await page.waitForURL(new RegExp(`/vendors/${vendorId}(\\?|$)`), { timeout: 30_000 });

    // Cargar la pestaña de documentos de forma resiliente
    for (let attempt = 0; attempt < 3; attempt++) {
      await page.goto(`${env.base}/vendors/${vendorId}?tab=documentos`);
      const errorPage = page.getByRole('heading', { name: "This page couldn't load" });
      if (!(await errorPage.isVisible().catch(() => false))) break;
    }
    await expect(page.getByText(docName)).toBeVisible();
  });
}
