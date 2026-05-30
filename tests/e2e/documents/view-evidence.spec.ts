import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { gotoUntilHeading } from '../helpers';
import { env, ensureTestVendor, shotPath, STORAGE_STATE } from './support';
import { FIXTURES } from './fixtures-manifest';

const FX = FIXTURES[0]; // Póliza ART

test('sube evidencia, ancla y permite visualizar el PDF adjunto', async ({ page, playwright }) => {
  const api = await playwright.request.newContext({ storageState: STORAGE_STATE });
  const vendorId = await ensureTestVendor(api);

  // 1) Subir el PDF real a S3/MinIO.
  const up = await api.post(`${env.base}/api/upload`, {
    multipart: {
      vendorId,
      file: {
        name: path.basename(FX.file),
        mimeType: 'application/pdf',
        buffer: fs.readFileSync(FX.file),
      },
    },
  });
  if (up.status() === 503) {
    const msg = 'Almacenamiento S3 no configurado';
    if (env.strictStorage) expect(up.status(), msg).toBe(200);
    test.skip(true, msg);
    await api.dispose();
    return;
  }
  expect(up.ok(), `upload status ${up.status()}`).toBeTruthy();
  const { fileUrl, fileHash } = await up.json();
  expect(fileHash, 'hash SHA-256').toMatch(/^[0-9a-f]{64}$/);

  // 2) Crear el documento con la evidencia adjunta.
  const created = await api.post(`${env.base}/api/documents`, {
    data: {
      vendor_id: vendorId,
      document_type: FX.expectedType,
      document_name: 'Evidencia E2E — Póliza ART',
      issued_at: '2025-01-15',
      expires_at: FX.expectedExpires,
      criticality: 'critical',
      file_url: fileUrl,
      file_hash: fileHash,
      notes: 'Documento con evidencia para test de visualización',
    },
  });
  expect(created.ok(), `crear doc status ${created.status()}`).toBeTruthy();
  const { document } = await created.json();

  // 3) Anclar en Arkiv (expone la evidencia en la página pública /verify) con reintentos para soportar flakiness de la RPC testnet.
  let anchor: any;
  for (let attempt = 0; attempt < 3; attempt++) {
    anchor = await api.post(`${env.base}/api/documents/${document.id}/anchor`);
    if (anchor.ok()) break;
    await page.waitForTimeout(3000);
  }
  expect(anchor.ok(), `anchor status ${anchor.status()}`).toBeTruthy();

  // 4) /verify debe ofrecer "Ver evidencia".
  await gotoUntilHeading(
    page,
    `${env.base}/verify/${document.id}`,
    'Verificación Arkiv',
    30_000,
  );
  const evidenceLink = page.getByRole('link', { name: /Ver evidencia/i });
  await expect(evidenceLink).toBeVisible();
  await page.screenshot({ path: shotPath('verify-with-evidence'), fullPage: true });

  // 5) El archivo adjunto se sirve correctamente (200 + PDF + bytes).
  const href = await evidenceLink.getAttribute('href');
  expect(href, 'href de evidencia').toBeTruthy();
  const fileRes = await api.get(href!);
  expect(fileRes.ok(), `evidencia status ${fileRes.status()}`).toBeTruthy();
  expect(fileRes.headers()['content-type'], 'content-type PDF').toContain('application/pdf');
  const bytes = await fileRes.body();
  expect(bytes.length, 'bytes del PDF').toBeGreaterThan(1000);

  await api.dispose();
});
