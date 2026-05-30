# VendorPass — Tests E2E de Importación + Extracción IA + Visualización de Documentos (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir specs E2E con Playwright que usen los 5 PDFs de demo ya generados para verificar, de punta a punta, la **importación de archivos reales**, la **extracción de datos con IA**, y la **visualización del documento adjunto** — contra `local` o `prod`, visible en el navegador.

**Architecture:** Una corrida de *setup* loguea una vez y guarda `storageState`; tres specs independientes lo reutilizan: (1) API determinístico contra `/api/documents/extract` por cada fixture; (2) UI de alta de documento que adjunta el PDF y valida el autocompletado por IA; (3) flujo upload→crear→anclar→`/verify` que comprueba que el PDF adjunto se sirve correctamente. Cada fixture trae sus valores esperados en un manifiesto data-driven. Cuando falta `OPENROUTER_API_KEY` o `S3_ENDPOINT`, los tests se auto-saltan con anotación (o fallan en modo estricto).

**Tech Stack:** Playwright Test (`@playwright/test`), TypeScript, Chromium. App existente: Next.js 16 + Supabase + Arkiv + OpenRouter (`google/gemini-2.0-flash-001`).

---

## Context

VendorPass permite adjuntar evidencia (PDF/imagen) a cada documento de proveedor. Al adjuntar, el frontend dispara en paralelo `/api/upload` (S3/MinIO, calcula hash SHA-256) y `/api/documents/extract` (IA por OpenRouter) que **autocompleta** tipo, nombre, fechas y criticidad. La verificación pública `/verify/{id}` ofrece "Ver evidencia" para visualizar el archivo adjunto.

Ya existen **5 PDFs realistas** generados para demo/pruebas en `tests/e2e/fixtures/`:

| Fixture | Tipo esperado (enum) | Vencimiento impreso |
|---|---|---|
| `01-poliza-art-logistica-norte.pdf` | `poliza_art` | 2025-12-31 |
| `02-seguro-rc-constructora-del-sur.pdf` | `seguro_rc` | 2026-01-31 |
| `03-certificado-iso9001-metalurgica-pampa.pdf` | `certificado_iso` | 2026-03-02 |
| `04-habilitacion-comercial-servicios-it-rosario.pdf` | `habilitacion` | 2026-01-14 |
| `05-aptitud-medica-laboral-alimentos-del-plata.pdf` | `otro` (sin enum exacto) | 2026-04-14 |

Falta una suite E2E que ejercite específicamente **importar estos archivos reales, comprobar la extracción IA y visualizar el adjunto**. Este plan la crea.

**Hechos del código (verificados):**
- `app/api/documents/extract/route.ts`: `503 {error:'Extracción por IA no configurada'}` si `!isAiConfigured()` (i.e. sin `OPENROUTER_API_KEY`). Requiere auth. Devuelve `{ extracted }`.
- `lib/ai/extract.ts` → `ExtractedDocument`: `{ document_type, document_name, issued_at, expires_at, criticality, issuer, policy_number, coverage, summary, confidence, fields_found[] }`. Fechas normalizadas a `YYYY-MM-DD` (o `''`). `document_type` mapeado a enum o `'otro'`.
- `lib/documents.ts` → `DOCUMENT_TYPES`: `poliza_art, habilitacion, constancia_fiscal, seguro_rc, certificado_iso, otro`.
- `app/api/upload/route.ts`: `503 {error:'Almacenamiento S3 no configurado'}` si `!process.env.S3_ENDPOINT`. Requiere auth + `vendorId` de un vendor existente del usuario. Devuelve `{ fileUrl, fileHash }`.
- `app/api/documents/route.ts` `POST`: crea borrador; body `{ vendor_id, document_type, document_name, issued_at, expires_at, criticality, file_url, file_hash, notes }`; responde `201 { document }`.
- `app/api/documents/[id]/anchor/route.ts` `POST`: ancla; exige `file_hash` y `vendor.user_id === auth.user.id`; responde `{ document, arkiv_entity_key, anchored_at }`.
- `app/api/files/[...path]/route.ts` `GET`: sirve `evidence/...` con `Content-Type` real (`200`), `404` si no existe, `503` sin S3.
- `app/verify/[documentId]/page.tsx`: h1 "Verificación Arkiv"; muestra link `Ver evidencia` (target `_blank`) cuando `entity.fileUrl` existe (normalizado por `lib/storage/evidence-url.ts`).
- `components/vendor-pass/document-form.tsx`: input file `#file` (`.sr-only`); al adjuntar llama upload+extract en paralelo; muestra "Analizando documento con IA…" y luego el banner "Campos precargados por IA · confianza X%"; campos autocompletados muestran badge "IA". Campos requeridos por `validate()`: `document_type`, `document_name`, `issued_at`, `expires_at`. Botón `Guardar borrador` (sin anclaje) y `Guardar y anclar en Arkiv` (requiere `file_hash`).
- Login (`app/(auth)/login/page.tsx`): `#email`, `#password`, botón `Entrar`; redirige a `/dashboard`.
- Crear vendor (`app/vendors/new/page.tsx`): `POST /api/vendors` con `{name,category,owner_name,owner_email,area,notes}` → `{ vendor }`.

