# Ciclo de vida del documento + Anclaje en Arkiv — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separar los **datos operativos** (un borrador editable en Postgres) del **compromiso verificable** (la escritura en Arkiv). Hoy `POST /api/documents` hace `insert` + `upsert` en Arkiv en la misma petición, así que "Guardar" ya ancla en la cadena. Esta feature introduce tres estados de ciclo de vida (`draft` → `pending_anchor` → `anchored`): crear un documento queda en **borrador** sin tocar Arkiv; el anclaje pasa a ser una **acción explícita** (`POST /api/documents/{id}/anchor`) tras la revisión humana; y una vez anclado, los campos clave (`issued_at`, `expires_at`, `file_hash`, `document_type`) son **inmutables** salvo renovación (Feature 4). El cron de sync sigue actualizando solo el `status` de las entidades ancladas sin borrar historial.

**Architecture:** Tres columnas nuevas en `documents`: `lifecycle_status text` (`'draft' | 'pending_anchor' | 'anchored'`, default `'draft'`), `anchored_at timestamptz` y `arkiv_entity_key text` (cache del `entityKey` que devuelve Arkiv). Las **transiciones de estado** y los predicados `canEdit(doc)` / `canAnchor(doc)` viven en `lib/documents/lifecycle.ts` como **funciones puras** (TDD). El anclaje se encapsula en `lib/arkiv/anchor.ts` (`anchorDocument(doc, vendor)`): recalcula `documentStatus`, hace `upsert` en el store de validaciones, persiste `arkiv_entity_key` + `anchored_at` + `lifecycle_status='anchored'`. `POST /api/documents` deja de escribir en Arkiv (crea en `draft`); `PUT /api/documents/[id]` bloquea cambios de campos inmutables sobre documentos anclados con `409`. La UI gana dos CTAs en el alta ("Guardar borrador") y una acción "Anclar en Arkiv" en el detalle del proveedor, más badges de ciclo de vida en la lista de documentos. La paridad (`auditArkivParity`) ignora los `draft` (no deben estar en Arkiv). Un flag de compatibilidad opcional `ANCHOR_ON_SAVE=true` ancla al guardar para demos (NO producción).

**Tech Stack:** Next.js 16.2.6 (App Router, route handlers con `params: Promise<…>`), Supabase (`@supabase/ssr`, RLS por cookie, service-role para sync), el store de validaciones Arkiv (`lib/arkiv/validations.ts`, doble backend arkiv/memoria), TypeScript, Vitest. Sin dependencias nuevas.

**Dependencias:** Es la BASE de las otras 4 features (no depende de ninguna). Se integra con el plan de IA (2026-05-28-ai-document-intelligence.md): la IA precarga el borrador, el anchor ocurre tras revisión humana.

---

## Convenciones compartidas (las 5 features comparten este rediseño de ciclo de vida)

- **Lifecycle (ESTA feature lo introduce):** columna Postgres `lifecycle_status text` con valores `'draft' | 'pending_anchor' | 'anchored'` (default `'draft'`); + `anchored_at timestamptz`, `arkiv_entity_key text`.
- **Campos inmutables tras anchor:** `issued_at`, `expires_at`, `file_hash`, `document_type` (cambios requieren renovación/supersede — Feature 4).
- **Arkiv:** `ENTITY_TYPE = 'vendor_document_validation'` (en `lib/arkiv/client.ts`).
- **Numeración de migración:** en este repo las migraciones ya llegan a `0006_api_keys.sql`, así que esta es `0007_document_lifecycle.sql`. Orden relativo entre las features de este set: **F2 = 0007 < F4 = 0008 < F5 = 0009.**

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `supabase/migrations/0007_document_lifecycle.sql` (crear) | Columnas `lifecycle_status`, `anchored_at`, `arkiv_entity_key` + índice |
| `lib/types.ts` (modificar) | Extender `VendorDocument` con `lifecycle_status`, `anchored_at`, `arkiv_entity_key`; tipo `LifecycleStatus` |
| `lib/documents/lifecycle.ts` (crear) | Transiciones válidas, `canEdit(doc)`, `canAnchor(doc)`, `immutableFieldsChanged(...)` (funciones puras) |
| `tests/document-lifecycle.test.ts` (crear) | Tests de transiciones, `canEdit`, `canAnchor`, `immutableFieldsChanged` |
| `lib/arkiv/anchor.ts` (crear) | `anchorDocument(supabase, doc, vendor)`: upsert Arkiv + persistir `arkiv_entity_key`/`anchored_at`/`lifecycle_status` |
| `app/api/documents/route.ts` (modificar) | `POST` crea en `draft` (o `pending_anchor`); ya NO escribe en Arkiv salvo `ANCHOR_ON_SAVE` |
| `app/api/documents/[id]/route.ts` (modificar) | `PUT` bloquea campos inmutables si `anchored` (`409`); re-ancla solo si ya estaba `anchored` |
| `app/api/documents/[id]/anchor/route.ts` (crear) | `POST` ancla un documento tras revisión humana |
| `lib/arkiv/verify-parity.ts` (modificar) | Ignorar `draft`/`pending_anchor`: no se esperan en Arkiv (`expectedMissingInArkiv`) |
| `lib/arkiv/sync.ts` (modificar) | Sync masivo solo de documentos `anchored`; reportar `pendingAnchor` |
| `components/vendor-pass/document-form.tsx` (modificar) | Dos CTAs: "Guardar borrador" y "Guardar y anclar"; pasar `lifecycle_status` en el POST |
| `components/vendor-pass/document-list.tsx` (modificar) | Badge de ciclo de vida (Borrador / Listo para anclar / Anclado en Arkiv) |
| `components/vendor-pass/anchor-document-button.tsx` (crear) | Botón cliente "Anclar en Arkiv" que llama al endpoint de anchor |
| `app/vendors/[id]/page.tsx` (modificar) | Mostrar la acción "Anclar" en cada documento no anclado |
| `tests/arkiv.parity.test.ts` (modificar) | Verificar que los `draft` no cuentan como `missingInArkiv` |
| `.env.example` (modificar) | Documentar `ANCHOR_ON_SAVE` (modo compatibilidad, NO producción) |

