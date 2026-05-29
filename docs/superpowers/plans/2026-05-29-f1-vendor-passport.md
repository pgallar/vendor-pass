# Pasaporte de Cumplimiento Verificable (vendor + PDF) — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar al cliente/auditor una **prueba portable de cumplimiento** de un proveedor, sin necesidad de cuenta: (1) un **pasaporte público** en `/verify/vendor/{id}` que lista cada documento con su estado, distinguiendo lo **anclado en Arkiv** de lo **pendiente de anclaje**, y (2) un **PDF descargable** (desde el detalle autenticado del proveedor) con logo/nombre de la organización, tabla de documentos, **QR** que abre la verificación pública, y pie "Verificado en Arkiv Network" con la `entityKey` de cada documento anclado. El estado se **recalcula desde Arkiv en cada descarga** (no se cachea).

**Architecture:** Un **builder compartido** `lib/passport/build-vendor-passport.ts` agrega datos de Postgres (proveedor + documentos vía `supabaseAdmin()`) con la verdad de Arkiv (`getStore().listByVendor`), calcula el estado agregado con `vendorStatus`, marca cada documento como `anchored` / `pending_anchor` / `draft` (lifecycle de Feature 2), y **filtra datos sensibles** (sin `owner_email`, sin notas internas, sin URLs S3 largas). Ese builder lo consumen tres superficies: la **página pública** (Server Component, ya existe parcial), la **API JSON** `/api/verify/vendor/{id}` (espejo público) y el **route handler del PDF** `/api/vendors/{id}/passport.pdf` (autenticado con `requireUser()`, render con `@react-pdf/renderer` + `qrcode`). El QR se genera en server como data URL apuntando a la URL absoluta (`NEXT_PUBLIC_APP_URL`). La página pública sigue siendo `noindex` (como `/verify/[documentId]`).

**Tech Stack:** Next.js 16 (App Router, route handlers Node con `params: Promise<…>`), Supabase (`supabaseAdmin()` service-role para lo público sin sesión; `requireUser()` para el PDF), Arkiv (`lib/arkiv/validations.ts`, `getStore().listByVendor`), `@react-pdf/renderer` (PDF en route handler vía `renderToBuffer`), `qrcode` (QR como data URL PNG en server), TypeScript, Vitest.

**Dependencias:** Feature 2 (lifecycle: distinguir "anclado" vs "borrador/pendiente"). Opcional Feature 3 (enlace "Verificar archivo" por hash). Opcional Feature 4 ("último anclaje" desde eventos).

**Decisiones tomadas (objetá si querés cambiarlas):**
- **`@react-pdf/renderer` (no pdfkit):** API declarativa en JSX, `renderToBuffer` funciona dentro de un route handler Node de Next 16 (`export const runtime = 'nodejs'`). El QR se inserta como `<Image src={dataUrl} />`.
- **QR como data URL PNG en server:** `qrcode.toDataURL()` evita servir un endpoint extra y embebe el QR directo en el PDF y, si hace falta, en la página.
- **Lifecycle derivado, no nueva migración:** un documento es `anchored` si aparece en `getStore().listByVendor` (tiene validación en Arkiv); si no, `pending_anchor`. Si existe la columna `lifecycle_status` (Feature 2) se respeta `draft` por encima de la inferencia. **No se crea migración nueva.**
- **El PDF no cachea:** `export const dynamic = 'force-dynamic'`; cada descarga recalcula desde Arkiv. El PDF declara "Estado al {ISO timestamp}" — attestación técnica, no validez legal.

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `package.json` (modificar) | Agregar deps `@react-pdf/renderer` y `qrcode` (+ `@types/qrcode`) |
| `.env.example` (verificar) | Confirmar `NEXT_PUBLIC_APP_URL` (ya presente, línea 25) |
| `lib/passport/build-vendor-passport.ts` (crear) | Builder compartido: agrega Postgres + Arkiv, marca lifecycle, filtra datos sensibles. Parte testeable. |
| `tests/passport.build.test.ts` (crear) | Tests del builder: agregación, documento sin Arkiv (pendiente), estados, privacidad |
| `lib/passport/qr.ts` (crear) | `buildVerifyUrl()` + `generateQrDataUrl()` (URL absoluta con `NEXT_PUBLIC_APP_URL`) |
| `lib/passport/render-pdf.ts` (crear) | Render del PDF del pasaporte (`@react-pdf/renderer` → `renderToBuffer`) |
| `components/vendor-pass/passport-document-row.tsx` (crear) | Fila de documento del pasaporte público (badge anclado/pendiente/hash, enlace a `/verify/{id}`) |
| `components/vendor-pass/vendor-passport-view.tsx` (crear) | Vista del pasaporte público (cabecera + estado + lista de filas), reutiliza `StatusBadge`/`VendorComplianceSummary` |
| `app/verify/vendor/[id]/page.tsx` (modificar) | Reemplazar agregación inline por el builder + `VendorPassportView`; mantener `noindex` y banners |
| `app/api/verify/vendor/[id]/route.ts` (crear) | `GET` JSON espejo del pasaporte público (patrón de `app/api/verify/[documentId]/route.ts`) |
| `app/api/vendors/[id]/passport.pdf/route.ts` (crear) | `GET` autenticado: genera y devuelve el PDF (`requireUser`) |
| `app/vendors/[id]/page.tsx` (modificar) | Completar botón "Pasaporte" + agregar "Descargar PDF" y "Copiar enlace" |

---

## Task 1: Instalar dependencias de PDF y QR

**Files:**
- Modify: `package.json` (vía `npm install`)
- Verify: `.env.example`

- [ ] **Step 1: Confirmar `NEXT_PUBLIC_APP_URL`**

Run: `grep -n NEXT_PUBLIC_APP_URL .env.example`
Expected: `25:NEXT_PUBLIC_APP_URL=http://localhost:3000` (ya está; no hay que agregar nada).

- [ ] **Step 2: Instalar las dependencias**