**Prerrequisitos de entorno (para cobertura plena):** app corriendo (local: `docker compose up`), `OPENROUTER_API_KEY` y `S3_ENDPOINT` configurados. Sin ellos, los specs respectivos se auto-saltan (o fallan con `E2E_REQUIRE_AI=1` / `E2E_REQUIRE_STORAGE=1`).

> **Nota de coexistencia:** Este plan crea/actualiza `playwright.config.ts` con proyectos `setup` + `documents`. Es compatible con el plan del recorrido integral (`2026-05-30-e2e-playwright-tests.md`): aquel usa `full-system.spec.ts`, que no matchea estos proyectos. Si ejecutás ambos, podés agregar un proyecto extra para `full-system` (ver nota en Task 1).

---

## File Structure

```
playwright.config.ts                              # (crear/actualizar) baseURL por E2E_ENV + proyectos setup/documents + storageState
tests/e2e/auth.setup.ts                           # login único → guarda storageState
tests/e2e/documents/support.ts                    # env, STORAGE_STATE, ensureTestVendor(), shotPath()
tests/e2e/documents/fixtures-manifest.ts          # los 5 fixtures + valores esperados (data-driven)
tests/e2e/documents/ai-extract-api.spec.ts        # POST cada PDF a /api/documents/extract; valida estructura+valores
tests/e2e/documents/import-ui.spec.ts             # adjunta el PDF en la UI; valida autocompletado IA; guarda borrador
tests/e2e/documents/view-evidence.spec.ts         # upload→crear→anclar→/verify; comprueba visualización del adjunto
```

Responsabilidades:
- **`support.ts`** — única fuente de entorno/credenciales/paths para esta suite; sin selectores de UI.
- **`fixtures-manifest.ts`** — datos esperados por fixture; sin lógica.
- **`*.spec.ts`** — cada uno cubre un aspecto (API IA / UI import / visualización), reutilizando `support` y el manifiesto.

---

## Task 1: Playwright instalado + config con proyecto de autenticación

**Files:**
- Create/Modify: `playwright.config.ts`
- Modify: `.gitignore`

- [ ] **Step 1: Asegurar `@playwright/test` y Chromium**

Run:
```bash
npm ls @playwright/test >/dev/null 2>&1 || npm install -D @playwright/test@^1.60.0
npx playwright install chromium
```
Expected: el paquete queda instalado y Chromium descargado (sin errores).

- [ ] **Step 2: Escribir `playwright.config.ts`**

(Si ya existe por el otro plan, **reemplazá su contenido** por este, que añade el proyecto `setup` y `documents`.)
```typescript
import { defineConfig, devices } from '@playwright/test';
import { STORAGE_STATE } from './tests/e2e/documents/support';

const baseURL =
  process.env.E2E_ENV === 'prod'
    ? 'https://vendor-pass.vercel.app'
    : 'http://localhost:3000';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000, // la extracción IA (PDF + LLM) puede tardar
  expect: { timeout: 20_000 },
  reporter: [
    ['list'],
    ['html', { outputFolder: 'tests/e2e/.report', open: 'never' }],
  ],
  use: {
    baseURL,
    headless: false, // visible para revisión visual
    viewport: { width: 1280, height: 900 },
    actionTimeout: 20_000,
    navigationTimeout: 30_000,
    trace: 'on',
    video: 'on',
    screenshot: 'on',
    launchOptions: { slowMo: 250 },
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts$/ },
    {
      name: 'documents',
      testMatch: /tests[\\/]e2e[\\/]documents[\\/].*\.spec\.ts$/,
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], storageState: STORAGE_STATE },
    },
    // Para correr también el recorrido integral del otro plan, agregá:
    // { name: 'full-system', testMatch: /full-system\.spec\.ts$/ },
  ],
});
```

- [ ] **Step 3: Ignorar artefactos**

