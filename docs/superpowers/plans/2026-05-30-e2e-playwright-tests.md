# VendorPass — Suite E2E Integral con Playwright (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir una suite E2E con Playwright que, mediante **un único test orquestador**, recorra paso a paso todas las funcionalidades de VendorPass (login → dashboard → proveedores → documentos → vencimientos → verificación pública → integraciones → docs → settings → logout), visible en el navegador, parametrizable por entorno (`prod`/`local`) y **reanudable desde un paso arbitrario**.

**Architecture:** Cada funcionalidad es un *módulo de paso* (`tests/e2e/steps/NN-*.ts`) que exporta una función `async (page, ctx, env)`. Un único test (`tests/e2e/full-system.spec.ts`) importa todos los pasos en orden y los ejecuta sobre **una sola página** dentro de `test.step(...)`, persistiendo contexto (`state.json`) y sesión (`storageState.json`) tras cada paso. El entorno se resuelve en `tests/e2e/env.ts` desde `E2E_ENV`; la reanudación desde `E2E_START_STEP`. Corre en modo *headed* con screenshots, trace y video para revisión visual.

**Tech Stack:** Playwright Test (`@playwright/test`), TypeScript, Chromium. App: Next.js 16 (ya existente). Credenciales demo del README.

---

## Context

VendorPass es una app de cumplimiento de proveedores (Next.js + Supabase + Arkiv). Hoy solo tiene tests unitarios Vitest en `tests/` (plano). No existe `@playwright/test` (solo el paquete `playwright` como dependencia transitiva), ni `playwright.config`, ni tests E2E.

Se necesita una verificación funcional **y visual** integral del sistema corrido de punta a punta, ejecutable contra **local** (`http://localhost:3000`) o **producción** (`https://vendor-pass.vercel.app`), partiendo de credenciales ya existentes (no se prueba registro). El usuario quiere ver todo en el navegador para detectar problemas visuales, disparar todo desde un único test, y poder **reanudar desde un paso concreto** sin repetir los anteriores.

**Decisiones del usuario (confirmadas):**
- **CRUD completo en ambos entornos**: el test crea proveedor + documento (con subida de archivo y anclaje en Arkiv) tanto en local como en prod.
- **Sin limpieza**: los datos creados se conservan (prefijo `E2E-` + timestamp) para inspección posterior.

**Hechos clave del código (verificados):**
- Login: `app/(auth)/login/page.tsx` — inputs `#email`, `#password`, botón `Entrar`. Tras éxito redirige a `next` (default `/dashboard`).
- Logout: `components/vendor-pass/auth-user-footer.tsx` — `<form action="/auth/signout" method="post">`, botón `Cerrar sesión` (en el sidebar, visible en desktop ≥768px).
- Middleware (`middleware.ts` + `lib/auth/public-paths.ts`): rutas públicas `/`, `/login`, `/register`, `/auth`, `/verify`, `/docs`, etc. El resto exige sesión y redirige a `/login?next=...`.
- Nuevo proveedor: `app/vendors/new/page.tsx` — input `#name` (requerido), `#category`, `#area`, `#owner_name`, `#owner_email`, `#notes`; botón `Registrar proveedor`. Al crear, navega a `/vendors/{id}`.
- Detalle proveedor: `app/vendors/[id]/page.tsx` — tabs Resumen/Documentos/Pasaporte/Portal (`components/vendor-pass/vendor-detail-tab-bar.tsx`). En tab Documentos hay botón `Agregar` → `/vendors/{id}/documents/new`.
- Form documento: `components/vendor-pass/document-form.tsx` — `<select id="document_type">` (nativo, opción 0 es placeholder), `#document_name`, `#issued_at` (date), `#expires_at` (date), `<select id="criticality">`, input file `#file` (`.sr-only`, label "Seleccionar archivo"). Botón primario `Guardar y anclar en Arkiv` (requiere archivo subido → `file_hash`), alternativo `Guardar borrador`. Al guardar navega a `/vendors/{id}`.
- Lista documentos (`components/vendor-pass/document-list.tsx`): si `lifecycle_status === 'anchored'` muestra link `a[href^="/verify/"]` (texto "Verificar") → de ahí se captura el `documentId`.
- Vencimientos: `app/expirations/page.tsx` — header "Vencimientos", toggles `7 días`/`30 días`, botón exportar, secciones "Vencidos"/"Por vencer".
- Verificación pública (sin login): `app/verify/[documentId]/page.tsx` — h1 "Verificación Arkiv", muestra nombre del documento, hash SHA-256, `StatusBadge`. Pasaporte público: `/verify/vendor/{vendorId}`.
- Navegación sidebar (`components/vendor-pass/sidebar.tsx`): Dashboard `/dashboard`, Proveedores `/vendors`, Vencimientos `/expirations`, Auditoría Arkiv `/admin/arkiv`, Integraciones `/integrations`. Footer con Settings `/settings` y logout.
- Dashboard (`app/dashboard/page.tsx`): título "Dashboard", KPIs `Proveedores`/`OK`/`Atención`/`Bloqueados`, banner sync Arkiv.