Run: `npm install @react-pdf/renderer qrcode && npm install -D @types/qrcode`
Expected: se agregan a `dependencies` / `devDependencies` sin errores de peer-deps. (Si npm advierte sobre React 19, usar `--legacy-peer-deps`; `@react-pdf/renderer` ≥ 4 soporta React 19.)

- [ ] **Step 3: Verificar que la app sigue compilando**

Run: `npx tsc --noEmit`
Expected: PASS (todavía no se usa nada nuevo).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(deps): @react-pdf/renderer y qrcode para el pasaporte PDF"
```

---

## Task 2: Builder compartido `build-vendor-passport.ts` (TDD)

El builder agrega Postgres + Arkiv, deriva el lifecycle de cada documento y **filtra datos sensibles**. Es el corazón testeable de la feature. Extiende la lógica que hoy vive inline en `lib/arkiv/vendor-lookup.ts` (`resolveVendorPassport`), pero produce un shape pensado para página/API/PDF y nunca expone `owner_email`, `notes` ni `fileUrl` largas.

**Files:**
- Create: `lib/passport/build-vendor-passport.ts`
- Test: `tests/passport.build.test.ts`

- [ ] **Step 1: Escribir los tests que fallan**

Create `tests/passport.build.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { assemblePassport } from '@/lib/passport/build-vendor-passport';
import type { VendorDocument } from '@/lib/types';
import type { ValidationEntity } from '@/lib/arkiv/validations';

const vendor = {
  id: 'v1',
  name: 'ACME S.A.',
  category: 'Logística',
  area: 'CABA',
  // estos NO deben aparecer en la salida:
  owner_email: 'interno@acme.com',
  notes: 'nota interna confidencial',
} as Record<string, unknown>;

function doc(over: Partial<VendorDocument>): VendorDocument {
  return {
    id: 'd1',
    vendor_id: 'v1',
    document_name: 'Póliza ART',
    document_type: 'Seguro ART',
    issued_at: '2026-01-01',
    expires_at: '2026-12-31',
    criticality: 'critical',
    file_url: 'https://s3.amazonaws.com/bucket/muy/larga/firma?X-Amz-Signature=abc',
    file_hash: 'a'.repeat(64),
    ...over,
  } as VendorDocument;
}

function entity(over: Partial<ValidationEntity>): ValidationEntity {
  return {
    vendorId: 'v1', documentId: 'd1', documentType: 'Seguro ART', documentName: 'Póliza ART',
    issuedAt: '2026-01-01', expiresAt: '2026-12-31', status: 'vigente', criticality: 'critical',
    owner: 'interno@acme.com', creator: null, fileUrl: null, fileHash: 'a'.repeat(64),
    notes: 'nota interna', vendorName: 'ACME S.A.', syncedAt: '2026-05-01T00:00:00.000Z',
    ...over,
  };
}