---

## Task 1: Migración — ciclo de vida del documento

> **Nota de numeración:** este archivo es `0007_document_lifecycle.sql` (el siguiente libre tras `0006_api_keys.sql`). Mantené el orden **F2 (0007) < F4 (0008) < F5 (0009)**.

**Files:**
- Create: `supabase/migrations/0007_document_lifecycle.sql`

- [ ] **Step 1: Escribir la migración**

Create `supabase/migrations/0007_document_lifecycle.sql`:

```sql
-- Ciclo de vida del documento: borrador en Postgres → anclaje explícito en Arkiv.
alter table public.documents
  add column if not exists lifecycle_status text not null default 'draft'
    check (lifecycle_status in ('draft', 'pending_anchor', 'anchored')),
  add column if not exists anchored_at timestamptz,
  add column if not exists arkiv_entity_key text;

-- Filtro frecuente: sync masivo y auditoría solo miran documentos anclados.
create index if not exists documents_lifecycle_status_idx
  on public.documents(lifecycle_status);

-- Los documentos preexistentes (creados con el flujo viejo insert+upsert) ya están en
-- Arkiv: márcalos como anclados para no romper la paridad ni el sync.
update public.documents
  set lifecycle_status = 'anchored',
      anchored_at = coalesce(anchored_at, updated_at)
  where lifecycle_status = 'draft';
```

- [ ] **Step 2: Aplicar la migración**

Run: `npx supabase migration up`
(alternativa que **borra datos** en local: `npx supabase db reset`)
Expected: se aplica sin errores.

- [ ] **Step 3: Verificar las columnas**

En el SQL editor de Supabase (o `psql`):
`select lifecycle_status, anchored_at, arkiv_entity_key from public.documents limit 1;`
Expected: las tres columnas existen; los documentos previos quedaron en `anchored`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0007_document_lifecycle.sql
git commit -m "feat(db): ciclo de vida del documento (lifecycle_status, anchored_at, arkiv_entity_key)"
```

---

## Task 2: Tipos — `LifecycleStatus` y extensión de `VendorDocument`

**Files:**
- Modify: `lib/types.ts`

- [ ] **Step 1: Añadir el tipo y extender `VendorDocument`**

In `lib/types.ts`, después de la línea `export type VendorStatus = 'ok' | 'atencion' | 'bloqueado';` añadí:

```typescript
export type LifecycleStatus = 'draft' | 'pending_anchor' | 'anchored';
```

Y dentro de la interface `VendorDocument`, después de `updated_at: string;`, añadí los tres campos:

```typescript
  lifecycle_status: LifecycleStatus;
  anchored_at: string | null;
  arkiv_entity_key: string | null;
```

(El bloque queda así:)

```typescript
export interface VendorDocument {
  id: string;
  vendor_id: string;
  document_type: string;
  document_name: string;
  issued_at: string;
  expires_at: string;
  criticality: Criticality;
  file_url: string | null;
  file_hash: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  lifecycle_status: LifecycleStatus;
  anchored_at: string | null;
  arkiv_entity_key: string | null;
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add lib/types.ts
git commit -m "feat(types): LifecycleStatus y campos de ciclo de vida en VendorDocument"
```

---

## Task 3: `lib/documents/lifecycle.ts` — transiciones y predicados (TDD)

Funciones puras: las transiciones válidas del ciclo de vida, qué se puede editar y qué se puede anclar, y la detección de cambios en campos inmutables.

**Files:**
- Create: `lib/documents/lifecycle.ts`
- Test: `tests/document-lifecycle.test.ts`

- [ ] **Step 1: Escribir los tests que fallan**

Create `tests/document-lifecycle.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  IMMUTABLE_FIELDS,
  canAnchor,
  canEdit,
  canTransition,
  immutableFieldsChanged,
} from '@/lib/documents/lifecycle';
import type { VendorDocument } from '@/lib/types';

function doc(overrides: Partial<VendorDocument> = {}): VendorDocument {
  return {
    id: 'd1',
    vendor_id: 'v1',
    document_type: 'art',
    document_name: 'Póliza ART',
    issued_at: '2025-01-01',
    expires_at: '2026-01-01',
    criticality: 'critical',
    file_url: 'https://s3/x.pdf',
    file_hash: 'abc123',
    notes: null,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    lifecycle_status: 'draft',
    anchored_at: null,
    arkiv_entity_key: null,
    ...overrides,
  };
}

describe('canTransition', () => {
  it('permite draft → pending_anchor, draft → anchored, pending_anchor → anchored', () => {
    expect(canTransition('draft', 'pending_anchor')).toBe(true);
    expect(canTransition('draft', 'anchored')).toBe(true);
    expect(canTransition('pending_anchor', 'anchored')).toBe(true);
  });
  it('permite volver a borrador desde pending_anchor', () => {
    expect(canTransition('pending_anchor', 'draft')).toBe(true);
  });
  it('rechaza salir de anchored (inmutable salvo renovación — Feature 4)', () => {
    expect(canTransition('anchored', 'draft')).toBe(false);
    expect(canTransition('anchored', 'pending_anchor')).toBe(false);
  });
  it('rechaza transiciones a sí mismo', () => {
    expect(canTransition('draft', 'draft')).toBe(false);
  });
});

describe('canEdit', () => {
  it('un borrador se edita libremente', () => {
    expect(canEdit(doc({ lifecycle_status: 'draft' }))).toBe(true);
  });
  it('un documento listo para anclar no se edita (solo volver a borrador)', () => {
    expect(canEdit(doc({ lifecycle_status: 'pending_anchor' }))).toBe(false);
  });
  it('un documento anclado no se edita (campos inmutables)', () => {
    expect(canEdit(doc({ lifecycle_status: 'anchored' }))).toBe(false);
  });
});

