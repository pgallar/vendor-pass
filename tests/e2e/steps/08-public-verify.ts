import { expect, type Page } from '@playwright/test';
import { env, type RunContext } from '../env';
import { shot, gotoUntilHeading } from '../helpers';

export async function publicVerify(page: Page, ctx: RunContext): Promise<void> {
  if (!ctx.documentId) throw new Error('publicVerify requiere ctx.documentId (corré antes create-document)');

  // Página pública de verificación (sin login).
  await gotoUntilHeading(
    page,
    `${env.base}/verify/${ctx.documentId}`,
    'Verificación Arkiv',
    30_000,
  );
  await expect(page.getByText('Póliza E2E')).toBeVisible();
  // Debe mostrar el hash SHA-256 del archivo de evidencia.
  await expect(page.getByText('Hash SHA-256 del archivo')).toBeVisible();
  await shot(page, '08-verify-document');

  // Pasaporte público del proveedor.
  if (ctx.vendorId) {
    await gotoUntilHeading(
      page,
      `${env.base}/verify/vendor/${ctx.vendorId}`,
      'Pasaporte del proveedor',
      30_000,
    );
    await shot(page, '08-verify-passport');
  }
}
