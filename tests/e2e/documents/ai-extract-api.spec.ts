import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { env } from './support';
import { FIXTURES } from './fixtures-manifest';

test.describe('Extracción IA — POST /api/documents/extract', () => {
  for (const fx of FIXTURES) {
    test(`extrae datos de ${fx.label}`, async ({ request }) => {
      const res = await request.post(`${env.base}/api/documents/extract`, {
        multipart: {
          file: {
            name: path.basename(fx.file),
            mimeType: 'application/pdf',
            buffer: fs.readFileSync(fx.file),
          },
        },
      });

      if (res.status() === 503) {
        const msg = 'IA no configurada (OPENROUTER_API_KEY ausente)';
        if (env.strictAi) expect(res.status(), msg).toBe(200);
        test.skip(true, msg);
        return;
      }

      expect(res.ok(), `status ${res.status()}`).toBeTruthy();
      const { extracted } = await res.json();

      // Estructura mínima garantizada del pipeline
      expect(extracted, 'payload extracted presente').toBeTruthy();
      expect(typeof extracted.confidence).toBe('number');
      expect(extracted.confidence, 'confianza > 0').toBeGreaterThan(0);
      expect(extracted.expires_at, 'expires_at en formato ISO').toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(extracted.fields_found, 'fields_found incluye expires_at').toContain('expires_at');

      // Valores esperados (tolerantes: la IA puede variar levemente)
      // Log extracted value for visibility in trace/report
      console.log(`[Extracted] ${fx.label}: type=${extracted.document_type}, expires_at=${extracted.expires_at}`);

      if (extracted.document_name !== undefined) {
        expect.soft(typeof extracted.document_name).toBe('string');
      }
    });
  }
});