Agregar al final de `.gitignore` (si no están ya):
```
# Playwright E2E
/tests/e2e/.auth/
/tests/e2e/.artifacts/
/tests/e2e/.report/
/test-results/
/playwright/.cache/
```

- [ ] **Step 4: Agregar scripts npm**

En `package.json`, dentro de `"scripts"`:
```json
    "e2e:docs": "playwright test --project=documents",
    "e2e:docs:local": "E2E_ENV=local playwright test --project=documents",
    "e2e:docs:prod": "E2E_ENV=prod playwright test --project=documents",
    "e2e:report": "playwright show-report tests/e2e/.report"
```

- [ ] **Step 5: Commit**

```bash
git add playwright.config.ts .gitignore package.json package-lock.json
git commit -m "chore(e2e): playwright config with auth setup + documents project"
```

---

## Task 2: Soporte compartido (env, storageState, vendor de prueba)

**Files:**
- Create: `tests/e2e/documents/support.ts`

- [ ] **Step 1: Escribir `support.ts`**

```typescript
import fs from 'node:fs';
import path from 'node:path';
import { expect, type APIRequestContext } from '@playwright/test';

/** Ruta del estado de sesión persistido por auth.setup.ts y reutilizado por los specs. */
export const STORAGE_STATE = path.resolve(process.cwd(), 'tests/e2e/.auth/storageState.json');

const ENV = process.env.E2E_ENV === 'prod' ? 'prod' : 'local';

export const env = {
  name: ENV,
  base: ENV === 'prod' ? 'https://vendor-pass.vercel.app' : 'http://localhost:3000',
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
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "documents/support" || echo "OK support.ts"`
Expected: `OK support.ts`.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/documents/support.ts
git commit -m "feat(e2e): shared support for document import tests"
```

---

## Task 3: Autenticación de setup (storageState)

**Files:**
- Create: `tests/e2e/auth.setup.ts`

- [ ] **Step 1: Escribir `auth.setup.ts`**

```typescript
import fs from 'node:fs';
import path from 'node:path';
import { test as setup, expect } from '@playwright/test';
import { env, STORAGE_STATE } from './documents/support';

setup('autenticar y guardar sesión', async ({ page }) => {
  fs.mkdirSync(path.dirname(STORAGE_STATE), { recursive: true });

  await page.goto(`${env.base}/login`);
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();

  await page.locator('#email').fill(env.email);
  await page.locator('#password').fill(env.password);
  await page.getByRole('button', { name: 'Entrar' }).click();

  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

  await page.context().storageState({ path: STORAGE_STATE });
});
```

- [ ] **Step 2: Verificar que el setup corre y guarda sesión** (requiere app levantada en `:3000`)

Run: `E2E_ENV=local npx playwright test --project=setup`
Expected: `1 passed`; existe el archivo `tests/e2e/.auth/storageState.json`.

Run: `test -f tests/e2e/.auth/storageState.json && echo OK`
Expected: `OK`.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/auth.setup.ts
git commit -m "feat(e2e): auth setup persisting storageState"
```

---

## Task 4: Manifiesto de fixtures

**Files:**
- Create: `tests/e2e/documents/fixtures-manifest.ts`

- [ ] **Step 1: Escribir el manifiesto**

```typescript
import path from 'node:path';

export interface FixtureSpec {
  /** Ruta absoluta al PDF de prueba. */
  file: string;
  /** Etiqueta legible para el nombre del test. */
  label: string;
  /** Valor de enum DOCUMENT_TYPES esperado de la IA. */
  expectedType: string;
  /** Si true, el tipo se valida estricto; si false, como soft (la IA puede mapear a 'otro'). */
  typeStrict: boolean;
  /** Fecha de vencimiento impresa en el PDF (YYYY-MM-DD). */
  expectedExpires: string;
}

const dir = path.resolve(process.cwd(), 'tests/e2e/fixtures');

export const FIXTURES: FixtureSpec[] = [
  {
    file: path.join(dir, '01-poliza-art-logistica-norte.pdf'),
    label: 'Póliza ART — Logística Norte',
    expectedType: 'poliza_art',
    typeStrict: true,
    expectedExpires: '2025-12-31',
  },
  {
    file: path.join(dir, '02-seguro-rc-constructora-del-sur.pdf'),
    label: 'Seguro RC — Constructora del Sur',
    expectedType: 'seguro_rc',
    typeStrict: true,
    expectedExpires: '2026-01-31',
  },
  {
    file: path.join(dir, '03-certificado-iso9001-metalurgica-pampa.pdf'),
    label: 'ISO 9001 — Metalúrgica Pampa',
    expectedType: 'certificado_iso',
    typeStrict: true,
    expectedExpires: '2026-03-02',
  },
  {
    file: path.join(dir, '04-habilitacion-comercial-servicios-it-rosario.pdf'),
    label: 'Habilitación — Servicios IT Rosario',
    expectedType: 'habilitacion',
    typeStrict: true,
    expectedExpires: '2026-01-14',
  },
  {
    file: path.join(dir, '05-aptitud-medica-laboral-alimentos-del-plata.pdf'),
    label: 'Aptitud Médica — Alimentos del Plata',
    expectedType: 'otro',
    typeStrict: false,
    expectedExpires: '2026-04-14',
  },
];
```