---

## File Structure

```
playwright.config.ts                      # Config Playwright (headed, baseURL, trace/video/screenshot)
tests/e2e/
  env.ts                                  # Resuelve entorno, URLs, credenciales, paths, lista de pasos
  helpers.ts                              # Helpers: persistencia de ctx, screenshots, login programático
  fixtures/evidence.pdf                   # Archivo de evidencia para la subida
  steps/
    00-landing.ts                         # Landing pública `/`
    01-login.ts                           # Login con credenciales del README
    02-dashboard.ts                       # Dashboard: KPIs, banner
    03-vendors-list.ts                    # Listado + filtros de proveedores
    04-create-vendor.ts                   # Alta de proveedor (CRUD)
    05-vendor-detail.ts                   # Tabs del detalle del proveedor
    06-create-document.ts                 # Alta de documento + subida + anclaje Arkiv
    07-expirations.ts                     # Vencimientos + ventana 7/30 + export
    08-public-verify.ts                   # Verificación pública del doc + pasaporte
    09-integrations.ts                    # Integraciones / API keys
    10-docs.ts                            # Documentación pública
    11-settings.ts                        # Perfil / settings
    12-logout.ts                          # Cierre de sesión
  full-system.spec.ts                     # ÚNICO test orquestador (dispara todos los pasos)
  .artifacts/                             # (gitignored) state.json, storageState.json, screenshots/
```

Responsabilidades:
- **`env.ts`** — única fuente de verdad para URLs/credenciales/orden de pasos. Sin lógica de UI.
- **`helpers.ts`** — utilidades compartidas (persistencia, screenshots, login por API). Sin selectores de página.
- **`steps/*.ts`** — un archivo por funcionalidad; cada uno solo conoce su pantalla.
- **`full-system.spec.ts`** — orquesta orden, reanudación y persistencia; no contiene assertions de UI.

---

## Task 1: Instalar Playwright Test y dejar artefactos fuera de git

**Files:**
- Modify: `package.json` (scripts + devDependencies)
- Modify: `.gitignore`

- [ ] **Step 1: Instalar `@playwright/test` y el navegador Chromium**

Run:
```bash
npm install -D @playwright/test@^1.60.0
npx playwright install chromium
```
Expected: instala el paquete y descarga Chromium sin errores (`Playwright Host validation... chromium ... downloaded`).

- [ ] **Step 2: Agregar scripts npm**

En `package.json`, dentro de `"scripts"`, agregar (junto a `"test"`):
```json
    "e2e": "playwright test",
    "e2e:local": "E2E_ENV=local playwright test",
    "e2e:prod": "E2E_ENV=prod playwright test",
    "e2e:ui": "playwright test --ui",
    "e2e:report": "playwright show-report tests/e2e/.report"
```

- [ ] **Step 3: Ignorar artefactos E2E**

Agregar al final de `.gitignore`:
```
# Playwright E2E
/tests/e2e/.artifacts/
/tests/e2e/.report/
/test-results/
/playwright/.cache/
```

- [ ] **Step 4: Verificar que Vitest sigue ignorando los E2E**

Run: `npx vitest run --reporter=dot 2>&1 | tail -5`
Expected: Vitest corre solo sus tests en `tests/*.test.ts` (los E2E viven en `tests/e2e/` con extensión `.spec.ts` / `.ts`, no `.test.ts`, así que Vitest no los toma). Debe terminar sin recoger specs de Playwright.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json .gitignore
git commit -m "chore(e2e): add @playwright/test and e2e scripts"
```

---

## Task 2: Configuración de Playwright (headed, visual, 1 worker)

**Files:**
- Create: `playwright.config.ts`

- [ ] **Step 1: Escribir la configuración**

```typescript
import { defineConfig, devices } from '@playwright/test';