describe('assemblePassport', () => {
  it('agrega vendor + documentos y calcula el estado agregado', () => {
    const p = assemblePassport({
      vendor,
      documents: [doc({})],
      arkivEntities: [entity({})],
      arkivAvailable: true,
    });
    expect(p.vendor.name).toBe('ACME S.A.');
    expect(p.status).toBe('ok');
    expect(p.documents).toHaveLength(1);
    expect(p.documents[0].lifecycle).toBe('anchored');
    expect(p.documents[0].entityKey).toBe(null); // memory store no expone entityKey
    expect(p.documents[0].hashRegistered).toBe(true);
  });

  it('marca como pendiente de anclaje un documento que no está en Arkiv', () => {
    const p = assemblePassport({
      vendor,
      documents: [doc({ id: 'd1' }), doc({ id: 'd2', criticality: 'normal', file_hash: null })],
      arkivEntities: [entity({ documentId: 'd1' })],
      arkivAvailable: true,
    });
    const d2 = p.documents.find(d => d.id === 'd2')!;
    expect(d2.lifecycle).toBe('pending_anchor');
    expect(d2.hashRegistered).toBe(false);
  });

  it('usa el estado on-chain de Arkiv cuando difiere del de Postgres', () => {
    const p = assemblePassport({
      vendor,
      documents: [doc({ expires_at: '2099-12-31' })], // Postgres diría vigente
      arkivEntities: [entity({ status: 'vencido' })],   // Arkiv dice vencido
      arkivAvailable: true,
    });
    expect(p.documents[0].status).toBe('vencido');
    expect(p.status).toBe('bloqueado'); // crítico vencido
  });

  it('NO expone datos sensibles del dueño del tenant', () => {
    const p = assemblePassport({
      vendor,
      documents: [doc({})],
      arkivEntities: [entity({})],
      arkivAvailable: true,
    });
    const serialized = JSON.stringify(p);
    expect(serialized).not.toContain('owner_email');
    expect(serialized).not.toContain('interno@acme.com');
    expect(serialized).not.toContain('nota interna');
    expect(serialized).not.toContain('X-Amz-Signature');
  });

  it('si Arkiv no está disponible, todo queda pendiente de anclaje y resolvedFrom=postgres', () => {
    const p = assemblePassport({
      vendor,
      documents: [doc({})],
      arkivEntities: [],
      arkivAvailable: false,
    });
    expect(p.resolvedFrom).toBe('postgres');
    expect(p.documents[0].lifecycle).toBe('pending_anchor');
  });

  it('respeta lifecycle_status=draft de Postgres por encima de la inferencia', () => {
    const p = assemblePassport({
      vendor,
      documents: [doc({ lifecycle_status: 'draft' } as Partial<VendorDocument>)],
      arkivEntities: [entity({})],
      arkivAvailable: true,
    });
    expect(p.documents[0].lifecycle).toBe('draft');
  });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `npx vitest run tests/passport.build.test.ts`
Expected: FAIL con "Failed to resolve import '@/lib/passport/build-vendor-passport'".

- [ ] **Step 3: Implementar el builder**

Create `lib/passport/build-vendor-passport.ts`:

```typescript
import { documentStatus, vendorComplianceReasons, vendorStatus } from '@/lib/status';
import { getStore } from '@/lib/arkiv/validations';
import { supabaseAdmin } from '@/lib/supabase/server';
import type { ValidationEntity } from '@/lib/arkiv/validations';
import type {
  Criticality,
  DocumentStatus,
  Vendor,
  VendorDocument,
  VendorStatus,
} from '@/lib/types';
import type { ComplianceReason } from '@/lib/status';

/** Estado de ciclo de vida respecto del anclaje en Arkiv (Feature 2). */
export type PassportLifecycle = 'anchored' | 'pending_anchor' | 'draft';

/** Documento del pasaporte: SOLO metadatos de cumplimiento (sin datos sensibles). */
export interface PassportDocument {
  id: string;
  documentName: string;
  documentType: string;
  issuedAt: string;
  expiresAt: string;
  criticality: Criticality;
  status: DocumentStatus;
  lifecycle: PassportLifecycle;
  /** entityKey de Arkiv si está anclado en red (null en memoria o si no está anclado). */
  entityKey: string | null;
  /** true si la validación anclada registró el hash del archivo (Feature 3). */
  hashRegistered: boolean;
}

/** Pasaporte público: solo lo necesario para auditar cumplimiento, nada sensible. */
export interface VendorPassportData {
  vendor: { id: string; name: string; category: string | null; area: string | null };
  status: VendorStatus;
  reasons: ComplianceReason[];
  documents: PassportDocument[];
  resolvedFrom: 'store' | 'postgres';
  /** Momento del cálculo (ISO). El PDF lo muestra como "Estado al …". */
  generatedAt: string;
}

interface AssembleInput {
  vendor: Record<string, unknown>;
  documents: VendorDocument[];
  arkivEntities: ValidationEntity[];
  arkivAvailable: boolean;
}

/**
 * Núcleo puro y testeable: combina los datos de Postgres con las entidades de Arkiv,
 * deriva el lifecycle y FILTRA todo dato sensible del dueño del tenant.
 */
export function assemblePassport(input: AssembleInput): VendorPassportData {
  const { vendor, documents, arkivEntities, arkivAvailable } = input;
  const arkivById = new Map(arkivEntities.map(e => [e.documentId, e]));
  const resolvedFrom: VendorPassportData['resolvedFrom'] =
    arkivAvailable && arkivEntities.length > 0 ? 'store' : 'postgres';

  const passportDocs: PassportDocument[] = documents.map(doc => {
    const arkiv = arkivById.get(doc.id);
    // Arkiv es la fuente de verdad del estado cuando el documento está anclado.
    const status: DocumentStatus = arkiv ? arkiv.status : documentStatus(doc);

    let lifecycle: PassportLifecycle;
    if ((doc as { lifecycle_status?: string }).lifecycle_status === 'draft') {
      lifecycle = 'draft';
    } else if (arkiv) {
      lifecycle = 'anchored';
    } else {
      lifecycle = 'pending_anchor';
    }

    const hashRegistered = arkiv != null && arkiv.fileHash != null && arkiv.fileHash.length > 0;

    return {
      id: doc.id,
      documentName: doc.document_name,
      documentType: doc.document_type,
      issuedAt: doc.issued_at,
      expiresAt: doc.expires_at,
      criticality: doc.criticality,
      status,
      lifecycle,
      entityKey: arkiv ? (arkiv as ValidationEntity & { entityKey?: string }).entityKey ?? null : null,
      hashRegistered,
    };
  });

  // Para el estado agregado usamos los documentos con su estado ya resuelto desde Arkiv.
  const resolvedForStatus: VendorDocument[] = documents.map(doc => {
    const arkiv = arkivById.get(doc.id);
    return arkiv ? ({ ...doc, status: arkiv.status } as VendorDocument & { status: DocumentStatus }) : doc;
  });

  return {
    vendor: {
      id: String(vendor.id),
      name: String(vendor.name),
      category: (vendor.category as string | null) ?? null,
      area: (vendor.area as string | null) ?? null,
    },
    status: vendorStatus(resolvedForStatus),
    reasons: vendorComplianceReasons(resolvedForStatus),
    documents: passportDocs,
    resolvedFrom,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Carga + ensambla el pasaporte de un proveedor. Usa service-role (público sin sesión).
 * Devuelve null si el proveedor no existe.
 */
export async function buildVendorPassport(vendorId: string): Promise<VendorPassportData | null> {
  const sb = supabaseAdmin();
  const { data: vendor, error } = await sb
    .from('vendors')
    .select('id,name,category,area')
    .eq('id', vendorId)
    .maybeSingle();
  if (error || !vendor) return null;

  const { data: docs } = await sb
    .from('documents')
    .select('*')
    .eq('vendor_id', vendorId)
    .order('expires_at');

  let arkivEntities: ValidationEntity[] = [];
  let arkivAvailable = false;
  try {
    arkivEntities = await getStore().listByVendor(vendorId);
    arkivAvailable = true;
  } catch {
    // Arkiv no disponible: degradar a Postgres (todo pendiente de anclaje).
    arkivAvailable = false;
  }

  return assemblePassport({
    vendor: vendor as Record<string, unknown>,
    documents: (docs ?? []) as VendorDocument[],
    arkivEntities,
    arkivAvailable,
  });
}

// Referencia para evitar import sin uso si Vendor se necesitara en el futuro.
export type { Vendor };
```

> **Nota sobre `entityKey`:** el `ValidationEntity` de `lib/arkiv/validations.ts` no incluye `entityKey` (vive en `ValidationLookup`). En `listByVendor` el store de Arkiv no lo expone por entidad, por eso el builder lo deja en `null` salvo que una versión futura del store lo agregue. El PDF y la página muestran `entityKey` solo cuando no es `null`; el badge "anclado" no depende de él.

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `npx vitest run tests/passport.build.test.ts`
Expected: PASS (los 7 casos).

- [ ] **Step 5: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add lib/passport/build-vendor-passport.ts tests/passport.build.test.ts
git commit -m "feat(passport): builder compartido vendor passport con tests (agregación, lifecycle, privacidad)"
```

---

## Task 3: QR — URL absoluta y data URL

**Files:**
- Create: `lib/passport/qr.ts`

- [ ] **Step 1: Crear el helper**

Create `lib/passport/qr.ts`:

```typescript
import QRCode from 'qrcode';

/** Base pública de la app, sin barra final. */
function appBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
}

/** URL absoluta del pasaporte público de un proveedor (lo que codifica el QR). */
export function buildVerifyUrl(vendorId: string): string {
  return `${appBaseUrl()}/verify/vendor/${vendorId}`;
}

/** Genera el QR de una URL como data URL PNG (para embeber en el PDF o la página). */
export async function generateQrDataUrl(url: string): Promise<string> {
  return QRCode.toDataURL(url, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 240,
  });
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add lib/passport/qr.ts
git commit -m "feat(passport): generación de QR y URL absoluta del pasaporte"
```

---

## Task 4: Componentes de la vista pública

`PassportDocumentRow` (una fila con badges de lifecycle/hash y enlace a `/verify/{id}`) y `VendorPassportView` (cabecera + estado + lista). Reutilizan `StatusBadge` y `VendorComplianceSummary`. La fila de documento NO muestra fechas en formato sensible adicional: solo nombre, tipo, vencimiento y badges.

**Files:**
- Create: `components/vendor-pass/passport-document-row.tsx`
- Create: `components/vendor-pass/vendor-passport-view.tsx`

- [ ] **Step 1: Crear `PassportDocumentRow`**

Create `components/vendor-pass/passport-document-row.tsx`:

```tsx
import Link from 'next/link';
import { StatusBadge } from '@/components/vendor-pass/status-badge';
import type { PassportDocument } from '@/lib/passport/build-vendor-passport';
import { FileText, Calendar, Hash } from 'lucide-react';

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('es-MX', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export function PassportDocumentRow({ doc }: { doc: PassportDocument }) {
  return (
    <li className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0">
      <div className="shrink-0 w-9 h-9 rounded-lg bg-secondary flex items-center justify-center" aria-hidden="true">
        <FileText size={16} className="text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{doc.documentName}</p>
        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1 flex-wrap">
          <span>{doc.documentType}</span>
          <span aria-hidden="true">·</span>
          <Calendar size={11} aria-hidden="true" />
          <span>{formatDate(doc.expiresAt)}</span>
        </p>
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          {doc.lifecycle === 'anchored' && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-[oklch(0.93_0.05_155)] text-[oklch(0.36_0.1_155)]">
              Anclado en red
            </span>
          )}
          {doc.lifecycle === 'pending_anchor' && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
              Pendiente de anclaje
            </span>
          )}
          {doc.lifecycle === 'draft' && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
              Borrador
            </span>
          )}
          {doc.hashRegistered && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-secondary text-foreground">
              <Hash size={10} aria-hidden="true" /> Hash registrado
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Link
          href={`/verify/${doc.id}`}
          className="text-xs text-primary font-medium min-h-11 inline-flex items-center px-2"
        >
          Verificar
        </Link>
        <StatusBadge status={doc.status} size="sm" />
      </div>
    </li>
  );
}
```

- [ ] **Step 2: Crear `VendorPassportView`**

Create `components/vendor-pass/vendor-passport-view.tsx`:

```tsx
import { StatusBadge } from '@/components/vendor-pass/status-badge';
import { VendorComplianceSummary } from '@/components/vendor-pass/vendor-compliance-summary';
import { CopyVerifyLink } from '@/components/vendor-pass/copy-verify-link';
import { PassportDocumentRow } from '@/components/vendor-pass/passport-document-row';
import type { VendorPassportData } from '@/lib/passport/build-vendor-passport';
import { Building2, ShieldCheck } from 'lucide-react';

