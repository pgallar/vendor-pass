import path from 'node:path';
import { expect, type Page } from '@playwright/test';
import { env, type RunContext } from '../env';
import { shot } from '../helpers';

const FIXTURE = path.resolve(process.cwd(), 'tests/e2e/fixtures/evidence.pdf');

function isoPlusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

async function uploadFixture(page: Page): Promise<void> {
  const uploadResponse = page.waitForResponse(
    (res) => res.url().includes('/api/upload') && res.request().method() === 'POST',
    { timeout: 45_000 },
  );
  await page.locator('#file').setInputFiles(FIXTURE);
  const res = await uploadResponse;
  if (!res.ok()) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    const hint =
      env.name === 'prod'
        ? 'Verificá S3_ENDPOINT y credenciales en Vercel.'
        : 'En local verificá que MinIO esté arriba (`docker compose up`) y S3_ENDPOINT apunte a MinIO.';
    throw new Error(
      `Upload de evidencia falló (${res.status()}) en ${env.base}: ${body.error ?? res.statusText()}. ${hint}`,
    );
  }
  await expect(page.locator('code.font-mono')).toBeVisible({ timeout: 15_000 });
}

export async function createDocument(page: Page, ctx: RunContext): Promise<void> {
  if (!ctx.vendorId) throw new Error('createDocument requiere ctx.vendorId (corré antes create-vendor)');

  await page.goto(`${env.base}/vendors/${ctx.vendorId}/documents/new`);
  await expect(page.getByRole('heading', { name: 'Agregar documento' })).toBeVisible();

  // Tipo de documento: el índice 0 del <select> es el placeholder; elegimos el primero real.
  await page.locator('#document_type').selectOption({ index: 1 });
  await page.locator('#document_name').fill('Póliza E2E');
  await page.locator('#issued_at').fill(isoPlusDays(-1));
  await page.locator('#expires_at').fill(isoPlusDays(15)); // "por vencer" dentro de 30 días

  page.on('dialog', (dialog) => dialog.accept());
  await uploadFixture(page);
  await shot(page, '06-document-form');

  // CTA primario: guardar y anclar en Arkiv (requiere file_hash, ya presente).
  await page.getByRole('button', { name: 'Guardar y anclar en Arkiv' }).click();

  // Vuelve al detalle del proveedor.
  await page.waitForURL(new RegExp(`/vendors/${ctx.vendorId}(\\?|$)`), { timeout: 60_000 });

  // Abrimos la tab Documentos y verificamos que el documento figura.
  await page.goto(`${env.base}/vendors/${ctx.vendorId}?tab=documentos`);
  await expect(page.getByText('Póliza E2E')).toBeVisible();

  const docRow = page.getByRole('listitem').filter({ hasText: 'Póliza E2E' });
  const verifyLink = docRow.getByRole('link', { name: /Verificar/i });

  // Si el anclaje en el formulario falló, anclamos desde la fila del documento.
  if (!(await verifyLink.isVisible().catch(() => false))) {
    await docRow.getByRole('button', { name: 'Anclar' }).click();
    await expect(verifyLink).toBeVisible({ timeout: 60_000 });
  }

  // El documento anclado expone un link /verify/{uuid}; capturamos el documentId.
  await expect(verifyLink).toBeVisible({ timeout: 30_000 });
  const href = await verifyLink.getAttribute('href');
  ctx.documentId = (href ?? '').replace('/verify/', '').split(/[?#]/)[0];
  expect(ctx.documentId, 'documentId capturado del link Verificar').toMatch(
    /^[0-9a-fA-F-]{36}$/,
  );

  await shot(page, '06-document-anchored');
}