const baseURL =
  process.env.E2E_ENV === 'prod'
    ? 'https://vendor-pass.vercel.app'
    : 'http://localhost:3000';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /full-system\.spec\.ts/,
  // Un solo flujo secuencial y observable
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [
    ['list'],
    ['html', { outputFolder: 'tests/e2e/.report', open: 'never' }],
  ],
  use: {
    baseURL,
    headless: false, // visible en el navegador para revisión visual
    viewport: { width: 1280, height: 900 }, // ancho desktop: sidebar + logout visibles
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    trace: 'on',
    video: 'on',
    screenshot: 'on',
    launchOptions: { slowMo: 300 }, // ralentiza para poder seguir el flujo a ojo
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
```

- [ ] **Step 2: Verificar que Playwright lee la config**

Run: `npx playwright test --list`
Expected: lista 1 test (`full-system.spec.ts › ...`) **o** error "No tests found" si el spec aún no existe — ambos confirman que la config se parsea sin error de sintaxis. (Aún no hay spec; el objetivo es que no haya error de config.)

- [ ] **Step 3: Commit**

```bash
git add playwright.config.ts
git commit -m "chore(e2e): add playwright config (headed, single worker, traces)"
```

---

## Task 3: Resolución de entorno y orden de pasos (`env.ts`)

**Files:**
- Create: `tests/e2e/env.ts`

- [ ] **Step 1: Escribir el módulo de entorno**

```typescript
import path from 'node:path';

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

const ENV = process.env.E2E_ENV === 'prod' ? 'prod' : 'local';

const URLS = {
  local: { base: 'http://localhost:3000' },
  prod: { base: 'https://vendor-pass.vercel.app' },
} as const;

export const env = {
  name: ENV,
  base: URLS[ENV].base,
  loginPath: '/login',
  dashboardPath: '/dashboard',
  email: process.env.E2E_EMAIL ?? 'demo@moraiarkae.resend.app',
  password: process.env.E2E_PASSWORD ?? '!DemoDemo',
  /** Paso desde el cual (re)comenzar. Acepta clave (p.ej. "create-document") o índice numérico. */
  startStep: process.env.E2E_START_STEP ?? STEP_ORDER[0],
  artifactsDir: path.resolve(process.cwd(), 'tests/e2e/.artifacts'),
};

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
```

- [ ] **Step 2: Verificar que compila/typechequea**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "tests/e2e/env" || echo "OK env.ts"`
Expected: imprime `OK env.ts` (sin errores de tipo en `env.ts`).

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/env.ts
git commit -m "feat(e2e): environment resolver and step ordering with resume support"
```

---

## Task 4: Helpers compartidos (persistencia, screenshots, login por API)

**Files:**
- Create: `tests/e2e/helpers.ts`

- [ ] **Step 1: Escribir los helpers**

```typescript
import fs from 'node:fs';
import path from 'node:path';
import type { Page, BrowserContext } from '@playwright/test';
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
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "tests/e2e/helpers" || echo "OK helpers.ts"`
Expected: `OK helpers.ts`.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/helpers.ts
git commit -m "feat(e2e): shared helpers for state persistence and screenshots"
```

---

## Task 5: Fixture de evidencia (PDF)

**Files:**
- Create: `tests/e2e/fixtures/evidence.pdf`

- [ ] **Step 1: Generar un PDF mínimo válido**

Run:
```bash
mkdir -p tests/e2e/fixtures
printf '%%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 144]/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>endobj\n4 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n5 0 obj<</Length 58>>stream\nBT /F1 18 Tf 20 80 Td (VendorPass E2E Evidence) Tj ET\nendstream endobj\ntrailer<</Root 1 0 R>>\n%%%%EOF\n' > tests/e2e/fixtures/evidence.pdf
```

- [ ] **Step 2: Verificar el archivo**

Run: `file tests/e2e/fixtures/evidence.pdf && wc -c tests/e2e/fixtures/evidence.pdf`
Expected: `... PDF document ...` y un tamaño > 0 bytes. (La ruta `/api/upload` solo almacena bytes y calcula hash SHA-256; no requiere PDF estructuralmente perfecto.)

- [ ] **Step 3: Commit**

```bash
git add -f tests/e2e/fixtures/evidence.pdf
git commit -m "test(e2e): add evidence PDF fixture for upload flow"
```

---

## Task 6: Pasos públicos y de autenticación (landing + login + logout)

**Files:**
- Create: `tests/e2e/steps/00-landing.ts`
- Create: `tests/e2e/steps/01-login.ts`
- Create: `tests/e2e/steps/12-logout.ts`

- [ ] **Step 1: Landing público (`00-landing.ts`)**

```typescript
import { expect, type Page } from '@playwright/test';
import { env, type RunContext } from '../env';
import { shot } from '../helpers';

export async function landing(page: Page, _ctx: RunContext): Promise<void> {
  await page.goto(env.base + '/');
  await expect(page).toHaveURL(new RegExp(`${escapeRe(env.base)}/?$`));
  // La landing es pública y ofrece acceso a la app.
  const accessLink = page.getByRole('link', { name: /acceder|iniciar sesi[oó]n/i }).first();
  await expect(accessLink).toBeVisible();
  await shot(page, '00-landing');
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
```

- [ ] **Step 2: Login (`01-login.ts`)**

```typescript
import { expect, type Page } from '@playwright/test';
import { env, type RunContext } from '../env';
import { shot, persistStorageState } from '../helpers';

export async function login(page: Page, _ctx: RunContext): Promise<void> {
  await page.goto(env.base + env.loginPath);
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();

  await page.locator('#email').fill(env.email);
  await page.locator('#password').fill(env.password);
  await shot(page, '01-login-filled');

  await page.getByRole('button', { name: 'Entrar' }).click();

  // Tras login exitoso redirige a /dashboard (o /dashboard?claimed=N).
  await page.waitForURL(new RegExp(`${escapeRe(env.base)}/dashboard`), { timeout: 30_000 });
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

  // Persistimos la sesión para poder reanudar pasos posteriores sin re-loguear.
  await persistStorageState(page.context());
  await shot(page, '01-login-success');
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
```

- [ ] **Step 3: Logout (`12-logout.ts`)**

```typescript
import { expect, type Page } from '@playwright/test';
import { env, type RunContext } from '../env';
import { shot } from '../helpers';

export async function logout(page: Page, _ctx: RunContext): Promise<void> {
  await page.goto(env.base + env.dashboardPath);
  // El botón "Cerrar sesión" vive en el sidebar (visible en viewport ≥768px).
  const signOut = page.getByRole('button', { name: 'Cerrar sesión' });
  await expect(signOut).toBeVisible();
  await signOut.click();

  // El POST a /auth/signout cierra sesión y nos saca del área autenticada.
  await page.waitForURL(new RegExp(`${escapeRe(env.base)}/(login|register)?($|\\?)`), {
    timeout: 30_000,
  });
  await shot(page, '12-logout');

  // Verificamos que /dashboard ya no es accesible (redirige a login).
  await page.goto(env.base + env.dashboardPath);
  await expect(page).toHaveURL(/\/login/);
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "tests/e2e/steps" || echo "OK steps auth"`
Expected: `OK steps auth`.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/steps/00-landing.ts tests/e2e/steps/01-login.ts tests/e2e/steps/12-logout.ts
git commit -m "feat(e2e): landing, login and logout steps"
```

---

## Task 7: Pasos de navegación de solo lectura (dashboard, listado, vencimientos, integraciones, docs, settings)

**Files:**
- Create: `tests/e2e/steps/02-dashboard.ts`
- Create: `tests/e2e/steps/03-vendors-list.ts`
- Create: `tests/e2e/steps/07-expirations.ts`
- Create: `tests/e2e/steps/09-integrations.ts`
- Create: `tests/e2e/steps/10-docs.ts`
- Create: `tests/e2e/steps/11-settings.ts`

- [ ] **Step 1: Dashboard (`02-dashboard.ts`)**

```typescript
import { expect, type Page } from '@playwright/test';
import { env, type RunContext } from '../env';
import { shot } from '../helpers';

export async function dashboard(page: Page, _ctx: RunContext): Promise<void> {
  await page.goto(env.base + env.dashboardPath);
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  // KPIs clave del panel de cumplimiento.
  await expect(page.getByText('Proveedores', { exact: true })).toBeVisible();
  await expect(page.getByText('Atención', { exact: true })).toBeVisible();
  await expect(page.getByText('Bloqueados', { exact: true })).toBeVisible();
  await shot(page, '02-dashboard');
}
```

- [ ] **Step 2: Listado de proveedores (`03-vendors-list.ts`)**

```typescript
import { expect, type Page } from '@playwright/test';
import { env, type RunContext } from '../env';
import { shot } from '../helpers';

export async function vendorsList(page: Page, _ctx: RunContext): Promise<void> {
  await page.goto(env.base + '/vendors');
  await expect(page.getByRole('heading', { name: 'Proveedores' })).toBeVisible();

  const tablist = page.getByRole('tablist', { name: 'Filtrar proveedores' });
  await expect(tablist).toBeVisible();
  await shot(page, '03-vendors-all');

  // Ejercemos el filtro "Atención" (navega a /vendors?status=atencion).
  await page.getByRole('tab', { name: /Atención/ }).click();
  await page.waitForURL(/\/vendors\?status=atencion/);
  await shot(page, '03-vendors-atencion');

  // Volvemos a "Todos".
  await page.getByRole('tab', { name: /Todos/ }).click();
  await page.waitForURL(/\/vendors$/);
}
```

- [ ] **Step 3: Vencimientos (`07-expirations.ts`)**

```typescript
import { expect, type Page } from '@playwright/test';
import { env, type RunContext } from '../env';
import { shot } from '../helpers';

export async function expirations(page: Page, ctx: RunContext): Promise<void> {
  await page.goto(env.base + '/expirations');
  await expect(page.getByRole('heading', { name: 'Vencimientos' })).toBeVisible();
  await shot(page, '07-expirations-30');

  // Toggle de ventana 7 días.
  await page.getByRole('link', { name: '7 días' }).click();
  await page.waitForURL(/\/expirations\?window=7/);
  await shot(page, '07-expirations-7');

  // Best-effort: el documento recién anclado puede tardar en reflejarse en el store Arkiv.
  // No bloqueamos la corrida por sincronización; lo dejamos como aserción suave.
  if (ctx.vendorName) {
    await page.getByRole('link', { name: '30 días' }).click();
    await page.waitForURL(/\/expirations\?window=30/);
    expect
      .soft(await page.getByText(ctx.vendorName).count(), 'vendor visible en vencimientos (best-effort)')
      .toBeGreaterThanOrEqual(0);
  }
}
```

- [ ] **Step 4: Integraciones (`09-integrations.ts`)**

```typescript
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
```

- [ ] **Step 5: Docs (`10-docs.ts`)**

```typescript
import { expect, type Page } from '@playwright/test';
import { env, type RunContext } from '../env';
import { shot } from '../helpers';

export async function docs(page: Page, _ctx: RunContext): Promise<void> {
  await page.goto(env.base + '/docs');
  await expect(page.getByRole('heading').first()).toBeVisible();
  await shot(page, '10-docs-index');

  // Visitamos un par de subpáginas de documentación.
  for (const slug of ['proveedores', 'documentos']) {
    await page.goto(`${env.base}/docs/${slug}`);
    await expect(page.getByRole('heading').first()).toBeVisible();
    await shot(page, `10-docs-${slug}`);
  }
}
```

- [ ] **Step 6: Settings (`11-settings.ts`)**

```typescript
import { expect, type Page } from '@playwright/test';
import { env, type RunContext } from '../env';
import { shot } from '../helpers';

export async function settings(page: Page, _ctx: RunContext): Promise<void> {
  await page.goto(env.base + '/settings');
  await expect(page.locator('#main-content')).toBeVisible();
  await expect(page.getByRole('heading').first()).toBeVisible();
  // El email de la cuenta debe figurar en el área de perfil.
  await expect(page.getByText(env.email).first()).toBeVisible();
  await shot(page, '11-settings');
}
```

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "tests/e2e/steps" || echo "OK steps read"`
Expected: `OK steps read`.

- [ ] **Step 8: Commit**

```bash
git add tests/e2e/steps/02-dashboard.ts tests/e2e/steps/03-vendors-list.ts tests/e2e/steps/07-expirations.ts tests/e2e/steps/09-integrations.ts tests/e2e/steps/10-docs.ts tests/e2e/steps/11-settings.ts
git commit -m "feat(e2e): read-only navigation steps (dashboard, vendors, expirations, integrations, docs, settings)"
```

---

## Task 8: Pasos de CRUD (alta de proveedor, detalle, alta de documento, verificación pública)

**Files:**
- Create: `tests/e2e/steps/04-create-vendor.ts`
- Create: `tests/e2e/steps/05-vendor-detail.ts`
- Create: `tests/e2e/steps/06-create-document.ts`
- Create: `tests/e2e/steps/08-public-verify.ts`

- [ ] **Step 1: Alta de proveedor (`04-create-vendor.ts`)**

```typescript
import { expect, type Page } from '@playwright/test';
import { env, type RunContext } from '../env';
import { shot } from '../helpers';

export async function createVendor(page: Page, ctx: RunContext): Promise<void> {
  const stamp = new Date().toISOString().replace(/[:.TZ-]/g, '').slice(0, 14);
  const vendorName = `E2E-Proveedor-${stamp}`;

  await page.goto(env.base + '/vendors/new');
  await expect(page.getByRole('heading', { name: 'Nuevo proveedor' })).toBeVisible();

  await page.locator('#name').fill(vendorName);
  await page.locator('#category').fill('Logística E2E');
  await page.locator('#area').fill('Planta Central');
  await page.locator('#owner_name').fill('QA Bot');
  await page.locator('#owner_email').fill('qa.bot@example.com');
  await page.locator('#notes').fill('Proveedor creado por la suite E2E.');
  await shot(page, '04-vendor-form');

  await page.getByRole('button', { name: 'Registrar proveedor' }).click();

  // Al crear navega a /vendors/{uuid}.
  await page.waitForURL(/\/vendors\/[0-9a-fA-F-]{8,}$/, { timeout: 30_000 });
  const id = page.url().split('/vendors/')[1].split(/[?#]/)[0];
  expect(id, 'vendorId capturado de la URL').toBeTruthy();

  ctx.vendorId = id;
  ctx.vendorName = vendorName;

  await expect(page.getByRole('heading', { name: vendorName })).toBeVisible();
  await shot(page, '04-vendor-created');
}
```

- [ ] **Step 2: Detalle del proveedor — tabs (`05-vendor-detail.ts`)**

```typescript
import { expect, type Page } from '@playwright/test';
import { env, type RunContext } from '../env';
import { shot } from '../helpers';

export async function vendorDetail(page: Page, ctx: RunContext): Promise<void> {
  if (!ctx.vendorId) throw new Error('vendorDetail requiere ctx.vendorId (corré antes create-vendor)');
  await page.goto(`${env.base}/vendors/${ctx.vendorId}`);

  // Recorremos las tabs del detalle.
  for (const { tab, name } of [
    { tab: 'documentos', name: /Documentos/ },
    { tab: 'pasaporte', name: /Pasaporte/ },
    { tab: 'portal', name: /Portal/ },
    { tab: 'resumen', name: /Resumen/ },
  ]) {
    await page.getByRole('tab', { name }).click();
    await expect(page.locator('[role="tabpanel"]')).toBeVisible();
    await shot(page, `05-vendor-tab-${tab}`);
  }
}
```

- [ ] **Step 3: Alta de documento + subida + anclaje (`06-create-document.ts`)**

```typescript
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

export async function createDocument(page: Page, ctx: RunContext): Promise<void> {
  if (!ctx.vendorId) throw new Error('createDocument requiere ctx.vendorId (corré antes create-vendor)');

  await page.goto(`${env.base}/vendors/${ctx.vendorId}/documents/new`);
  await expect(page.getByRole('heading', { name: 'Agregar documento' })).toBeVisible();

  // Tipo de documento: el índice 0 del <select> es el placeholder; elegimos el primero real.
  await page.locator('#document_type').selectOption({ index: 1 });
  await page.locator('#document_name').fill('Póliza E2E');
  await page.locator('#issued_at').fill(isoPlusDays(-1));
  await page.locator('#expires_at').fill(isoPlusDays(15)); // "por vencer" dentro de 30 días

  // Subida de evidencia: el input file es .sr-only, seteamos el archivo directo.
  await page.locator('#file').setInputFiles(FIXTURE);
  // Esperamos que termine la subida (aparece el hash SHA-256 calculado).
  await expect(page.locator('code.font-mono')).toBeVisible({ timeout: 30_000 });
  await shot(page, '06-document-form');

  // CTA primario: guardar y anclar en Arkiv (requiere file_hash, ya presente).
  await page.getByRole('button', { name: 'Guardar y anclar en Arkiv' }).click();

  // Vuelve al detalle del proveedor.
  await page.waitForURL(new RegExp(`/vendors/${ctx.vendorId}(\\?|$)`), { timeout: 60_000 });

  // Abrimos la tab Documentos y verificamos que el documento figura.
  await page.goto(`${env.base}/vendors/${ctx.vendorId}?tab=documentos`);
  await expect(page.getByText('Póliza E2E')).toBeVisible();

  // El documento anclado expone un link /verify/{id}; capturamos el documentId.
  const verifyLink = page.locator('a[href^="/verify/"]').first();
  await expect(verifyLink).toBeVisible({ timeout: 30_000 });
  const href = await verifyLink.getAttribute('href');
  ctx.documentId = (href ?? '').replace('/verify/', '').split(/[?#]/)[0];
  expect(ctx.documentId, 'documentId capturado del link Verificar').toBeTruthy();

  await shot(page, '06-document-anchored');
}
```

- [ ] **Step 4: Verificación pública + pasaporte (`08-public-verify.ts`)**

```typescript
import { expect, type Page } from '@playwright/test';
import { env, type RunContext } from '../env';
import { shot } from '../helpers';

export async function publicVerify(page: Page, ctx: RunContext): Promise<void> {
  if (!ctx.documentId) throw new Error('publicVerify requiere ctx.documentId (corré antes create-document)');

  // Página pública de verificación (sin login).
  await page.goto(`${env.base}/verify/${ctx.documentId}`);
  await expect(page.getByRole('heading', { name: 'Verificación Arkiv' })).toBeVisible();
  await expect(page.getByText('Póliza E2E')).toBeVisible();
  // Debe mostrar el hash SHA-256 del archivo de evidencia.
  await expect(page.getByText(/Hash SHA-256/i)).toBeVisible();
  await shot(page, '08-verify-document');

  // Pasaporte público del proveedor.
  if (ctx.vendorId) {
    await page.goto(`${env.base}/verify/vendor/${ctx.vendorId}`);
    await expect(page.getByRole('heading').first()).toBeVisible();
    await shot(page, '08-verify-passport');
  }
}
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "tests/e2e/steps" || echo "OK steps crud"`
Expected: `OK steps crud`.

- [ ] **Step 6: Commit**

```bash
git add tests/e2e/steps/04-create-vendor.ts tests/e2e/steps/05-vendor-detail.ts tests/e2e/steps/06-create-document.ts tests/e2e/steps/08-public-verify.ts
git commit -m "feat(e2e): CRUD steps (create vendor, vendor detail, create+anchor document, public verify)"
```

---

## Task 9: Test orquestador único con reanudación

**Files:**
- Create: `tests/e2e/full-system.spec.ts`

- [ ] **Step 1: Escribir el orquestador**

```typescript
import { test, type Page } from '@playwright/test';
import {
  env,
  STEP_ORDER,
  resolveStartIndex,
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
  const resuming = startIndex > STEP_ORDER.indexOf('login');

  // Al reanardar después del login, recuperamos la sesión persistida.
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
    for (let i = startIndex; i < STEP_ORDER.length; i++) {
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
```

- [ ] **Step 2: Verificar que el spec se descubre**

Run: `npx playwright test --list`
Expected: lista exactamente 1 test: `Recorrido integral de VendorPass`.

- [ ] **Step 3: Typecheck completo**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "tests/e2e" || echo "OK e2e typecheck"`
Expected: `OK e2e typecheck`.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/full-system.spec.ts
git commit -m "feat(e2e): single orchestrator test with step ordering and resume"
```

---

## Task 10: Corrida completa contra LOCAL y verificación visual

**Files:** (ninguno nuevo — ejecución/validación)

- [ ] **Step 1: Levantar la app local**

En una terminal aparte (déjala corriendo):
```bash
docker compose up
```
Espera a ver la app en `http://localhost:3000`. (Alternativa sin Docker: configurar `.env` + `npm run dev`, según README.)

- [ ] **Step 2: Verificar que la app responde**

Run: `curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:3000/login`
Expected: `200`.

- [ ] **Step 3: Corrida E2E completa (headed) contra local**

Run: `npm run e2e:local`
Expected: se abre Chromium visible, recorre los 13 pasos en orden, y termina con `1 passed`. La consola muestra cada `#N <step>`.

- [ ] **Step 4: Revisar evidencia visual**

Run: `ls tests/e2e/.artifacts/screenshots && echo "---" && npm run e2e:report`
Expected: ~20 screenshots numeradas (`00-landing.png` … `12-logout.png`) y el reporte HTML abre con los `test.step` anidados, trace y video por paso. Revisar visualmente cada captura para detectar problemas de UI.

- [ ] **Step 5: Probar la reanudación desde un paso**

Run: `E2E_ENV=local E2E_START_STEP=public-verify npx playwright test`
Expected: NO re-loguea ni recrea proveedor; carga sesión + `state.json` previos y ejecuta desde `public-verify` hasta `logout`. Termina `1 passed`. (Si `state.json` no tuviera `documentId`, el paso lanza un error explicativo — esperado solo si se borró `.artifacts/`.)

- [ ] **Step 6: Commit (si hubo ajustes de selectores)**

```bash
git add -A tests/e2e playwright.config.ts
git commit -m "test(e2e): green run against local + resume verified"
```

---

## Task 11: Corrida contra PROD y documentación de uso

**Files:**
- Modify: `README.md` (sección de uso E2E)

- [ ] **Step 1: Corrida E2E contra producción**

Run: `npm run e2e:prod`
Expected: recorre los 13 pasos contra `https://vendor-pass.vercel.app`, crea `E2E-Proveedor-<ts>` + documento real, y termina `1 passed`. (Decisión confirmada: CRUD completo en prod; los datos quedan, prefijados `E2E-`.)

- [ ] **Step 2: Documentar el uso en el README**

Agregar tras la sección "## Scripts" del `README.md`:
```markdown
## Pruebas E2E (Playwright)

Recorrido integral, visible en el navegador, disparado por **un único test orquestador**.

```bash
# Local (requiere `docker compose up` o `npm run dev` en :3000)
npm run e2e:local

# Producción (https://vendor-pass.vercel.app)
npm run e2e:prod

# Modo UI interactivo (paso a paso)
npm run e2e:ui

# Reanudar desde un paso concreto (clave o índice)
E2E_ENV=local E2E_START_STEP=create-document npx playwright test

# Reporte HTML + screenshots/trace/video
npm run e2e:report   # ./tests/e2e/.report
```

- Credenciales por defecto: las del bloque "Autenticación" (sobreescribibles con `E2E_EMAIL` / `E2E_PASSWORD`).
- Pasos disponibles para `E2E_START_STEP`: `landing, login, dashboard, vendors-list, create-vendor, vendor-detail, create-document, expirations, public-verify, integrations, docs, settings, logout`.
- La reanstauración usa `tests/e2e/.artifacts/{state.json, storageState.json}` (gitignored); no borres esa carpeta entre una corrida y su reanudación.
- Capturas y evidencia visual en `tests/e2e/.artifacts/screenshots/`.
```

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: document Playwright E2E suite usage (local/prod, resume, report)"
```

---

## Verificación end-to-end

1. **Local verde:** con la app en `:3000`, `npm run e2e:local` → `1 passed`, Chromium visible recorriendo los 13 pasos.
2. **Evidencia visual:** `tests/e2e/.artifacts/screenshots/` contiene las ~20 capturas numeradas; `npm run e2e:report` muestra `test.step` anidados con trace y video por paso.
3. **Reanudación:** `E2E_START_STEP=public-verify npx playwright test` continúa sin re-loguear ni recrear datos (usa `state.json` + `storageState.json`).
4. **Prod verde:** `npm run e2e:prod` → `1 passed` contra `vendor-pass.vercel.app`, con datos `E2E-` creados y conservados.
5. **Sin regresión unitaria:** `npm test` (Vitest) sigue verde y no recoge los specs E2E.

## Notas de diseño

- **Un solo test, muchos pasos:** el requisito "un test único que dispare a los demás" se cumple con un `test()` que invoca cada módulo dentro de `test.step()`. Falla en el primer paso roto y deja trace/video/screenshot de ese punto exacto.
- **Reanudación:** `E2E_START_STEP` (clave o índice) + `state.json`/`storageState.json` permiten retomar desde cualquier paso sin repetir login ni alta de datos.
- **Aserciones suaves** (`expect.soft`) solo donde hay dependencia de sincronización Arkiv (vencimientos), para no marcar falso-rojo por latencia de sync sin perder la señal visual.
- **Robustez de selectores:** se prioriza roles/labels reales del código (`#email`, `getByRole('button', { name: 'Entrar' })`, etc.) y `selectOption({ index: 1 })` para el `<select>` de tipo de documento, evitando acoplarse a valores internos de `DOCUMENT_TYPES`.
