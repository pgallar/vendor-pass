import { test, type Page } from '@playwright/test';
import {
  env,
  STEP_ORDER,
  resolveStartIndex,
  resolveEndIndex,
  type RunContext,
  type StepKey,
} from './env';
import {
  ensureDirs,
  loadContext,
  saveContext,
  hasStorageState,
  storageStatePath,
  persistStorageState,
} from './helpers';

import { landing } from './steps/00-landing';
import { login } from './steps/01-login';
import { dashboard } from './steps/02-dashboard';
import { vendorsList } from './steps/03-vendors-list';
import { createVendor } from './steps/04-create-vendor';
import { vendorDetail } from './steps/05-vendor-detail';
import { createDocument } from './steps/06-create-document';
import { expirations } from './steps/07-expirations';
import { publicVerify } from './steps/08-public-verify';
import { integrations } from './steps/09-integrations';
import { docs } from './steps/10-docs';
import { settings } from './steps/11-settings';
import { logout } from './steps/12-logout';

type StepFn = (page: Page, ctx: RunContext) => Promise<void>;

const STEPS: Record<StepKey, StepFn> = {
  landing,
  login,
  dashboard,
  'vendors-list': vendorsList,
  'create-vendor': createVendor,
  'vendor-detail': vendorDetail,
  'create-document': createDocument,
  expirations,
  'public-verify': publicVerify,
  integrations,
  docs,
  settings,
  logout,
};

test('Recorrido integral de VendorPass', async ({ browser }) => {
  ensureDirs();
  const startIndex = resolveStartIndex();
  const endIndex = resolveEndIndex();
  const resuming = startIndex > STEP_ORDER.indexOf('login');

  // Al reanudar después del login, recuperamos la sesión persistida.
  const context = await browser.newContext(
    resuming && hasStorageState() ? { storageState: storageStatePath } : undefined,
  );
  const page = await context.newPage();

  // Recuperamos el contexto previo (vendorId, documentId, …) si estamos reanudando.
  const ctx: RunContext = resuming ? loadContext() : {};

  test.info().annotations.push(
    { type: 'entorno', description: `${env.name} (${env.base})` },
    { type: 'desde-paso', description: `${STEP_ORDER[startIndex]} (#${startIndex})` },
  );

  try {
    for (let i = startIndex; i < endIndex; i++) {
      const key = STEP_ORDER[i];
      await test.step(`#${i} ${key}`, async () => {
        await STEPS[key](page, ctx);
        // Persistimos sesión y contexto tras cada paso para permitir reanudar.
        await persistStorageState(context);
        saveContext(ctx);
      });
    }
  } finally {
    await context.close();
  }
});
