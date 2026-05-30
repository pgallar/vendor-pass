import path from 'node:path';
import { getE2eBaseUrl, resolveE2eEnvName } from './config';

export type StepKey =
  | 'landing'
  | 'login'
  | 'dashboard'
  | 'vendors-list'
  | 'create-vendor'
  | 'vendor-detail'
  | 'create-document'
  | 'expirations'
  | 'public-verify'
  | 'integrations'
  | 'docs'
  | 'settings'
  | 'logout';

/** Orden canónico del recorrido integral. El índice define la reanudación. */
export const STEP_ORDER: StepKey[] = [
  'landing',
  'login',
  'dashboard',
  'vendors-list',
  'create-vendor',
  'vendor-detail',
  'create-document',
  'expirations',
  'public-verify',
  'integrations',
  'docs',
  'settings',
  'logout',
];

const ENV = resolveE2eEnvName();

export const env = {
  name: ENV,
  base: getE2eBaseUrl(ENV),
  loginPath: '/login',
  dashboardPath: '/dashboard',
  email: process.env.E2E_EMAIL ?? 'demo@moraiarkae.resend.app',
  password: process.env.E2E_PASSWORD ?? '!DemoDemo',
  /** Paso desde el cual (re)comenzar. Acepta clave (p.ej. "create-document") o índice numérico. */
  startStep: process.env.E2E_START_STEP ?? STEP_ORDER[0],
  /** Paso inclusive hasta el cual ejecutar (útil para generar artefactos sin logout). */
  endStep: process.env.E2E_END_STEP,
  artifactsDir: path.resolve(process.cwd(), 'tests/e2e/.artifacts'),
};

/** Convierte E2E_END_STEP (clave o índice) en índice exclusivo superior de STEP_ORDER. */
export function resolveEndIndex(): number {
  const raw = env.endStep?.trim();
  if (!raw) return STEP_ORDER.length;
  const asNum = Number(raw);
  if (!Number.isNaN(asNum) && raw !== '') {
    return Math.min(Math.max(1, Math.trunc(asNum) + 1), STEP_ORDER.length);
  }
  const idx = STEP_ORDER.indexOf(raw as StepKey);
  if (idx === -1) {
    throw new Error(
      `E2E_END_STEP inválido: "${raw}". Usá un índice 0..${STEP_ORDER.length - 1} o una clave: ${STEP_ORDER.join(', ')}`,
    );
  }
  return idx + 1;
}

/** Convierte E2E_START_STEP (clave o índice) en índice válido de STEP_ORDER. */
export function resolveStartIndex(): number {
  const raw = env.startStep.trim();
  const asNum = Number(raw);
  if (!Number.isNaN(asNum) && raw !== '') {
    return Math.min(Math.max(0, Math.trunc(asNum)), STEP_ORDER.length - 1);
  }
  const idx = STEP_ORDER.indexOf(raw as StepKey);
  if (idx === -1) {
    throw new Error(
      `E2E_START_STEP inválido: "${raw}". Usá un índice 0..${STEP_ORDER.length - 1} o una clave: ${STEP_ORDER.join(', ')}`,
    );
  }
  return idx;
}

/** Contexto que viaja entre pasos y se persiste a disco para reanudar. */
export interface RunContext {
  vendorId?: string;
  vendorName?: string;
  documentId?: string;
}