describe('canAnchor', () => {
  it('se puede anclar un borrador con archivo y hash', () => {
    expect(canAnchor(doc({ lifecycle_status: 'draft' })).ok).toBe(true);
  });
  it('se puede anclar un pending_anchor', () => {
    expect(canAnchor(doc({ lifecycle_status: 'pending_anchor' })).ok).toBe(true);
  });
  it('no se puede re-anclar un documento ya anclado', () => {
    const r = canAnchor(doc({ lifecycle_status: 'anchored' }));
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/anclado/i);
  });
  it('no se puede anclar sin hash de archivo', () => {
    const r = canAnchor(doc({ file_hash: null }));
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/hash|evidencia|archivo/i);
  });
});

describe('immutableFieldsChanged', () => {
  it('detecta cambios en campos inmutables', () => {
    const current = doc();
    expect(immutableFieldsChanged(current, { expires_at: '2027-01-01' })).toEqual(['expires_at']);
    expect(immutableFieldsChanged(current, { document_type: 'seguro' })).toEqual(['document_type']);
  });
  it('ignora cambios en campos mutables (notas)', () => {
    const current = doc();
    expect(immutableFieldsChanged(current, { notes: 'nueva nota' })).toEqual([]);
  });
  it('no reporta cambios si el valor es idéntico', () => {
    const current = doc();
    expect(immutableFieldsChanged(current, { expires_at: '2026-01-01' })).toEqual([]);
  });
  it('IMMUTABLE_FIELDS contiene los cuatro campos clave', () => {
    expect([...IMMUTABLE_FIELDS].sort()).toEqual(
      ['document_type', 'expires_at', 'file_hash', 'issued_at'].sort(),
    );
  });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `npx vitest run tests/document-lifecycle.test.ts`
Expected: FAIL con "Failed to resolve import '@/lib/documents/lifecycle'".

- [ ] **Step 3: Implementar**

Create `lib/documents/lifecycle.ts`:

```typescript
import type { LifecycleStatus, VendorDocument } from '@/lib/types';

/** Campos que quedan congelados una vez que el documento se ancló en Arkiv. */
export const IMMUTABLE_FIELDS = [
  'issued_at',
  'expires_at',
  'file_hash',
  'document_type',
] as const satisfies readonly (keyof VendorDocument)[];

type ImmutableField = (typeof IMMUTABLE_FIELDS)[number];

/** Transiciones permitidas del ciclo de vida. `anchored` es terminal (la renovación es Feature 4). */
const ALLOWED_TRANSITIONS: Record<LifecycleStatus, LifecycleStatus[]> = {
  draft: ['pending_anchor', 'anchored'],
  pending_anchor: ['anchored', 'draft'],
  anchored: [],
};

export function canTransition(from: LifecycleStatus, to: LifecycleStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/** Solo los borradores son editables libremente. */
export function canEdit(doc: Pick<VendorDocument, 'lifecycle_status'>): boolean {
  return doc.lifecycle_status === 'draft';
}

export type AnchorCheck = { ok: true } | { ok: false; reason: string };

/** Un documento puede anclarse si no está ya anclado y tiene evidencia con hash. */
export function canAnchor(
  doc: Pick<VendorDocument, 'lifecycle_status' | 'file_hash'>,
): AnchorCheck {
  if (doc.lifecycle_status === 'anchored') {
    return { ok: false, reason: 'El documento ya está anclado en Arkiv.' };
  }
  if (!doc.file_hash) {
    return { ok: false, reason: 'Falta la evidencia: no hay hash del archivo para anclar.' };
  }
  return { ok: true };
}

/** Devuelve los campos inmutables que cambiarían respecto del documento actual. */
export function immutableFieldsChanged(
  current: Pick<VendorDocument, ImmutableField>,
  patch: Partial<Record<ImmutableField, unknown>>,
): ImmutableField[] {
  return IMMUTABLE_FIELDS.filter(
    field => field in patch && patch[field] !== undefined && patch[field] !== current[field],
  );
}
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `npx vitest run tests/document-lifecycle.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/documents/lifecycle.ts tests/document-lifecycle.test.ts
git commit -m "feat(documents): transiciones de ciclo de vida y predicados con tests"
```

---

## Task 4: `lib/arkiv/anchor.ts` — encapsular el anclaje

`anchorDocument` recalcula el `status`, hace `upsert` en el store de validaciones, persiste el `entityKey` que devuelve Arkiv y marca el documento como `anchored`.

**Files:**
- Create: `lib/arkiv/anchor.ts`

- [ ] **Step 1: Crear el helper**

Create `lib/arkiv/anchor.ts`:

```typescript
import type { SupabaseClient } from '@supabase/supabase-js';
import { getStore } from '@/lib/arkiv/validations';
import { documentToValidationEntity } from '@/lib/arkiv/entity';
import { canAnchor } from '@/lib/documents/lifecycle';
import type { VendorDocument } from '@/lib/types';

type VendorInfo = {
  name?: string | null;
  owner_email?: string | null;
  owner_name?: string | null;
};

export type AnchorResult = {
  document: VendorDocument;
  arkivEntityKey: string | null;
  anchoredAt: string;
};

/**
 * Ancla un documento en Arkiv tras la confirmación humana:
 * 1) valida que sea anclable (canAnchor);
 * 2) upsert de la validación (recalcula status vía documentToValidationEntity);
 * 3) cachea el entityKey + anchored_at + lifecycle_status='anchored' en Postgres.
 */
export async function anchorDocument(
  supabase: SupabaseClient,
  doc: VendorDocument,
  vendor: VendorInfo | null | undefined,
): Promise<AnchorResult> {
  const check = canAnchor(doc);
  if (!check.ok) throw new Error(check.reason);

  const store = getStore();
  const anchoredAt = new Date().toISOString();

  // Escribe (o actualiza) la entidad de validación en Arkiv.
  await store.upsert(documentToValidationEntity(doc, vendor, anchoredAt));

  // Lee el entityKey resultante para cachearlo en Postgres (en memoria es null).
  const lookup = await store.getByDocumentId(doc.id);
  const arkivEntityKey = lookup?.entityKey ?? null;

  const { data: updated, error } = await supabase
    .from('documents')
    .update({
      lifecycle_status: 'anchored',
      anchored_at: anchoredAt,
      arkiv_entity_key: arkivEntityKey,
      updated_at: anchoredAt,
    })
    .eq('id', doc.id)
    .select()
    .single();
  if (error || !updated) throw new Error(error?.message ?? 'No se pudo persistir el anclaje');

  return { document: updated as VendorDocument, arkivEntityKey, anchoredAt };
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add lib/arkiv/anchor.ts
git commit -m "feat(arkiv): anchorDocument encapsula upsert + cache de entityKey"
```

---

## Task 5: `POST /api/documents` — crear en borrador, sin Arkiv

El alta deja de escribir en Arkiv. Crea el documento en `draft` (o `pending_anchor` si el cliente lo pide), respetando el flag de compatibilidad `ANCHOR_ON_SAVE`.

**Files:**
- Modify: `app/api/documents/route.ts`

- [ ] **Step 1: Reescribir el `POST` (el `GET` queda igual)**

Replace `app/api/documents/route.ts` con:

```typescript
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/api-auth';
import { anchorDocument } from '@/lib/arkiv/anchor';
import type { LifecycleStatus, VendorDocument } from '@/lib/types';

export async function GET() {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { data, error } = await auth.supabase
    .from('documents')
    .select('*')
    .order('expires_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ documents: data });
}

export async function POST(req: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const body = await req.json();

  // El alta crea un BORRADOR (o 'pending_anchor' si el cliente lo solicita).
  // El anclaje en Arkiv es una acción explícita posterior (POST /api/documents/[id]/anchor).
  const requested = body.lifecycle_status as LifecycleStatus | undefined;
  const lifecycle_status: LifecycleStatus =
    requested === 'pending_anchor' ? 'pending_anchor' : 'draft';

  const { data: doc, error } = await auth.supabase
    .from('documents')
    .insert({
      vendor_id: body.vendor_id,
      document_type: body.document_type,
      document_name: body.document_name,
      issued_at: body.issued_at,
      expires_at: body.expires_at,
      criticality: body.criticality,
      file_url: body.file_url ?? null,
      file_hash: body.file_hash ?? null,
      notes: body.notes ?? null,
      lifecycle_status,
    })
    .select()
    .single();
  if (error || !doc) return NextResponse.json({ error: error?.message }, { status: 400 });

  const typed = doc as VendorDocument;

  // Modo compatibilidad para demos: anclar al guardar. NO usar en producción.
  if (process.env.ANCHOR_ON_SAVE === 'true' && typed.file_hash) {
    const { data: vendor } = await auth.supabase
      .from('vendors')
      .select('name,owner_email,owner_name')
      .eq('id', typed.vendor_id)
      .single();
    try {
      const result = await anchorDocument(auth.supabase, typed, vendor);
      return NextResponse.json({ document: result.document }, { status: 201 });
    } catch {
      // Si el anclaje automático falla, el documento igual queda creado como borrador.
      return NextResponse.json({ document: typed }, { status: 201 });
    }
  }

  return NextResponse.json({ document: typed }, { status: 201 });
}
```

- [ ] **Step 2: Verificar tipos + smoke test**

Run: `npx tsc --noEmit`
Expected: PASS

Run (con el dev server arriba y una sesión, vía la UI o curl con cookie): crear un documento y confirmar en Postgres
`select lifecycle_status, anchored_at from public.documents order by created_at desc limit 1;`
Expected: `lifecycle_status = 'draft'`, `anchored_at = null` (sin `ANCHOR_ON_SAVE`).

- [ ] **Step 3: Commit**

```bash
git add app/api/documents/route.ts
git commit -m "feat(api): el alta de documentos crea borrador sin escribir en Arkiv"
```

---

## Task 6: `POST /api/documents/[id]/anchor` — anclaje explícito

**Files:**
- Create: `app/api/documents/[id]/anchor/route.ts`

- [ ] **Step 1: Crear el endpoint**

Create `app/api/documents/[id]/anchor/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/api-auth';
import { anchorDocument } from '@/lib/arkiv/anchor';
import { canAnchor } from '@/lib/documents/lifecycle';
import type { VendorDocument } from '@/lib/types';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { id } = await params;

  // RLS scopea el documento al dueño.
  const { data: doc, error } = await auth.supabase
    .from('documents')
    .select('*')
    .eq('id', id)
    .single();
  if (error || !doc) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });

  const typed = doc as VendorDocument;
  const check = canAnchor(typed);
  if (!check.ok) return NextResponse.json({ error: check.reason }, { status: 409 });

  const { data: vendor } = await auth.supabase
    .from('vendors')
    .select('name,owner_email,owner_name')
    .eq('id', typed.vendor_id)
    .single();

  try {
    const result = await anchorDocument(auth.supabase, typed, vendor);
    return NextResponse.json({
      document: result.document,
      arkiv_entity_key: result.arkivEntityKey,
      anchored_at: result.anchoredAt,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al anclar en Arkiv' },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add "app/api/documents/[id]/anchor/route.ts"
git commit -m "feat(api): endpoint de anclaje explícito en Arkiv"
```

---

## Task 7: `PUT /api/documents/[id]` — bloquear campos inmutables tras anchor

Un borrador se edita libre. Un documento anclado solo admite cambios en campos mutables (notas, nombre, criticidad); tocar `issued_at`/`expires_at`/`file_hash`/`document_type` devuelve `409`.

**Files:**
- Modify: `app/api/documents/[id]/route.ts`

- [ ] **Step 1: Reescribir el `PUT` (el `DELETE` queda igual)**

Replace `app/api/documents/[id]/route.ts` con:

```typescript
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/api-auth';
import { getStore } from '@/lib/arkiv/validations';
import { documentToValidationEntity } from '@/lib/arkiv/entity';
import { immutableFieldsChanged } from '@/lib/documents/lifecycle';
import type { VendorDocument } from '@/lib/types';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { id } = await params;
  const body = await req.json();

  // Estado actual (RLS scopea al dueño).
  const { data: current, error: readErr } = await auth.supabase
    .from('documents')
    .select('*')
    .eq('id', id)
    .single();
  if (readErr || !current) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
  const currentDoc = current as VendorDocument;

  // Si está anclado, los campos inmutables no pueden cambiar → 409 (la renovación es Feature 4).
  if (currentDoc.lifecycle_status === 'anchored') {
    const changed = immutableFieldsChanged(currentDoc, {
      document_type: body.document_type,
      issued_at: body.issued_at,
      expires_at: body.expires_at,
      file_hash: body.file_hash ?? null,
    });
    if (changed.length > 0) {
      return NextResponse.json(
        {
          error: `El documento está anclado en Arkiv: no se pueden modificar ${changed.join(', ')}. Solicitá una renovación.`,
          immutableFields: changed,
        },
        { status: 409 },
      );
    }
  }

  const { data: doc, error } = await auth.supabase
    .from('documents')
    .update({
      document_type: body.document_type,
      document_name: body.document_name,
      issued_at: body.issued_at,
      expires_at: body.expires_at,
      criticality: body.criticality,
      file_url: body.file_url ?? null,
      file_hash: body.file_hash ?? null,
      notes: body.notes ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();
  if (error || !doc) return NextResponse.json({ error: error?.message }, { status: 400 });

  const typed = doc as VendorDocument;

  // Solo re-sincronizamos Arkiv si el documento ya estaba anclado (mantener la entidad al día).
  // Los borradores NO se escriben en Arkiv hasta el anclaje explícito.
  if (typed.lifecycle_status === 'anchored') {
    const { data: vendor } = await auth.supabase
      .from('vendors')
      .select('name,owner_email,owner_name')
      .eq('id', typed.vendor_id)
      .single();
    await getStore().upsert(documentToValidationEntity(typed, vendor));
  }

  return NextResponse.json({ document: doc });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { id } = await params;
  const { error } = await auth.supabase.from('documents').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await getStore().remove(id);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add "app/api/documents/[id]/route.ts"
git commit -m "feat(api): PUT bloquea campos inmutables en documentos anclados (409)"
```

---

## Task 8: Paridad y sync — respetar el ciclo de vida

La auditoría de paridad no debe contar los borradores como "faltantes en Arkiv" (todavía no se anclaron). El sync masivo solo recorre documentos `anchored`.

**Files:**
- Modify: `lib/arkiv/verify-parity.ts`
- Modify: `lib/arkiv/sync.ts`

- [ ] **Step 1: Ignorar borradores en `auditArkivParity`**

In `lib/arkiv/verify-parity.ts`, primero ampliá el tipo de resultado. Reemplazá la definición de `ParityAuditResult` (líneas 7–14) por:

```typescript
export type ParityAuditResult = {
  postgresCount: number;
  arkivCount: number;
  missingInArkiv: string[];
  orphanInArkiv: string[];
  mismatches: Array<{ documentId: string; postgres: string; arkiv: string }>;
  expectedMissingInArkiv: string[];
  ok: boolean;
};
```

Luego, dentro de `auditArkivParity`, reemplazá el bloque del `for (const doc of postgresDocs)` y el `return` (líneas 46–72) por:

```typescript
  const missingInArkiv: string[] = [];
  const expectedMissingInArkiv: string[] = [];
  const mismatches: ParityAuditResult['mismatches'] = [];

  for (const doc of postgresDocs) {
    const arkiv = arkivById.get(doc.id);

    // Los borradores / pendientes no se esperan en Arkiv: aún no se anclaron.
    if (doc.lifecycle_status !== 'anchored') {
      if (arkiv) arkivById.delete(doc.id); // si por algún motivo está, no es huérfano
      else expectedMissingInArkiv.push(doc.id);
      continue;
    }

    const expected = documentStatus(doc);
    if (!arkiv) {
      missingInArkiv.push(doc.id);
      continue;
    }
    if (arkiv.status !== expected) {
      mismatches.push({ documentId: doc.id, postgres: expected, arkiv: arkiv.status });
    }
    arkivById.delete(doc.id);
  }

  const orphanInArkiv = [...arkivById.keys()];
  const ok = missingInArkiv.length === 0 && orphanInArkiv.length === 0 && mismatches.length === 0;

  return {
    postgresCount: postgresDocs.length,
    arkivCount: arkivEntities.length,
    missingInArkiv,
    orphanInArkiv,
    mismatches,
    expectedMissingInArkiv,
    ok,
  };
```

> **Nota:** `ok` ignora `expectedMissingInArkiv` a propósito: los borradores sin anclar son un estado válido, no una discrepancia.

- [ ] **Step 2: Sync masivo solo de documentos anclados**

In `lib/arkiv/sync.ts`, ampliá `SyncDocumentsResult` (líneas 8–13) con un contador de pendientes:

```typescript
export type SyncDocumentsResult = {
  total: number;
  synced: number;
  failed: number;
  pendingAnchor: number;
  errors: Array<{ documentId: string; message: string }>;
};
```

Reemplazá el bloque desde `const { data: docs, error } = await sb.from('documents').select('*');` (línea 27) hasta el cierre del `for` (línea 53) por:

```typescript
  const { data: allDocs, error } = await sb.from('documents').select('*');
  if (error) throw error;

  const typed = (allDocs ?? []) as VendorDocument[];
  // El sync masivo solo re-ancla documentos ya anclados (mantiene su status al día).
  // Los borradores quedan fuera y se reportan como pendientes de anclaje.
  const anchored = typed.filter(d => d.lifecycle_status === 'anchored');
  const pendingAnchor = typed.length - anchored.length;

  const { data: vendors } = await sb.from('vendors').select('id,name,owner_email,owner_name');
  const vendorById = new Map((vendors ?? []).map(v => [v.id, v]));
  const store = getStore();
  const syncedAt = new Date().toISOString();

  const result: SyncDocumentsResult = {
    total: anchored.length,
    synced: 0,
    failed: 0,
    pendingAnchor,
    errors: [],
  };

  for (const d of anchored) {
    try {
      await store.upsert(documentToValidationEntity(d, vendorById.get(d.vendor_id), syncedAt));
      result.synced++;
    } catch (err) {
      result.failed++;
      result.errors.push({
        documentId: d.id,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }
```

> **Nota:** el `for` viejo iteraba `(docs ?? []) as VendorDocument[]`; ahora itera `anchored`. El resto de `syncDocumentsToArkiv` (cálculo de `persistState`, el bloque `writeSyncState` y el `return result`) queda igual.

- [ ] **Step 3: Actualizar el test de paridad**

In `tests/arkiv.parity.test.ts`, agregá un caso que verifique que un borrador NO cuenta como `missingInArkiv`. Adaptá los helpers/mocks existentes del archivo; el caso a cubrir es:

```typescript
it('un documento en borrador no se cuenta como faltante en Arkiv', async () => {
  // Arrange: 1 doc 'draft' (sin entidad Arkiv) + 1 doc 'anchored' presente en Arkiv.
  // Act: const result = await auditArkivParity({ ... });
  // Assert:
  //   expect(result.missingInArkiv).not.toContain(draftDocId);
  //   expect(result.expectedMissingInArkiv).toContain(draftDocId);
  //   expect(result.ok).toBe(true);
});
```

(Completá Arrange/Act usando el mismo patrón de mock del store ya presente en el archivo.)

- [ ] **Step 4: Verificar tipos + tests**

Run: `npx tsc --noEmit && npx vitest run tests/arkiv.parity.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/arkiv/verify-parity.ts lib/arkiv/sync.ts tests/arkiv.parity.test.ts
git commit -m "feat(arkiv): paridad y sync respetan el ciclo de vida (borradores no anclados)"
```

---

## Task 9: UI — DocumentForm con dos CTAs

El formulario de alta gana dos botones: "Guardar borrador" (crea en `draft`) y "Guardar y anclar" (crea y luego llama al endpoint de anchor). En edición, el `submitLabel` se respeta como hoy.

**Files:**
- Modify: `components/vendor-pass/document-form.tsx`

- [ ] **Step 1: Soportar dos acciones en el submit**

In `components/vendor-pass/document-form.tsx`, reemplazá la función `handleSubmit` (líneas 153–173) por una versión que reciba si hay que anclar tras guardar:

```typescript
  async function persist(anchorAfter: boolean) {
    if (!validate()) return;
    if (anchorAfter && !form.file_hash) {
      setErrors(prev => ({ ...prev, file_url: 'Subí un archivo de evidencia antes de anclar.' }));
      return;
    }
    setLoading(true);
    const payload = {
      ...form,
      file_hash: form.file_hash || null,
      file_url: form.file_url || null,
    };
    const res = await fetch(
      isEdit ? `/api/documents/${documentId}` : '/api/documents',
      {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isEdit ? payload : { ...payload, vendor_id: vendorId }),
      },
    );
    if (!res.ok) {
      setLoading(false);
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? (isEdit ? 'Error actualizando documento' : 'Error creando documento'));
      return;
    }

    // En el alta, opcionalmente anclamos el documento recién creado.
    if (!isEdit && anchorAfter) {
      const { document } = await res.json();
      const anchorRes = await fetch(`/api/documents/${document.id}/anchor`, { method: 'POST' });
      if (!anchorRes.ok) {
        setLoading(false);
        const data = await anchorRes.json().catch(() => ({}));
        alert(data.error ?? 'El documento se guardó como borrador, pero falló el anclaje en Arkiv.');
        router.push(`/vendors/${vendorId}`);
        return;
      }
    }

    setLoading(false);
    router.push(`/vendors/${vendorId}`);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void persist(false);
  }
```

- [ ] **Step 2: Reemplazar el bloque de botones**

In el mismo archivo, reemplazá el bloque de botones final (líneas 361–375, el `<div className="flex flex-col gap-2">…</div>`) por:

```tsx
      <div className="flex flex-col gap-2">
        {!isEdit ? (
          <>
            <Button
              type="button"
              variant="primary"
              size="lg"
              loading={loading}
              className="w-full min-h-11"
              onClick={() => void persist(true)}
            >
              {loading ? 'Guardando…' : 'Guardar y anclar en Arkiv'}
            </Button>
            <Button
              type="submit"
              variant="outline"
              size="lg"
              className="w-full min-h-11"
              disabled={loading}
            >
              Guardar borrador
            </Button>
          </>
        ) : (
          <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full min-h-11">
            {loading ? 'Guardando…' : submitLabel}
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="lg"
          className="w-full min-h-11"
          onClick={onCancel}
          disabled={loading}
        >
          Cancelar
        </Button>
      </div>
```

> **Verificado:** el `submit` del form invoca `handleSubmit` → `persist(false)` (guardar borrador). El botón primario "Guardar y anclar" es `type="button"` y llama `persist(true)` directamente, evitando el doble disparo del submit.

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add components/vendor-pass/document-form.tsx
git commit -m "feat(ui): DocumentForm con CTAs de guardar borrador y anclar"
```

---

## Task 10: UI — badge de ciclo de vida en DocumentList

Cada documento muestra su estado de ciclo de vida: "Borrador", "Listo para anclar" o "Anclado en Arkiv" (con enlace de verificación).

**Files:**
- Modify: `components/vendor-pass/document-list.tsx`

- [ ] **Step 1: Añadir el badge de lifecycle**

In `components/vendor-pass/document-list.tsx`, después de los imports existentes (línea 7), añadí un import del icono `Lock`:

```typescript
import { FileText, Calendar, Plus, ShieldCheck, Lock } from 'lucide-react';
```

Después de la función `getDaysLabel` (línea 27), añadí:

```typescript
const LIFECYCLE_LABEL: Record<Doc['lifecycle_status'], string> = {
  draft: 'Borrador',
  pending_anchor: 'Listo para anclar',
  anchored: 'Anclado en Arkiv',
};

function LifecycleBadge({ status }: { status: Doc['lifecycle_status'] }) {
  if (status === 'anchored') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary/10 text-primary">
        <Lock size={10} aria-hidden="true" />
        {LIFECYCLE_LABEL.anchored}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
      {LIFECYCLE_LABEL[status]}
    </span>
  );
}
```

In el `DocumentRow`, dentro del `<div className="flex items-center gap-2 mt-0.5 flex-wrap">` (después del bloque de criticidad, antes de cerrar el div en la línea 55), añadí:

```tsx
          <LifecycleBadge status={doc.lifecycle_status} />
```

Y en la fila de acciones, mostrá el enlace "Verificar" solo cuando el documento esté anclado. Reemplazá el `<Link href={`/verify/${doc.id}`} …>…</Link>` (líneas 58–65) por:

```tsx
        {doc.lifecycle_status === 'anchored' && (
          <Link
            href={`/verify/${doc.id}`}
            className="inline-flex items-center gap-1 text-xs text-primary font-medium min-h-11 px-2"
            title="Verificar en Arkiv"
          >
            <ShieldCheck size={14} aria-hidden="true" />
            <span className="hidden sm:inline">Verificar</span>
          </Link>
        )}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add components/vendor-pass/document-list.tsx
git commit -m "feat(ui): badge de ciclo de vida en la lista de documentos"
```

---

## Task 11: UI — acción "Anclar" en el detalle del proveedor

Un botón cliente por documento no anclado que dispara `POST /api/documents/{id}/anchor` y refresca la vista.

**Files:**
- Create: `components/vendor-pass/anchor-document-button.tsx`
- Modify: `components/vendor-pass/document-list.tsx`

- [ ] **Step 1: Crear el botón de anclaje**

Create `components/vendor-pass/anchor-document-button.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/vendor-pass/button';
import { Anchor } from 'lucide-react';

export function AnchorDocumentButton({ documentId }: { documentId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleAnchor() {
    if (!confirm('¿Anclar este documento en Arkiv? Tras el anclaje, las fechas, el tipo y el archivo quedan inmutables.')) {
      return;
    }
    setLoading(true);
    const res = await fetch(`/api/documents/${documentId}/anchor`, { method: 'POST' });
    setLoading(false);
    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? 'No se pudo anclar el documento en Arkiv.');
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      loading={loading}
      onClick={handleAnchor}
      leftIcon={<Anchor size={14} />}
      className="shrink-0 min-h-11"
    >
      Anclar
    </Button>
  );
}
```

- [ ] **Step 2: Mostrar el botón en la lista de documentos**

In `components/vendor-pass/document-list.tsx`, importá el botón (después de los imports existentes):

```typescript
import { AnchorDocumentButton } from './anchor-document-button';
```

In la fila de acciones del `DocumentRow`, antes del `{vendorId && <DocumentRowActions … />}`, añadí:

```tsx
        {doc.lifecycle_status !== 'anchored' && <AnchorDocumentButton documentId={doc.id} />}
```

> **Verificado:** `document-list.tsx` ya es un componente de servidor que renderiza `DocumentRowActions` (cliente) y `Link`; agregar un componente cliente más es consistente. `app/vendors/[id]/page.tsx` ya pasa `enriched` (que ahora incluye `lifecycle_status`) a `<DocumentList … />`, así que no requiere cambios adicionales: el botón aparece automáticamente.

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add components/vendor-pass/anchor-document-button.tsx components/vendor-pass/document-list.tsx
git commit -m "feat(ui): acción Anclar en Arkiv por documento en el detalle del proveedor"
```

---

## Task 12: Documentar `ANCHOR_ON_SAVE`

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Añadir la variable documentada**

In `.env.example`, después de la línea `NEXT_PUBLIC_APP_URL=http://localhost:3000`, añadí:

```
# Ciclo de vida del documento. Por defecto, "Guardar" crea un BORRADOR y el anclaje en Arkiv
# es una acción explícita posterior. Poné ANCHOR_ON_SAVE=true SOLO para demos rápidas
# (ancla al guardar). NO usar en producción: rompe la separación borrador/compromiso.
ANCHOR_ON_SAVE=false
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "docs(env): documentar ANCHOR_ON_SAVE (modo compatibilidad, no producción)"
```

---

## Task 13: Verificación end-to-end

**Files:** ninguno (verificación manual)

- [ ] **Step 1: Suite + arranque**

Run: `npm test && npm run dev`
Expected: tests en verde (incluye `tests/document-lifecycle.test.ts` y `tests/arkiv.parity.test.ts`); dev server en `http://localhost:3000`.

- [ ] **Step 2: Crear un borrador NO escribe en Arkiv**

1. Login → un proveedor → **Agregar documento**.
2. Subí un archivo (se calcula el hash), completá los campos y tocá **Guardar borrador**.
3. En la lista del proveedor el documento muestra el badge **Borrador** y aparece el botón **Anclar**; NO hay enlace "Verificar".
4. En Postgres: `select lifecycle_status, anchored_at, arkiv_entity_key from public.documents order by created_at desc limit 1;` → `draft`, `null`, `null`.
5. (Si el store es memoria) confirmá que `getByDocumentId` del documento devuelve `null` antes de anclar — o vía la página `/verify/{id}` que debe indicar "no encontrado en Arkiv".

- [ ] **Step 3: Anclar crea la entidad consultable en `/verify/{id}`**

1. En el detalle del proveedor, tocá **Anclar** en el borrador → confirmá el diálogo.
2. La fila pasa al badge **Anclado en Arkiv** y aparece el enlace **Verificar**.
3. En Postgres el documento queda `anchored` con `anchored_at` y (si el backend es Arkiv real) `arkiv_entity_key` no nulo.
4. Abrí `/verify/{id}`: debe mostrar la validación encontrada con el `status` correcto.

- [ ] **Step 4: Editar fechas de un anclado devuelve 409**

Con la cookie de sesión, intentá cambiar la fecha de vencimiento de un documento anclado:
```bash
curl -i -X PUT http://localhost:3000/api/documents/ANCHORED_ID \
  -H "Content-Type: application/json" --cookie "COOKIE_DE_SESION" \
  -d '{"document_type":"art","document_name":"x","issued_at":"2025-01-01","expires_at":"2099-01-01","criticality":"critical","file_hash":"abc123"}'
```
Expected: `HTTP/1.1 409` con `immutableFields` incluyendo `expires_at`. Cambiar solo `notes`/`document_name` devuelve `200`.

- [ ] **Step 5: Cron de sync actualiza status sin borrar historial**

Run: `npx tsx scripts/verify-arkiv.ts` (o el comando de sync del repo).
Expected: el resultado reporta `synced` solo de documentos `anchored` y `pendingAnchor` con los borradores; las entidades ancladas conservan su `entityKey` (mismo `updateEntity`, no se recrean) y solo se actualiza el `status`.

- [ ] **Step 6: Auditoría de paridad ignora borradores**

Con un borrador y un anclado coexistiendo, ejecutá la auditoría (UI `/api/arkiv/audit` o el script).
Expected: el borrador aparece en `expectedMissingInArkiv`, NO en `missingInArkiv`; `ok` sigue `true` si el resto está en paridad.

- [ ] **Step 7: Commit final (si hubo ajustes)**

```bash
git add -A
git commit -m "chore(lifecycle): ajustes finales tras verificación end-to-end"
```

---

## Criterios de aceptación

- [ ] **Crear un documento en borrador NO escribe en Arkiv** → Task 5 (`POST` crea `draft`, sin `upsert`) + Task 2 verificación en Postgres.
- [ ] **El anchor crea una entidad consultable en `/verify/{id}`** → Task 4 (`anchorDocument`) + Task 6 (`POST /api/documents/[id]/anchor`) + Task 11 (botón "Anclar") + Task 13 Step 3.
- [ ] **Editar fechas de un documento anclado devuelve 409 (o fuerza flujo de renovación)** → Task 3 (`immutableFieldsChanged`) + Task 7 (`PUT` con `409`) + Task 13 Step 4.
- [ ] **El cron de sync actualiza el `status` en entidades ancladas sin borrar historial** → Task 8 (`syncDocumentsToArkiv` solo recorre `anchored`, usa `upsert`/`updateEntity` sobre el mismo `entityKey`) + Task 13 Step 5.
- [ ] **Los borradores no rompen la paridad DB↔Arkiv** → Task 8 (`expectedMissingInArkiv`) + Task 13 Step 6.
- [ ] **Modo compatibilidad documentado y opt-in** → Task 5 (`ANCHOR_ON_SAVE`) + Task 12 (`.env.example`).

---

## Self-Review

**1. Cobertura del objetivo:**
- ✅ Separar borrador (Postgres) del compromiso (Arkiv) → Task 1 (columnas), Task 5 (alta sin Arkiv), Task 6 (anchor explícito).
- ✅ Tres estados `draft`/`pending_anchor`/`anchored` con transiciones válidas → Task 1 (CHECK) + Task 3 (`canTransition`, terminal `anchored`).
- ✅ Campos inmutables tras anchor → Task 3 (`IMMUTABLE_FIELDS`, `immutableFieldsChanged`) + Task 7 (`409`).
- ✅ Recalcular status + cachear `entityKey` al anclar → Task 4 (`anchorDocument` usa `documentToValidationEntity` que recalcula `documentStatus`, persiste `arkiv_entity_key`/`anchored_at`).
- ✅ Cron re-ancla solo `status` por tiempo, sin humano → Task 8 (`syncDocumentsToArkiv` filtra `anchored`, `upsert` reusa `updateEntity` sobre el `entityKey` cacheado en `validations.ts`).
- ✅ Sync masivo solo anclados; borradores en "pendientes" → Task 8 (`pendingAnchor`).
- ✅ Paridad ignora borradores → Task 8 (`expectedMissingInArkiv`, `ok` no penaliza borradores).
- ✅ UI con dos CTAs + badges + acción Anclar → Tasks 9, 10, 11.
- ✅ Modo compatibilidad `ANCHOR_ON_SAVE` documentado como NO producción → Tasks 5, 12.
- ✅ Integración con el plan de IA: la IA precarga (sin cambios en `handleFileChange`/`applyExtraction`, Task 9 solo toca el submit y los botones) y el anchor ocurre tras revisión humana.

**2. Placeholders:** sin TODOs ni código a medias. El único hueco deliberado es el Arrange/Act del nuevo caso en `tests/arkiv.parity.test.ts` (Task 8 Step 3), porque debe reutilizar el patrón de mock ya presente en ese archivo (que este plan no reescribe) — la aserción objetivo está explícita.

**3. Consistencia de tipos/nombres:** `LifecycleStatus` (Task 2) se usa en `VendorDocument` (Task 2), `lifecycle.ts` (Task 3), las rutas API (Tasks 5–7) y la UI (Tasks 9–11). `IMMUTABLE_FIELDS`/`immutableFieldsChanged`/`canAnchor`/`canTransition`/`canEdit` (Task 3) se consumen en `anchor.ts` (Task 4), el `POST`/`PUT`/anchor (Tasks 5–7). `anchorDocument(supabase, doc, vendor)` (Task 4) tiene la misma firma que invocan Task 5 (compat mode) y Task 6 (endpoint). `documentToValidationEntity(doc, vendor, syncedAt?)` y `getStore()`/`getByDocumentId` se usan tal como están definidos en `lib/arkiv/entity.ts` y `lib/arkiv/validations.ts` (verificado: `getByDocumentId` devuelve `{ entity, entityKey }|null`, `entityKey` es `null` en el store de memoria — por eso `anchor.ts` tolera `null`). `ParityAuditResult` gana `expectedMissingInArkiv` (Task 8) y todos los consumidores existentes siguen leyendo los campos previos. El endpoint `/api/documents/[id]/anchor` (Task 6) coincide con la URL que llama `DocumentForm` (Task 9) y `AnchorDocumentButton` (Task 11). La migración 0007 marca los documentos preexistentes como `anchored` para no romper la paridad/sync del flujo viejo.

**4. Retrocompatibilidad:** los documentos creados antes de esta feature quedan `anchored` (Task 1 `update`), así que el cron, la paridad y la verificación los siguen tratando igual que hoy. La extensión de `auditArkivParity` y `syncDocumentsToArkiv` mantiene sus firmas (`options` opcional), así que las llamadas existentes en `app/api/arkiv/*` y el cron no cambian.