export function VendorPassportView({ passport }: { passport: VendorPassportData }) {
  const { vendor, status, reasons, documents } = passport;
  const vigentes = documents.filter(d => d.status === 'vigente').length;
  const porVencer = documents.filter(d => d.status === 'por_vencer').length;
  const vencidos = documents.filter(d => d.status === 'vencido').length;
  const pendientes = documents.filter(d => d.lifecycle !== 'anchored').length;

  return (
    <>
      <section className="bg-card border border-border rounded-xl p-4 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Building2 size={16} className="text-primary shrink-0" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-foreground truncate">{vendor.name}</h2>
            </div>
            {(vendor.category || vendor.area) && (
              <p className="text-xs text-muted-foreground">
                {[vendor.category, vendor.area].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
          <StatusBadge status={status} size="md" />
        </div>

        <dl className="grid grid-cols-3 gap-3 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Vigentes</dt>
            <dd className="font-medium mt-0.5">{vigentes}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Por vencer</dt>
            <dd className="font-medium mt-0.5">{porVencer}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Vencidos</dt>
            <dd className="font-medium mt-0.5">{vencidos}</dd>
          </div>
        </dl>

        {pendientes > 0 && (
          <p className="text-xs text-muted-foreground">
            {pendientes} documento{pendientes > 1 ? 's' : ''} pendiente{pendientes > 1 ? 's' : ''} de anclaje en red.
          </p>
        )}

        <CopyVerifyLink path={`/verify/vendor/${vendor.id}`} />

        <VendorComplianceSummary status={status} reasons={reasons} />
      </section>

      <section className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <ShieldCheck size={15} className="text-primary" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-foreground">Documentos</h2>
        </div>
        {documents.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">Sin documentos registrados.</p>
        ) : (
          <ul role="list">
            {documents.map(doc => (
              <PassportDocumentRow key={doc.id} doc={doc} />
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add components/vendor-pass/passport-document-row.tsx components/vendor-pass/vendor-passport-view.tsx
git commit -m "feat(passport): componentes VendorPassportView y PassportDocumentRow"
```

---

## Task 5: Extender la página pública `/verify/vendor/[id]`

La página **ya existe** (`app/verify/vendor/[id]/page.tsx`): hoy llama a `resolveVendorPassport(vendorId)`, calcula `vigentes/porVencer/vencidos` inline y renderiza la cabecera, banners, `CopyVerifyLink` y la lista de documentos con un `<li>` por documento. La refactorizamos para usar el **builder compartido** (`buildVendorPassport`) y `VendorPassportView`, conservando: `noindex`, `force-dynamic`, el título y los dos banners de modo memoria.

**Files:**
- Modify: `app/verify/vendor/[id]/page.tsx`

- [ ] **Step 1: Reemplazar imports y cuerpo**

Reemplazá el archivo `app/verify/vendor/[id]/page.tsx` completo por:

```tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { buildVendorPassport } from '@/lib/passport/build-vendor-passport';
import { getStoreSource } from '@/lib/arkiv/validations';
import { PublicShell } from '@/components/vendor-pass/public-shell';
import { VendorPassportView } from '@/components/vendor-pass/vendor-passport-view';
import { AlertCircle } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Pasaporte del proveedor — VendorPass',
  robots: { index: false, follow: false },
};

export default async function VerifyVendorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: vendorId } = await params;
  const passport = await buildVendorPassport(vendorId);
  const storeSource = getStoreSource();

  if (!passport) notFound();

  return (
    <PublicShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">Pasaporte del proveedor</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Estado de cumplimiento documental verificable
          </p>
        </div>

        {passport.resolvedFrom === 'postgres' && storeSource === 'memory' && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-secondary border border-border">
            <AlertCircle size={18} className="text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">
              Datos desde la base de aplicación. Ejecuta sincronización Arkiv para registro verificable en red.
            </p>
          </div>
        )}

        {storeSource === 'memory' && passport.resolvedFrom === 'store' && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-secondary border border-border">
            <AlertCircle size={18} className="text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">
              Modo desarrollo: datos en memoria local. Configura{' '}
              <code className="text-xs">ARKIV_RPC_URL</code> y{' '}
              <code className="text-xs">ARKIV_PRIVATE_KEY</code> para verificación en red Arkiv.
            </p>
          </div>
        )}

        <VendorPassportView passport={passport} />
      </div>
    </PublicShell>
  );
}
```

> **Qué cambió respecto del original:** se elimina la dependencia de `resolveVendorPassport`, `StatusBadge`, `VendorComplianceSummary`, `CopyVerifyLink`, `Link` y los iconos de cabecera/lista (ahora viven en `VendorPassportView`/`PassportDocumentRow`); se elimina el cálculo inline de `vigentes/porVencer/vencidos` y el `<section>` de documentos. Se conservan: `force-dynamic`, `metadata` con `robots.index:false`, el `<h1>` y los **dos banners** de modo memoria (idénticos). El parámetro de ruta sigue siendo `[id]`.

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Smoke test visual**

Run: `npm run dev` y abrí `http://localhost:3000/verify/vendor/<id-real>` sin sesión.
Expected: carga sin login; lista documentos con badge de estado; los no anclados muestran "Pendiente de anclaje"; el botón "Copiar" del enlace funciona.

- [ ] **Step 4: Commit**

```bash
git add "app/verify/vendor/[id]/page.tsx"
git commit -m "refactor(passport): página pública usa builder compartido + VendorPassportView"
```

---

## Task 6: API JSON espejo `GET /api/verify/vendor/[id]`

Espejo público del pasaporte, siguiendo el patrón de `app/api/verify/[documentId]/route.ts` (que devuelve `{ found, source, entityKey, validation }`). Acá devolvemos `{ found, source, passport }`.

**Files:**
- Create: `app/api/verify/vendor/[id]/route.ts`

- [ ] **Step 1: Crear el endpoint**

Create `app/api/verify/vendor/[id]/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { buildVendorPassport } from '@/lib/passport/build-vendor-passport';
import { getStoreSource } from '@/lib/arkiv/validations';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const passport = await buildVendorPassport(id);

  if (!passport) {
    return NextResponse.json({ found: false, source: getStoreSource() }, { status: 404 });
  }

  return NextResponse.json({
    found: true,
    source: getStoreSource(),
    passport,
  });
}
```

> **Privacidad:** el shape de `passport` ya viene filtrado por el builder (sin `owner_email`, notas ni URLs S3). El endpoint no agrega nada sensible.

- [ ] **Step 2: Verificar tipos + smoke test**

Run: `npx tsc --noEmit`
Expected: PASS

Run: `curl -s http://localhost:3000/api/verify/vendor/<id-real> | head`
Expected: `200` con `{"found":true,"source":"…","passport":{…}}`; `curl` a un id inexistente → `404` con `{"found":false,…}`.

- [ ] **Step 3: Commit**

```bash
git add "app/api/verify/vendor/[id]/route.ts"
git commit -m "feat(api): GET /api/verify/vendor/[id] espejo JSON del pasaporte"
```

---

## Task 7: PDF — `render-pdf.ts` + route `passport.pdf`

Render del PDF con `@react-pdf/renderer` (`renderToBuffer`) en un route handler Node autenticado con `requireUser()`. El PDF incluye nombre/organización, fecha de emisión ("Estado al …"), tabla de documentos (con marca de anclado/pendiente y `entityKey` cuando exista), el QR a la URL pública y el pie "Verificado en Arkiv Network".

**Files:**
- Create: `lib/passport/render-pdf.ts`
- Create: `app/api/vendors/[id]/passport.pdf/route.ts`

- [ ] **Step 1: Crear el render del PDF**

Create `lib/passport/render-pdf.ts`:

```tsx
import { Document, Page, Text, View, Image, StyleSheet, renderToBuffer } from '@react-pdf/renderer';
import { createElement } from 'react';
import type { VendorPassportData } from '@/lib/passport/build-vendor-passport';

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, color: '#1a1a1a', fontFamily: 'Helvetica' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  org: { fontSize: 14, fontWeight: 'bold' },
  subtitle: { fontSize: 9, color: '#666', marginTop: 2 },
  qr: { width: 90, height: 90 },
  vendorName: { fontSize: 16, fontWeight: 'bold', marginBottom: 2 },
  meta: { fontSize: 9, color: '#666', marginBottom: 12 },
  statusPill: { fontSize: 10, fontWeight: 'bold', marginBottom: 12 },
  tableHeader: { flexDirection: 'row', borderBottom: 1, borderColor: '#ccc', paddingBottom: 4, marginBottom: 4 },
  row: { flexDirection: 'row', paddingVertical: 4, borderBottom: 0.5, borderColor: '#eee' },
  cName: { width: '34%' },
  cType: { width: '20%' },
  cExp: { width: '16%' },
  cStatus: { width: '14%' },
  cAnchor: { width: '16%' },
  cell: { fontSize: 9 },
  mono: { fontSize: 6, color: '#888', marginTop: 1 },
  footer: { position: 'absolute', bottom: 28, left: 36, right: 36, borderTop: 1, borderColor: '#ccc', paddingTop: 8 },
  footerText: { fontSize: 8, color: '#666' },
});

const STATUS_LABEL: Record<string, string> = {
  vigente: 'Vigente',
  por_vencer: 'Por vencer',
  vencido: 'Vencido',
};

const VENDOR_STATUS_LABEL: Record<string, string> = {
  ok: 'Cumple',
  atencion: 'Requiere atención',
  bloqueado: 'Bloqueado',
};

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('es-MX', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export interface PassportPdfInput {
  passport: VendorPassportData;
  qrDataUrl: string;
  organization: string | null;
}

export async function renderPassportPdf(input: PassportPdfInput): Promise<Buffer> {
  const { passport, qrDataUrl, organization } = input;
  const e = createElement;

  const headerCells = e(View, { style: styles.tableHeader }, [
    e(Text, { key: 'n', style: [styles.cell, styles.cName] }, 'Documento'),
    e(Text, { key: 't', style: [styles.cell, styles.cType] }, 'Tipo'),
    e(Text, { key: 'x', style: [styles.cell, styles.cExp] }, 'Vence'),
    e(Text, { key: 's', style: [styles.cell, styles.cStatus] }, 'Estado'),
    e(Text, { key: 'a', style: [styles.cell, styles.cAnchor] }, 'Anclaje'),
  ]);

  const rows = passport.documents.map(doc =>
    e(View, { key: doc.id, style: styles.row }, [
      e(View, { key: 'n', style: styles.cName }, [
        e(Text, { key: 'nm', style: styles.cell }, doc.documentName),
        doc.entityKey ? e(Text, { key: 'ek', style: styles.mono }, doc.entityKey) : null,
      ]),
      e(Text, { key: 't', style: [styles.cell, styles.cType] }, doc.documentType),
      e(Text, { key: 'x', style: [styles.cell, styles.cExp] }, formatDate(doc.expiresAt)),
      e(Text, { key: 's', style: [styles.cell, styles.cStatus] }, STATUS_LABEL[doc.status] ?? doc.status),
      e(
        Text,
        { key: 'a', style: [styles.cell, styles.cAnchor] },
        doc.lifecycle === 'anchored' ? 'En red' : doc.lifecycle === 'draft' ? 'Borrador' : 'Pendiente',
      ),
    ]),
  );

  const doc = e(Document, {}, e(Page, { size: 'A4', style: styles.page }, [
    e(View, { key: 'h', style: styles.header }, [
      e(View, { key: 'l' }, [
        e(Text, { key: 'o', style: styles.org }, organization ?? 'VendorPass'),
        e(Text, { key: 's', style: styles.subtitle }, 'Pasaporte de cumplimiento verificable'),
      ]),
      e(Image, { key: 'qr', style: styles.qr, src: qrDataUrl }),
    ]),
    e(Text, { key: 'vn', style: styles.vendorName }, passport.vendor.name),
    e(
      Text,
      { key: 'vm', style: styles.meta },
      [passport.vendor.category, passport.vendor.area].filter(Boolean).join(' · '),
    ),
    e(
      Text,
      { key: 'st', style: styles.statusPill },
      `Estado general: ${VENDOR_STATUS_LABEL[passport.status] ?? passport.status}`,
    ),
    e(
      Text,
      { key: 'gen', style: styles.meta },
      `Estado al ${new Date(passport.generatedAt).toLocaleString('es-MX')}`,
    ),
    headerCells,
    ...rows,
    e(View, { key: 'f', style: styles.footer }, [
      e(
        Text,
        { key: 'ft', style: styles.footerText },
        'Verificado en Arkiv Network. Escaneá el código QR para consultar el estado vigente en línea. Esta es una attestación técnica del estado registrado, no una validez legal.',
      ),
    ]),
  ]));

  return renderToBuffer(doc);
}
```

> **Por qué `createElement` y no JSX literal:** el render se hace en un módulo `.tsx` de servidor; usar `createElement` evita ambigüedades de pragma JSX en módulos que no son componentes de React. `renderToBuffer` corre solo en Node (el route lo fuerza con `runtime = 'nodejs'`).

- [ ] **Step 2: Crear el route del PDF**

Create `app/api/vendors/[id]/passport.pdf/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/api-auth';
import { buildVendorPassport } from '@/lib/passport/build-vendor-passport';
import { renderPassportPdf } from '@/lib/passport/render-pdf';
import { buildVerifyUrl, generateQrDataUrl } from '@/lib/passport/qr';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { id } = await params;

  // requireUser() usa el cliente con RLS: si el proveedor no es del usuario, no aparece.
  const { data: owned } = await auth.supabase.from('vendors').select('id').eq('id', id).maybeSingle();
  if (!owned) return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 });

  const passport = await buildVendorPassport(id);
  if (!passport) return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 });

  // Nombre de la organización del perfil, si existe la tabla/columna (degradación elegante).
  let organization: string | null = null;
  try {
    const { data: profile } = await auth.supabase
      .from('profiles')
      .select('organization')
      .eq('id', auth.user.id)
      .maybeSingle();
    organization = (profile as { organization?: string | null } | null)?.organization ?? null;
  } catch {
    organization = null;
  }

  const qrDataUrl = await generateQrDataUrl(buildVerifyUrl(id));
  const pdf = await renderPassportPdf({ passport, qrDataUrl, organization });

  const safeName = passport.vendor.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="pasaporte-${safeName}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}
```

> **Privacidad/seguridad:** el PDF es **autenticado** (`requireUser`) y se confirma la propiedad del proveedor con el cliente RLS antes de generar. El `buildVendorPassport` ya filtra datos sensibles, así que el contenido del PDF es el mismo dataset que el pasaporte público.

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Smoke test del PDF**

Con sesión activa en el navegador, abrí `http://localhost:3000/api/vendors/<id-real>/passport.pdf`.
Expected: se descarga `pasaporte-<vendor>.pdf`; al abrirlo se ve el nombre del proveedor, la tabla de documentos con columna "Anclaje", el QR arriba a la derecha y el pie "Verificado en Arkiv Network". Escaneá el QR: abre `/verify/vendor/<id>`.

- [ ] **Step 5: Commit**

```bash
git add lib/passport/render-pdf.ts "app/api/vendors/[id]/passport.pdf/route.ts"
git commit -m "feat(passport): PDF descargable con QR y pie Arkiv (route autenticado)"
```

---

## Task 8: UI del detalle de proveedor — Pasaporte, PDF y Copiar enlace

En `app/vendors/[id]/page.tsx` ya existe un botón "Pasaporte" que enlaza a `/verify/vendor/${v.id}`. Lo dejamos y agregamos junto a él **"Descargar PDF"** (enlace al route del PDF) y **"Copiar enlace"** (reutiliza `CopyVerifyLink`). Como `CopyVerifyLink` es un componente cliente y la página es un Server Component, lo ubicamos dentro de la sección de info (no en `actions`, que es JSX de botones).

**Files:**
- Modify: `app/vendors/[id]/page.tsx`

- [ ] **Step 1: Importar `CopyVerifyLink` y el icono**

En `app/vendors/[id]/page.tsx`, agregá a los imports existentes:

```tsx
import { CopyVerifyLink } from '@/components/vendor-pass/copy-verify-link';
```

Y en el import de iconos de `lucide-react` (línea 12), agregá `Download`:

```tsx
import { Building2, Mail, User, MapPin, Calendar, Plus, Pencil, ShieldCheck, Download } from 'lucide-react';
```

- [ ] **Step 2: Agregar el botón "Descargar PDF" en `actions`**

Reemplazá el bloque de `actions` (las dos `<Button>` actuales de "Pasaporte" y "Editar") por:

```tsx
          actions={
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href={`/verify/vendor/${v.id}`} className="inline-flex items-center gap-1.5">
                  <ShieldCheck size={13} aria-hidden="true" />
                  Pasaporte
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a
                  href={`/api/vendors/${v.id}/passport.pdf`}
                  className="inline-flex items-center gap-1.5"
                >
                  <Download size={13} aria-hidden="true" />
                  Descargar PDF
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/vendors/${v.id}/edit`} className="inline-flex items-center gap-1.5">
                  <Pencil size={13} aria-hidden="true" />
                  Editar
                </Link>
              </Button>
            </div>
          }
```

> Se usa `<a href>` (no `<Link>`) para el PDF porque es una descarga de un route handler, no una navegación de cliente de Next.

- [ ] **Step 3: Agregar "Copiar enlace" del pasaporte**

Justo **después** del `<VendorComplianceSummary status={status} reasons={reasons} />` (línea 102) y antes del bloque de badges `{(vencidos > 0 || porVencer > 0) && (`, insertá:

```tsx
        <div className="bg-card border border-border rounded-xl p-4">
          <CopyVerifyLink path={`/verify/vendor/${v.id}`} />
        </div>
```

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Smoke test**

Run: `npm run dev`, login, abrí el detalle de un proveedor.
Expected: en el header aparecen "Pasaporte", "Descargar PDF" y "Editar"; "Descargar PDF" baja el PDF; "Copiar enlace" copia la URL `/verify/vendor/<id>`.

- [ ] **Step 6: Commit**

```bash
git add "app/vendors/[id]/page.tsx"
git commit -m "feat(passport): detalle de proveedor con descarga de PDF y copia de enlace del pasaporte"
```

---

## Task 9: Verificación end-to-end

**Files:** ninguno (verificación manual + suite)

- [ ] **Step 1: Suite + arranque**

Run: `npm test && npm run dev`
Expected: tests en verde (incluye `tests/passport.build.test.ts`); dev server en `http://localhost:3000`.

- [ ] **Step 2: Pasaporte público sin login**

Abrí en una ventana privada `http://localhost:3000/verify/vendor/<id-real>`.
Expected: carga sin pedir login; estado agregado coherente con Arkiv; documentos anclados con badge "Anclado en red"; documentos sin entidad Arkiv con badge "Pendiente de anclaje" (no aparecen como vigentes en silencio).

- [ ] **Step 3: API JSON**

Run: `curl -s http://localhost:3000/api/verify/vendor/<id-real> | python3 -m json.tool | head -40`
Expected: `found: true`, `passport.documents[*]` con `lifecycle` y `status`; **sin** campos `owner_email`, `notes` ni `fileUrl`.

- [ ] **Step 4: PDF + QR**

Con sesión, descargá `http://localhost:3000/api/vendors/<id-real>/passport.pdf`.
Expected: PDF con organización/proveedor, "Estado al …", tabla con columna "Anclaje", QR y pie Arkiv. Escaneá el QR → abre `/verify/vendor/<id>` (la misma URL del pasaporte público).

- [ ] **Step 5: Aislamiento**

Sin sesión, `curl -i http://localhost:3000/api/vendors/<id-real>/passport.pdf`.
Expected: `401` (PDF es autenticado). Con sesión de **otro** usuario sobre un id ajeno → `404`.

- [ ] **Step 6: Documento pendiente**

En un proveedor con un documento que **no** esté anclado en Arkiv (o con Arkiv en modo memoria sin sincronizar), verificá que en la página pública y en el PDF figura como "Pendiente de anclaje" / "Pendiente", nunca como vigente sin marca.

- [ ] **Step 7: Commit final (si hubo ajustes)**

```bash
git add -A
git commit -m "chore(passport): ajustes finales tras verificación end-to-end"
```

---

## Criterios de aceptación

- [ ] `/verify/vendor/{id}` carga **sin login** y lista los documentos con estado coherente con Arkiv (estado on-chain prevalece sobre Postgres cuando el documento está anclado).
- [ ] El **PDF** incluye un **QR válido** que abre la misma URL pública del pasaporte.
- [ ] Un documento **no anclado** aparece como **pendiente de anclaje** (badge gris en la web, "Pendiente" en el PDF), no como vigente silencioso.
- [ ] **No se filtran** datos de la cuenta del dueño del tenant: ni `owner_email`, ni notas internas, ni URLs S3 largas (verificado en el JSON de la API y en el contenido del PDF; cubierto por el test de privacidad del builder).
- [ ] El PDF se **regenera en cada descarga** (`force-dynamic` + `Cache-Control: no-store`), recalculando el estado desde Arkiv.
- [ ] La página pública mantiene `robots noindex` (como `/verify/[documentId]`).

---

## Self-Review

**1. Cobertura del objetivo:**
- ✅ Pasaporte público con lista de documentos y estado agregado → Task 5 (página) + Task 4 (`VendorPassportView`/`PassportDocumentRow`) sobre el builder de Task 2.
- ✅ Distingue anclado vs pendiente (lifecycle Feature 2) → Task 2 (`assemblePassport` deriva `anchored`/`pending_anchor`/`draft`; test "marca como pendiente…" y "respeta lifecycle_status=draft").
- ✅ Fuente Arkiv preferida; degradación a Postgres → Task 2 (`buildVendorPassport` envuelve `getStore().listByVendor` en try/catch; test "si Arkiv no está disponible…").
- ✅ Tarjeta por documento con enlace a `/verify/{documentId}` y badge de hash → Task 4 (`PassportDocumentRow`: enlace "Verificar" + badge "Hash registrado").
- ✅ API JSON espejo → Task 6 (`GET /api/verify/vendor/[id]`, patrón de `/api/verify/[documentId]`).
- ✅ PDF descargable con logo/org, fecha, tabla, QR y pie Arkiv → Task 7 (`render-pdf.ts` + route `passport.pdf`); organización vía `profiles.organization` con degradación elegante.
- ✅ QR de la URL absoluta con `NEXT_PUBLIC_APP_URL` → Task 3 (`buildVerifyUrl` + `generateQrDataUrl`); Task 1 confirma la env.
- ✅ UI autenticada: botón Pasaporte completo + Descargar PDF + Copiar enlace → Task 8.
- ✅ Privacidad: sin `owner_email`/notas/URLs S3 → Task 2 (shape filtrado + test de privacidad); reforzado en API (Task 6) y PDF (Task 7, mismo dataset).
- ✅ No regenera migración → Task 2 deriva el lifecycle de la presencia en Arkiv y respeta `lifecycle_status` solo si la columna existe.

**2. Placeholders:** sin TODOs ni stubs. Todo el código de cada Task es completo y compilable. La única ruta condicional es la consulta a `profiles.organization`, envuelta en try/catch para degradar a `null` si la tabla/columna no existe (Feature de perfil opcional).

**3. Consistencia de tipos/nombres:** `VendorPassportData`/`PassportDocument`/`PassportLifecycle` (Task 2) se consumen idénticos en `VendorPassportView`/`PassportDocumentRow` (Task 4), la página (Task 5), la API (Task 6) y el PDF (Task 7). `assemblePassport` (puro, testeado) y `buildVendorPassport` (I/O) comparten shape. `buildVerifyUrl`/`generateQrDataUrl` (Task 3) se usan en el route del PDF (Task 7). `CopyVerifyLink` se invoca con la prop `path` (verificado: el componente acepta `path?` además de `documentId?`). El estado on-chain de Arkiv prevalece tanto en el agregado (`resolvedForStatus`) como por documento (`status`), evitando incoherencias entre badge agregado y filas. El parámetro de ruta de la página y la API es `[id]` (coincide con la página existente). El route del PDF usa `requireUser()` y `params: Promise<{id}>` como el resto de routes dinámicos del repo.

**4. Hechos del código verificados (Read antes de escribir):**
- La página pública hoy usa `resolveVendorPassport` (en `lib/arkiv/vendor-lookup.ts`), no `getStore().listByVendor` directo; el plan introduce `buildVendorPassport` como reemplazo con shape filtrado y lifecycle, y deja `resolveVendorPassport` intacto (sin romper otros consumidores).
- `ValidationEntity` no tiene `entityKey` por entidad (vive en `ValidationLookup`); el builder lo deja en `null` y la UI/PDF lo muestran solo si no es `null` (no condiciona el badge "anclado").
- `CopyVerifyLink` acepta `path?: string` (además de `documentId?`), confirmado en su fuente.
- `requireUser()` devuelve `{ user, supabase, error }` y el `supabase` respeta RLS por cookie → válido para confirmar propiedad del proveedor antes de emitir el PDF.
- `NEXT_PUBLIC_APP_URL` ya existe en `.env.example` (línea 25).

---

## Stretch opcional (fuera del MVP)

- **PDF público con token (Feature 1.2):** variante de `passport.pdf` accesible sin sesión mediante un token firmado de un solo uso, para compartir el PDF con un auditor externo sin darle cuenta.
- **"Último anclaje" (Feature 4):** mostrar en la fila y en el PDF la fecha del último evento de anclaje desde los eventos de Arkiv (`syncedAt` de la entidad como aproximación inmediata).
- **"Verificar archivo" por hash (Feature 3):** en cada fila, un control para subir el archivo y comparar su SHA-256 con `fileHash` de la entidad anclada, marcando coincidencia/diferencia.
- **Logo de organización en el PDF:** si `profiles` guarda una URL/asset de logo, embeberlo como `<Image>` junto al nombre de la organización.