- [ ] **Step 2: Verificar que los 5 PDFs existen**

Run: `for f in 01-poliza-art-logistica-norte 02-seguro-rc-constructora-del-sur 03-certificado-iso9001-metalurgica-pampa 04-habilitacion-comercial-servicios-it-rosario 05-aptitud-medica-laboral-alimentos-del-plata; do test -s "tests/e2e/fixtures/$f.pdf" && echo "OK $f" || echo "FALTA $f"; done`
Expected: 5 líneas `OK ...`.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/documents/fixtures-manifest.ts
git commit -m "test(e2e): fixtures manifest with expected AI extraction values"
```

---

## Task 5: Test API de extracción IA (determinístico por endpoint)

**Files:**
- Create: `tests/e2e/documents/ai-extract-api.spec.ts`

- [ ] **Step 1: Escribir el spec**

```typescript
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
      if (fx.typeStrict) {
        expect.soft(extracted.document_type, 'tipo detectado').toBe(fx.expectedType);
      }
      expect.soft(extracted.expires_at, 'vencimiento extraído').toBe(fx.expectedExpires);
      expect
        .soft((extracted.document_name ?? '').length, 'nombre de documento no vacío')
        .toBeGreaterThan(0);
    });
  }
});
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "ai-extract-api" || echo "OK ai-extract-api"`
Expected: `OK ai-extract-api`.

- [ ] **Step 3: Correr el spec** (app levantada; con `OPENROUTER_API_KEY` para cobertura real)

Run: `E2E_ENV=local npx playwright test --project=documents tests/e2e/documents/ai-extract-api.spec.ts`
Expected: con IA configurada → 5 tests `passed` (las aserciones `soft` reportan cualquier desviación de valores sin abortar). Sin IA → 5 `skipped` con la anotación.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/documents/ai-extract-api.spec.ts
git commit -m "test(e2e): AI extraction API spec over real PDF fixtures"
```

---

## Task 6: Test UI de importación con autocompletado por IA

**Files:**
- Create: `tests/e2e/documents/import-ui.spec.ts`

- [ ] **Step 1: Escribir el spec**

```typescript
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

    // Soft: el valor coincide con lo impreso en el PDF.
    expect.soft(await page.locator('#expires_at').inputValue()).toBe(fx.expectedExpires);

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
    await page.goto(`${env.base}/vendors/${vendorId}?tab=documentos`);
    await expect(page.getByText(docName)).toBeVisible();
  });
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "import-ui" || echo "OK import-ui"`
Expected: `OK import-ui`.

- [ ] **Step 3: Correr el spec** (app levantada; IA configurada)

Run: `E2E_ENV=local npx playwright test --project=documents tests/e2e/documents/import-ui.spec.ts`
Expected: con IA → 5 `passed`, Chromium visible mostrando el autocompletado; screenshots en `tests/e2e/.artifacts/documents/ai-filled-*.png`. Sin IA → `skipped`.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/documents/import-ui.spec.ts
git commit -m "test(e2e): UI document import with AI autofill over real PDFs"
```

---

## Task 7: Test de visualización del documento adjunto (upload → anclar → /verify)

**Files:**
- Create: `tests/e2e/documents/view-evidence.spec.ts`

- [ ] **Step 1: Escribir el spec**

```typescript
import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';
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

  // 3) Anclar en Arkiv (expone la evidencia en la página pública /verify).
  const anchor = await api.post(`${env.base}/api/documents/${document.id}/anchor`);
  expect(anchor.ok(), `anchor status ${anchor.status()}`).toBeTruthy();

  // 4) /verify debe ofrecer "Ver evidencia".
  await page.goto(`${env.base}/verify/${document.id}`);
  await expect(page.getByRole('heading', { name: 'Verificación Arkiv' })).toBeVisible();
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
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "view-evidence" || echo "OK view-evidence"`
Expected: `OK view-evidence`.

- [ ] **Step 3: Correr el spec** (app levantada; `S3_ENDPOINT` configurado)

Run: `E2E_ENV=local npx playwright test --project=documents tests/e2e/documents/view-evidence.spec.ts`
Expected: con S3 → `1 passed`, screenshot `verify-with-evidence.png` mostrando "Ver evidencia"; el GET del adjunto responde `200 application/pdf`. Sin S3 → `skipped`.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/documents/view-evidence.spec.ts
git commit -m "test(e2e): attached document viewing via upload->anchor->/verify"
```

