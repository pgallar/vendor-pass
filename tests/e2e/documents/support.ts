import fs from 'node:fs';
import path from 'node:path';
import { expect, type APIRequestContext } from '@playwright/test';
import { getE2eBaseUrl, resolveE2eEnvName } from '../config';

/** Ruta del estado de sesión persistido por auth.setup.ts y reutilizado por los specs. */
export const STORAGE_STATE = path.resolve(process.cwd(), 'tests/e2e/.auth/storageState.json');

const ENV = resolveE2eEnvName();

export const env = {
  name: ENV,
  base: getE2eBaseUrl(ENV),
  email: process.env.E2E_EMAIL ?? 'demo@moraiarkae.resend.app',
  password: process.env.E2E_PASSWORD ?? '!DemoDemo',
  /** Si '1', falla (en vez de saltar) cuando la IA no está configurada. */
  strictAi: process.env.E2E_REQUIRE_AI === '1',
  /** Si '1', falla (en vez de saltar) cuando S3 no está configurado. */
  strictStorage: process.env.E2E_REQUIRE_STORAGE === '1',
};

const SHOTS_DIR = path.resolve(process.cwd(), 'tests/e2e/.artifacts/documents');

/** Devuelve la ruta de una screenshot, creando el directorio si hace falta. */
export function shotPath(name: string): string {
  fs.mkdirSync(SHOTS_DIR, { recursive: true });
  return path.join(SHOTS_DIR, `${name}.png`);
}

/** Crea un proveedor de prueba (del usuario logueado) y devuelve su id. */
export async function ensureTestVendor(request: APIRequestContext): Promise<string> {
  const name = `E2E-AI-${Date.now()}`;
  const res = await request.post(`${env.base}/api/vendors`, {
    data: {
      name,
      category: 'E2E IA',
      area: 'Test',
      owner_name: 'QA Bot',
      owner_email: 'qa.bot@example.com',
      notes: 'Proveedor para tests de importación + IA',
    },
  });
  expect(res.ok(), `crear vendor de prueba (status ${res.status()})`).toBeTruthy();
  const { vendor } = await res.json();
  return vendor.id as string;
}