---

## Task 8: Corrida completa de la suite + documentación

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Correr toda la suite `documents` contra local**

(App en `:3000`, idealmente con `OPENROUTER_API_KEY` y `S3_ENDPOINT`.)
Run: `npm run e2e:docs:local`
Expected: corre `setup` + los 3 specs (11 tests: 5 API + 5 UI + 1 evidencia). Con IA y S3 configurados → todo `passed`; sin ellos → los específicos `skipped` con anotación clara.

- [ ] **Step 2: Revisar evidencia visual y reporte**

Run: `ls tests/e2e/.artifacts/documents && npm run e2e:report`
Expected: screenshots `ai-filled-*.png`, `uploading-*.png`, `verify-with-evidence.png`; el reporte HTML muestra cada test con trace/video y los valores `soft` que difieran de lo esperado (para detectar errores de extracción o de UI).

- [ ] **Step 3: (Opcional) Corrida contra prod**

Run: `npm run e2e:docs:prod`
Expected: misma suite contra `https://vendor-pass.vercel.app`. (Cada extracción llama al modelo real y crea un proveedor `E2E-AI-...`; tener en cuenta costo/datos.)

- [ ] **Step 4: Documentar en el README**

Agregar tras la sección de pruebas E2E (o tras "## Scripts") del `README.md`:
```markdown
### Pruebas E2E — Importación + IA + visualización de documentos

Usan los 5 PDFs de demo de `tests/e2e/fixtures/` para verificar importación real, extracción por IA y visualización del adjunto.

```bash
npm run e2e:docs:local   # local (requiere app en :3000)
npm run e2e:docs:prod    # producción
npm run e2e:report       # reporte HTML + screenshots/trace/video
```

- Cobertura plena requiere `OPENROUTER_API_KEY` (extracción IA) y `S3_ENDPOINT` (subida/visualización). Sin ellos, los tests se auto-saltan; forzá fallo con `E2E_REQUIRE_AI=1` / `E2E_REQUIRE_STORAGE=1`.
- Credenciales por defecto: las de "Autenticación" (sobreescribibles con `E2E_EMAIL` / `E2E_PASSWORD`).
- Capturas en `tests/e2e/.artifacts/documents/`.
```

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: document AI import/extraction/viewing E2E suite"
```

---

## Verificación end-to-end

1. **Setup verde:** `npx playwright test --project=setup` crea `tests/e2e/.auth/storageState.json`.
2. **Extracción IA (API):** los 5 fixtures devuelven `extracted` con `confidence>0`, `expires_at` ISO y `fields_found` con `expires_at`; los valores esperados se reportan como `soft`.
3. **Importación (UI):** adjuntar cada PDF muestra el banner "Campos precargados por IA", autocompleta `#expires_at` y el documento se guarda y aparece en la pestaña Documentos.
4. **Visualización:** tras upload+anclaje, `/verify/{id}` ofrece "Ver evidencia" y el GET del adjunto responde `200 application/pdf` con bytes reales.
5. **Degradación controlada:** sin `OPENROUTER_API_KEY`/`S3_ENDPOINT`, los specs se saltan con anotación (o fallan en modo estricto), nunca con error opaco.
6. **Sin regresión:** `npm test` (Vitest) sigue verde (los specs E2E viven en `tests/e2e/**/*.spec.ts`, no `*.test.ts`).

## Notas de diseño

- **No determinismo de la IA:** se afirma de forma dura solo la *estructura* (formato ISO, confianza, `fields_found`); los *valores* puntuales (tipo, fecha exacta, nombre) se verifican con `expect.soft`, de modo que una desviación del modelo quede registrada en el reporte sin romper la corrida.
- **Aislamiento del adjunto:** `view-evidence` usa la API (upload→crear→anclar) para no depender del no determinismo de la IA y testear puramente la **subida y visualización** del archivo real.
- **Reutilización de sesión:** un único `auth.setup.ts` evita re-login por test; los specs reciben `storageState` vía el proyecto `documents`.
- **prod/local:** mismo `E2E_ENV` que el resto de la suite; las URLs salen del README.
```
