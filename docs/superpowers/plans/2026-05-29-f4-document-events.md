# Historial Inmutable de Cambios (Eventos) — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que cada hecho sobre un documento de compliance quede attestado de forma inmutable (en Postgres siempre, y en Arkiv cuando el documento está anclado), de modo que la plataforma pueda responder con evidencia: *"¿quién cambió la fecha de vencimiento?"*, *"¿estaba vigente el 15/03?"*, *"¿este documento reemplazó a otro?"*. Se construye (1) una tabla `document_events` append-only, (2) un nuevo tipo de entidad Arkiv `vendor_document_event`, (3) un timeline en el detalle del documento (autenticado) y una sección "Historial verificable" filtrada en el verify público, y (4) un flujo de **renovación (supersede)** que deja rastro consultable.

**Architecture:** Cada cambio relevante llama a un único punto de entrada, `recordDocumentEvent({ documentId, eventType, actorUserId, payload, supabase })` (`lib/events/record.ts`), que **siempre** inserta una fila en `document_events` y, si el documento ya está `anchored` (Feature 2: `lifecycle_status='anchored'`), también crea una entidad Arkiv vía `lib/arkiv/events.ts` (`createEventEntity`). La construcción y validación del `payload` por tipo de evento vive en un helper **puro** (`buildEventPayload`) testeable sin I/O. La consulta autenticada (`GET /api/documents/[id]/events`) lee de Postgres con RLS por cookie; la pública (`GET /api/verify/[documentId]/events`) lee de Arkiv (o del store, según `getStoreSource()`) y **filtra** a los tipos no sensibles (`anchored`, `status_recomputed`, `renewed`). La renovación (`POST /api/documents/[id]/renew`) crea un nuevo `draft` con `supersedes_document_id`; al anclarse el nuevo (Feature 2), se emite el evento `renewed` y se marca `superseded_by_document_id` en el anterior. Todas las consultas de cumplimiento/pasaporte **ignoran** documentos con `superseded_by_document_id NOT NULL`.

**Tech Stack:** Next.js 16.2.6 (App Router, route handlers con `params: Promise<…>`), Supabase (`@supabase/ssr`, RLS, service-role `supabaseAdmin()`), Arkiv low-level (`@arkiv-network/sdk` + `@arkiv-network/sdk/query`), TypeScript, Vitest. Sin dependencias nuevas.

**Dependencias:** Feature 2 (anchor) — el anclaje (`anchorDocument`) es quien dispara el evento `anchored` y, en una renovación, el evento `renewed`. Se asume que Feature 2 introduce en `documents` las columnas `lifecycle_status` ('draft'|'pending_anchor'|'anchored'), `anchored_at` y `arkiv_entity_key`, y una función/endpoint de anclaje. **Donde un paso toque un archivo que Feature 2 también modifica, se indica el punto de inserción del hook** (no se reescribe la lógica de anclaje). La renovación/supersede (Task 9) habilita Feature 5.

---

## Convenciones compartidas (contexto verificado en el código)

- **Lifecycle (Feature 2):** `documents.lifecycle_status` ∈ `'draft' | 'pending_anchor' | 'anchored'`, `anchored_at timestamptz`, `arkiv_entity_key text`.
- **Arkiv existente:** `ENTITY_TYPE = 'vendor_document_validation'` en `lib/arkiv/client.ts`. Esta feature **agrega** un tipo nuevo: `ENTITY_TYPE_EVENT = 'vendor_document_event'` (no toca el existente).
- **`document_events` (esta feature lo crea):** `id uuid pk default gen_random_uuid()`, `document_id uuid fk → documents on delete cascade`, `event_type text`, `actor_user_id uuid null` (null = system/cron), `payload jsonb`, `created_at timestamptz default now()`. `event_type ∈ {created, anchored, updated, status_recomputed, renewed, revoked, file_replaced}`.
- **Columnas supersede en `documents`:** `supersedes_document_id uuid null`, `superseded_by_document_id uuid null`. Las consultas de cumplimiento/pasaporte **ignoran** documentos con `superseded_by_document_id NOT NULL`.
- **Migración:** este archivo es `0008_document_events.sql` (el siguiente libre tras `0007_document_lifecycle.sql` de Feature 2). Orden relativo requerido: **F2 (0007) < F4 (0008) < F5 (0009)**.
- **Auth:** `requireUser()` de `@/lib/supabase/api-auth` → `{ user, supabase, error }` (RLS por cookie). `supabaseAdmin()` de `@/lib/supabase/server` (service-role, sin RLS).
- **Lógica de estado:** `documentStatus(doc)` y `vendorStatus(docs)` de `lib/status.ts`. Tipos en `lib/types.ts` (`VendorDocument`).
- **Arkiv low-level (verificado):** `arkivPublicClient()`, `arkivWalletClient()`, `jsonToPayload`, `ENTITY_TYPE` en `lib/arkiv/client.ts`. Creación de entidad: `await wallet.createEntity({ payload: jsonToPayload(obj), attributes: [{key,value},…], contentType: 'application/json', expiresIn })` (segundos). Query: `pub.buildQuery().where([eq('entityType', ENTITY_TYPE_EVENT), eq('documentId', id)]).withPayload(true).orderBy(asc('occurredAt','string')).fetch()` → `.entities.map(parse)`. `eq`/`asc` de `@arkiv-network/sdk/query`. `e.toJson()` devuelve el payload (ver `parseEntity` en `lib/arkiv/validations.ts`).
- **Store de validaciones:** `getStore()`/`getStoreSource()` de `@/lib/arkiv/validations` (interface `ValidationStore`). **No confundir** con el nuevo store de eventos — el de eventos es nuevo (`lib/arkiv/events.ts`).
- **Estado actual verificado:** `documents` solo tiene `updated_at`; no hay tabla de eventos. `POST /api/documents` (create) y `app/api/documents/[id]/route.ts` (`PUT`/`DELETE`) existen y hoy hacen `getStore().upsert(...)`/`remove(...)`. El verify público es Server Component (`app/verify/[documentId]/page.tsx`, usa `PublicShell` + `StatusBadge`) y su API es `app/api/verify/[documentId]/route.ts`. El detalle/edición de documento vive en `app/vendors/[id]/documents/[docId]/edit/page.tsx`.

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `supabase/migrations/0008_document_events.sql` (crear) | Tabla `document_events` + columnas supersede en `documents` + índices + RLS |
| `lib/types.ts` (modificar) | Tipos `DocumentEventType`, `DocumentEvent`, payloads por tipo |
| `lib/events/payload.ts` (crear) | Helper **puro** `buildEventPayload()` (construye/valida payload por tipo) |
| `tests/document-events.payload.test.ts` (crear) | Tests TDD del helper puro |
| `lib/arkiv/events.ts` (crear) | `ENTITY_TYPE_EVENT`, `createEventEntity()`, `listEvents()` (Arkiv + fallback memoria) |
| `lib/events/record.ts` (crear) | `recordDocumentEvent()` — escribe Postgres siempre; Arkiv si `anchored` |
| `app/api/documents/route.ts` (modificar) | Hook `created` tras el insert del documento |
| `app/api/documents/[id]/route.ts` (modificar) | Hook `updated` (PUT en draft) y `revoked` (DELETE → baja lógica) |
| `lib/arkiv/anchor.ts` (modificar — Feature 2) | Hook `anchored` (y `renewed` si supersede) tras anclar |
| `lib/notifications/expirations.ts` o `lib/arkiv/sync.ts` (modificar) | Hook `status_recomputed` cuando el cron/sync cambia la vigencia |
| `app/api/documents/[id]/events/route.ts` (crear) | `GET` timeline autenticado (Postgres, RLS) |
| `app/api/verify/[documentId]/events/route.ts` (crear) | `GET` público filtrado (Arkiv/store, tipos no sensibles) |
| `app/api/documents/[id]/renew/route.ts` (crear) | `POST` crea draft con `supersedes_document_id` |
| `lib/events/public.ts` (crear) | `listPublicEvents()` — eventos no sensibles para el verify público |
| `components/vendor-pass/document-event-timeline.tsx` (crear) | UI timeline en el detalle del documento |
| `components/vendor-pass/renew-document-button.tsx` (crear) | Botón "Renovar" en documentos anclados vencidos/por vencer |
| `app/vendors/[id]/documents/[docId]/edit/page.tsx` (modificar) | Montar el timeline + botón renovar |
| `app/verify/[documentId]/page.tsx` (modificar) | Sección "Historial verificable" (filtrada) |
| `tests/document-events.test.ts` (crear) | Secuencia created→anchored→status_recomputed; supersede; filtrado público |

---

## Task 1: Migración — `document_events` + columnas supersede

> **Nota de numeración:** este archivo es `0008_document_events.sql` — después de Feature 2 (`0007_document_lifecycle.sql`) y antes de Feature 5 (`0009_vendor_portal.sql`).

**Files:**
- Create: `supabase/migrations/0008_document_events.sql`

- [ ] **Step 1: Escribir la migración**

Create `supabase/migrations/0008_document_events.sql`:

```sql
-- Historial inmutable de cambios de documentos (append-only)
create table if not exists public.document_events (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  event_type text not null check (event_type in (
    'created', 'anchored', 'updated', 'status_recomputed', 'renewed', 'revoked', 'file_replaced'
  )),
  actor_user_id uuid references auth.users(id) on delete set null, -- null = system / cron
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists document_events_document_id_idx
  on public.document_events(document_id, created_at);
create index if not exists document_events_event_type_idx
  on public.document_events(event_type);

-- Columnas de supersede (renovación) en documents
alter table public.documents
  add column if not exists supersedes_document_id uuid references public.documents(id) on delete set null,
  add column if not exists superseded_by_document_id uuid references public.documents(id) on delete set null;

create index if not exists documents_superseded_by_idx
  on public.documents(superseded_by_document_id);

-- RLS: un evento es visible si el documento pertenece a un proveedor del usuario.
alter table public.document_events enable row level security;

drop policy if exists "document_events_select_own" on public.document_events;
create policy "document_events_select_own" on public.document_events
  for select using (
    exists (
      select 1
      from public.documents d
      join public.vendors v on v.id = d.vendor_id
      where d.id = document_events.document_id
        and v.user_id = auth.uid()
    )
  );

drop policy if exists "document_events_insert_own" on public.document_events;
create policy "document_events_insert_own" on public.document_events
  for insert with check (
    exists (
      select 1
      from public.documents d
      join public.vendors v on v.id = d.vendor_id
      where d.id = document_events.document_id
        and v.user_id = auth.uid()
    )
  );

-- Inmutabilidad: sin update ni delete por usuario (append-only). El cron usa service-role.
```

- [ ] **Step 2: Aplicar la migración**

Run: `npx supabase migration up`
(alternativa que **borra datos** en local: `npx supabase db reset`)
Expected: se aplica sin errores.

- [ ] **Step 3: Verificar la tabla y columnas**

En el SQL editor de Supabase (o `psql`):
```sql
select count(*) from public.document_events;
select column_name from information_schema.columns
  where table_name = 'documents' and column_name in ('supersedes_document_id','superseded_by_document_id');
```
Expected: `0`; y dos filas (las dos columnas existen).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0008_document_events.sql
git commit -m "feat(db): tabla document_events (append-only) + columnas supersede"
```

---

## Task 2: Tipos de eventos

**Files:**
- Modify: `lib/types.ts` (append al final)

- [ ] **Step 1: Añadir los tipos**

Append to `lib/types.ts`:

```typescript
/** Tipos de evento del historial inmutable de un documento. */
export type DocumentEventType =
  | 'created'
  | 'anchored'
  | 'updated'
  | 'status_recomputed'
  | 'renewed'
  | 'revoked'
  | 'file_replaced';

/** Payload por tipo de evento (lo que se guarda en jsonb y se ancla en Arkiv). */
export interface DocumentEventPayloads {
  created: { snapshot: Record<string, unknown> };
  anchored: { entityKey: string; status: DocumentStatus; fileHash: string | null };
  updated: { changes: Record<string, { from: unknown; to: unknown }> };
  status_recomputed: { oldStatus: DocumentStatus; newStatus: DocumentStatus };
  renewed: { supersedesDocumentId: string };
  revoked: { reason: string };
  file_replaced: { oldHash: string | null; newHash: string | null };
}

/** Fila de document_events tal como la devuelve Postgres. */
export interface DocumentEvent {
  id: string;
  document_id: string;
  event_type: DocumentEventType;
  actor_user_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

/** Evento serializado para anclar/consultar en Arkiv (no sensible). */
export interface ArkivDocumentEvent {
  documentId: string;
  vendorId: string;
  eventType: DocumentEventType;
  occurredAt: string;
  payload: Record<string, unknown>;
  parentDocumentId: string | null;
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add lib/types.ts
git commit -m "feat(types): tipos de DocumentEvent y payloads por tipo"
```

---

## Task 3: Helper puro de payload (TDD)

Construye y valida el `payload` por tipo de evento. Es **puro** (sin I/O) → se testea primero.

**Files:**
- Create: `lib/events/payload.ts`
- Test: `tests/document-events.payload.test.ts`

- [ ] **Step 1: Escribir los tests que fallan**

Create `tests/document-events.payload.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildEventPayload, diffDocumentFields } from '@/lib/events/payload';
import type { VendorDocument } from '@/lib/types';

const baseDoc: VendorDocument = {
  id: 'doc-1',
  vendor_id: 'ven-1',
  document_type: 'poliza',
  document_name: 'ART',
  issued_at: '2026-01-01',
  expires_at: '2026-12-31',
  criticality: 'critical',
  file_url: null,
  file_hash: 'hash-a',
  notes: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

describe('buildEventPayload', () => {
  it('created: snapshot con los campos de negocio', () => {
    const p = buildEventPayload('created', { document: baseDoc });
    expect(p.snapshot).toMatchObject({ document_name: 'ART', expires_at: '2026-12-31' });
  });

  it('anchored: entityKey, status y fileHash', () => {
    const p = buildEventPayload('anchored', {
      entityKey: '0xabc',
      status: 'vigente',
      fileHash: 'hash-a',
    });
    expect(p).toEqual({ entityKey: '0xabc', status: 'vigente', fileHash: 'hash-a' });
  });

  it('status_recomputed: viejo y nuevo estado', () => {
    const p = buildEventPayload('status_recomputed', {
      oldStatus: 'vigente',
      newStatus: 'por_vencer',
    });
    expect(p).toEqual({ oldStatus: 'vigente', newStatus: 'por_vencer' });
  });

  it('renewed: referencia al documento que reemplaza', () => {
    const p = buildEventPayload('renewed', { supersedesDocumentId: 'doc-0' });
    expect(p).toEqual({ supersedesDocumentId: 'doc-0' });
  });

  it('revoked: motivo requerido (default vacío válido)', () => {
    expect(buildEventPayload('revoked', { reason: 'baja manual' })).toEqual({ reason: 'baja manual' });
  });

  it('file_replaced: hashes viejo y nuevo', () => {
    const p = buildEventPayload('file_replaced', { oldHash: 'hash-a', newHash: 'hash-b' });
    expect(p).toEqual({ oldHash: 'hash-a', newHash: 'hash-b' });
  });

  it('lanza si faltan campos obligatorios del tipo', () => {
    // @ts-expect-error: falta entityKey a propósito
    expect(() => buildEventPayload('anchored', { status: 'vigente', fileHash: null })).toThrow();
  });
});

describe('diffDocumentFields', () => {
  it('detecta solo los campos que cambiaron', () => {
    const next: VendorDocument = { ...baseDoc, expires_at: '2027-01-31', notes: 'renovada' };
    const changes = diffDocumentFields(baseDoc, next);
    expect(changes).toEqual({
      expires_at: { from: '2026-12-31', to: '2027-01-31' },
      notes: { from: null, to: 'renovada' },
    });
  });

  it('devuelve objeto vacío si no hubo cambios', () => {
    expect(diffDocumentFields(baseDoc, { ...baseDoc })).toEqual({});
  });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `npx vitest run tests/document-events.payload.test.ts`
Expected: FAIL con "Failed to resolve import '@/lib/events/payload'".

- [ ] **Step 3: Implementar**

Create `lib/events/payload.ts`:

```typescript
import type {
  DocumentEventPayloads,
  DocumentEventType,
  VendorDocument,
} from '@/lib/types';

/** Campos de negocio que se versionan en el snapshot/diff. */
const TRACKED_FIELDS = [
  'document_type',
  'document_name',
  'issued_at',
  'expires_at',
  'criticality',
  'file_url',
  'file_hash',
  'notes',
] as const;

export function documentSnapshot(doc: VendorDocument): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of TRACKED_FIELDS) out[f] = doc[f];
  return out;
}

export function diffDocumentFields(
  prev: VendorDocument,
  next: VendorDocument,
): Record<string, { from: unknown; to: unknown }> {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const f of TRACKED_FIELDS) {
    if (prev[f] !== next[f]) changes[f] = { from: prev[f], to: next[f] };
  }
  return changes;
}

/** Entradas aceptadas por cada tipo de evento (lo que el caller debe proveer). */
type BuildInput = {
  created: { document: VendorDocument };
  anchored: DocumentEventPayloads['anchored'];
  updated: { changes: DocumentEventPayloads['updated']['changes'] } | { prev: VendorDocument; next: VendorDocument };
  status_recomputed: DocumentEventPayloads['status_recomputed'];
  renewed: DocumentEventPayloads['renewed'];
  revoked: Partial<DocumentEventPayloads['revoked']>;
  file_replaced: DocumentEventPayloads['file_replaced'];
};

function required<T>(value: T | undefined | null, name: string): T {
  if (value === undefined || value === null) {
    throw new Error(`buildEventPayload: falta el campo obligatorio "${name}"`);
  }
  return value;
}

export function buildEventPayload<T extends DocumentEventType>(
  type: T,
  input: BuildInput[T],
): DocumentEventPayloads[T] {
  switch (type) {
    case 'created': {
      const i = input as BuildInput['created'];
      return { snapshot: documentSnapshot(required(i.document, 'document')) } as DocumentEventPayloads[T];
    }
    case 'anchored': {
      const i = input as BuildInput['anchored'];
      return {
        entityKey: required(i.entityKey, 'entityKey'),
        status: required(i.status, 'status'),
        fileHash: i.fileHash ?? null,
      } as DocumentEventPayloads[T];
    }
    case 'updated': {
      const i = input as BuildInput['updated'];
      const changes = 'changes' in i ? i.changes : diffDocumentFields(i.prev, i.next);
      return { changes } as DocumentEventPayloads[T];
    }
    case 'status_recomputed': {
      const i = input as BuildInput['status_recomputed'];
      return {
        oldStatus: required(i.oldStatus, 'oldStatus'),
        newStatus: required(i.newStatus, 'newStatus'),
      } as DocumentEventPayloads[T];
    }
    case 'renewed': {
      const i = input as BuildInput['renewed'];
      return { supersedesDocumentId: required(i.supersedesDocumentId, 'supersedesDocumentId') } as DocumentEventPayloads[T];
    }
    case 'revoked': {
      const i = input as BuildInput['revoked'];
      return { reason: i.reason ?? '' } as DocumentEventPayloads[T];
    }
    case 'file_replaced': {
      const i = input as BuildInput['file_replaced'];
      return { oldHash: i.oldHash ?? null, newHash: i.newHash ?? null } as DocumentEventPayloads[T];
    }
    default:
      throw new Error(`buildEventPayload: tipo desconocido "${type}"`);
  }
}

/** Tipos de evento que se exponen públicamente (no sensibles). */
export const PUBLIC_EVENT_TYPES: DocumentEventType[] = ['anchored', 'status_recomputed', 'renewed'];

export function isPublicEvent(type: DocumentEventType): boolean {
  return PUBLIC_EVENT_TYPES.includes(type);
}
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `npx vitest run tests/document-events.payload.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/events/payload.ts tests/document-events.payload.test.ts
git commit -m "feat(events): helper puro buildEventPayload + diff con tests"
```

---

## Task 4: Store de eventos en Arkiv

Nuevo tipo de entidad `vendor_document_event`. Sigue el patrón de `lib/arkiv/validations.ts`: cliente Arkiv si hay credenciales, fallback en memoria para dev.

**Files:**
- Create: `lib/arkiv/events.ts`

- [ ] **Step 1: Crear el módulo**

Create `lib/arkiv/events.ts`:

```typescript
import { arkivPublicClient, arkivWalletClient, jsonToPayload } from './client';
import { getStoreSource } from './validations';
import { asc, eq } from '@arkiv-network/sdk/query';
import type { ArkivDocumentEvent } from '@/lib/types';

/** Tipo de entidad NUEVO — no toca ENTITY_TYPE ('vendor_document_validation'). */
export const ENTITY_TYPE_EVENT = 'vendor_document_event';

/** Los eventos no caducan junto al documento; se conservan un año mínimo. */
const EVENT_EXPIRES_IN = 60 * 60 * 24 * 365; // 1 año en segundos

function eventAttributes(event: ArkivDocumentEvent) {
  return [
    { key: 'entityType', value: ENTITY_TYPE_EVENT },
    { key: 'documentId', value: event.documentId },
    { key: 'vendorId', value: event.vendorId },
    { key: 'eventType', value: event.eventType },
    { key: 'occurredAt', value: event.occurredAt },
  ];
}

function parseEvent(e: { toJson(): unknown }): ArkivDocumentEvent {
  const raw = e.toJson() as Partial<ArkivDocumentEvent>;
  return {
    documentId: raw.documentId ?? '',
    vendorId: raw.vendorId ?? '',
    eventType: (raw.eventType ?? 'updated') as ArkivDocumentEvent['eventType'],
    occurredAt: raw.occurredAt ?? '',
    payload: (raw.payload as Record<string, unknown>) ?? {},
    parentDocumentId: raw.parentDocumentId ?? null,
  };
}

// Fallback en memoria para dev (mismo criterio que createInMemoryStore en validations.ts).
const memoryEvents: ArkivDocumentEvent[] = [];

/** Ancla un evento en Arkiv (o lo guarda en memoria en dev). Devuelve la entityKey si aplica. */
export async function createEventEntity(event: ArkivDocumentEvent): Promise<{ entityKey: string | null }> {
  if (getStoreSource() !== 'arkiv') {
    memoryEvents.push(event);
    return { entityKey: null };
  }
  const wallet = arkivWalletClient();
  const { entityKey } = await wallet.createEntity({
    payload: jsonToPayload(event),
    attributes: eventAttributes(event),
    contentType: 'application/json',
    expiresIn: EVENT_EXPIRES_IN,
  });
  return { entityKey };
}

/** Lista los eventos anclados de un documento, ordenados por occurredAt asc. */
export async function listEvents(documentId: string): Promise<ArkivDocumentEvent[]> {
  if (getStoreSource() !== 'arkiv') {
    return memoryEvents
      .filter(e => e.documentId === documentId)
      .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  }
  const pub = arkivPublicClient();
  const result = await pub
    .buildQuery()
    .where([eq('entityType', ENTITY_TYPE_EVENT), eq('documentId', documentId)])
    .withPayload(true)
    .orderBy(asc('occurredAt', 'string'))
    .fetch();
  return result.entities.map(parseEvent);
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add lib/arkiv/events.ts
git commit -m "feat(arkiv): store de eventos vendor_document_event (Arkiv + memoria)"
```

---

## Task 5: `recordDocumentEvent()` — punto de entrada único

Siempre escribe Postgres; si el documento está `anchored`, también Arkiv.

**Files:**
- Create: `lib/events/record.ts`

- [ ] **Step 1: Crear el módulo**

Create `lib/events/record.ts`:

```typescript
import type { SupabaseClient } from '@supabase/supabase-js';
import { buildEventPayload } from '@/lib/events/payload';
import { createEventEntity } from '@/lib/arkiv/events';
import type { DocumentEvent, DocumentEventType } from '@/lib/types';

type RecordInput<T extends DocumentEventType> = {
  documentId: string;
  eventType: T;
  /** null = system / cron (sin actor humano). */
  actorUserId: string | null;
  /** Entrada cruda del payload; se pasa tal cual a buildEventPayload. */
  payload: Parameters<typeof buildEventPayload<T>>[1];
  supabase: SupabaseClient;
};

/**
 * Registra un evento del historial:
 *  1) SIEMPRE inserta una fila en document_events (Postgres).
 *  2) Si el documento está anchored (lifecycle_status='anchored'), ancla además
 *     una entidad de evento en Arkiv (best-effort: no rompe el flujo si falla).
 */
export async function recordDocumentEvent<T extends DocumentEventType>(
  input: RecordInput<T>,
): Promise<DocumentEvent> {
  const { documentId, eventType, actorUserId, supabase } = input;
  const payload = buildEventPayload(eventType, input.payload) as Record<string, unknown>;

  const { data: row, error } = await supabase
    .from('document_events')
    .insert({
      document_id: documentId,
      event_type: eventType,
      actor_user_id: actorUserId,
      payload,
    })
    .select('id, document_id, event_type, actor_user_id, payload, created_at')
    .single();
  if (error || !row) {
    throw new Error(error?.message ?? 'No se pudo registrar el evento');
  }
  const event = row as DocumentEvent;

  // ¿El documento está anclado? Solo entonces espejamos a Arkiv.
  const { data: doc } = await supabase
    .from('documents')
    .select('vendor_id, lifecycle_status, supersedes_document_id')
    .eq('id', documentId)
    .maybeSingle();

  if (doc && (doc as { lifecycle_status?: string }).lifecycle_status === 'anchored') {
    try {
      await createEventEntity({
        documentId,
        vendorId: (doc as { vendor_id: string }).vendor_id,
        eventType,
        occurredAt: event.created_at,
        payload,
        parentDocumentId: (doc as { supersedes_document_id: string | null }).supersedes_document_id ?? null,
      });
    } catch (err) {
      // Best-effort: el rastro en Postgres ya quedó. No bloqueamos la operación de negocio.
      console.error('[recordDocumentEvent] no se pudo anclar el evento en Arkiv:', err);
    }
  }

  return event;
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add lib/events/record.ts
git commit -m "feat(events): recordDocumentEvent (Postgres siempre, Arkiv si anchored)"
```

---

## Task 6: Hooks en los endpoints de documentos

Cablear `recordDocumentEvent` en create/update/delete. **No** se reescribe lógica existente: se inserta el hook tras la operación.

**Files:**
- Modify: `app/api/documents/route.ts` (hook `created`)
- Modify: `app/api/documents/[id]/route.ts` (hooks `updated` y `revoked`)

- [ ] **Step 1: Hook `created` en el POST**

In `app/api/documents/route.ts`, agregá el import al principio:

```typescript
import { recordDocumentEvent } from '@/lib/events/record';
```

Luego, en `POST`, **inmediatamente después** de la línea `await getStore().upsert(documentToValidationEntity(typed, vendor));` y **antes** del `return`, insertá:

```typescript
  await recordDocumentEvent({
    documentId: typed.id,
    eventType: 'created',
    actorUserId: auth.user.id,
    payload: { document: typed },
    supabase: auth.supabase,
  });
```

- [ ] **Step 2: Hook `updated` en el PUT**

In `app/api/documents/[id]/route.ts`, agregá los imports:

```typescript
import { recordDocumentEvent } from '@/lib/events/record';
import { diffDocumentFields } from '@/lib/events/payload';
```

En `PUT`, **antes** del `update`, leé el estado previo (para el diff). Reemplazá el bloque que va desde `const { id } = await params;` hasta la línea `const body = await req.json();` (inclusive) por:

```typescript
  const { id } = await params;
  const body = await req.json();

  const { data: prevDoc } = await auth.supabase
    .from('documents')
    .select('*')
    .eq('id', id)
    .single();
```

Después del `getStore().upsert(...)` existente y **antes** del `return`, insertá:

```typescript
  if (prevDoc) {
    const changes = diffDocumentFields(prevDoc as VendorDocument, typed);
    if (Object.keys(changes).length > 0) {
      await recordDocumentEvent({
        documentId: id,
        eventType: 'updated',
        actorUserId: auth.user.id,
        payload: { changes },
        supabase: auth.supabase,
      });
      // Si lo único que cambió fue el hash del archivo en un draft, dejamos también un file_replaced.
      if (changes.file_hash) {
        await recordDocumentEvent({
          documentId: id,
          eventType: 'file_replaced',
          actorUserId: auth.user.id,
          payload: { oldHash: changes.file_hash.from as string | null, newHash: changes.file_hash.to as string | null },
          supabase: auth.supabase,
        });
      }
    }
  }
```

- [ ] **Step 3: Convertir el DELETE en baja lógica con evento `revoked`**

En `app/api/documents/[id]/route.ts`, reemplazá el cuerpo de `DELETE` (desde `const { id } = await params;` hasta el `return NextResponse.json({ ok: true });` final) por:

```typescript
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const reason = typeof body.reason === 'string' ? body.reason : '';

  // Baja lógica: registramos el evento ANTES de borrar (la FK es on delete cascade).
  await recordDocumentEvent({
    documentId: id,
    eventType: 'revoked',
    actorUserId: auth.user.id,
    payload: { reason },
    supabase: auth.supabase,
  });

  const { error } = await auth.supabase.from('documents').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await getStore().remove(id);
  return NextResponse.json({ ok: true });
```

> **Nota:** la FK `document_events.document_id` es `on delete cascade`. Si se requiere conservar el rastro de `revoked` tras un DELETE físico, Feature 2 debería migrar el DELETE a una baja lógica (columna `revoked_at`). Mientras tanto, el evento queda anclado en Arkiv (si el doc estaba anchored) y ahí es permanente. Se documenta la limitación; no se sobre-diseña aquí.

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/documents/route.ts "app/api/documents/[id]/route.ts"
git commit -m "feat(events): hooks created/updated/file_replaced/revoked en endpoints de documentos"
```

---

## Task 7: Hooks en anchor (Feature 2) y en el cron de estado

Estos archivos los **introduce/modifica Feature 2**. Aquí solo se declara el **punto de inserción** del hook; si el archivo aún no existe, este task se aplica cuando Feature 2 esté integrada.

**Files:**
- Modify: `lib/arkiv/anchor.ts` (Feature 2 — hook `anchored` y, en supersede, `renewed`)
- Modify: `lib/notifications/expirations.ts` o `lib/arkiv/sync.ts` (hook `status_recomputed`)

- [ ] **Step 1: Hook `anchored` (y `renewed`) tras anclar**

En la función de anclaje de Feature 2 (p. ej. `anchorDocument(documentId, { supabase, actorUserId })`), **tras** marcar `lifecycle_status='anchored'`, setear `anchored_at`/`arkiv_entity_key` y hacer el `getStore().upsert(...)`, insertá:

```typescript
  // F4: registrar el evento de anclaje (queda en Postgres y, como ya está anchored, en Arkiv).
  await recordDocumentEvent({
    documentId,
    eventType: 'anchored',
    actorUserId: actorUserId ?? null,
    payload: { entityKey: arkivEntityKey, status: documentStatus(doc), fileHash: doc.file_hash ?? null },
    supabase,
  });

  // Si este documento renueva a otro (supersede), cerrar el ciclo:
  if (doc.supersedes_document_id) {
    await supabase
      .from('documents')
      .update({ superseded_by_document_id: documentId })
      .eq('id', doc.supersedes_document_id);

    await recordDocumentEvent({
      documentId,
      eventType: 'renewed',
      actorUserId: actorUserId ?? null,
      payload: { supersedesDocumentId: doc.supersedes_document_id },
      supabase,
    });
  }
```

Imports necesarios en `lib/arkiv/anchor.ts`:
```typescript
import { recordDocumentEvent } from '@/lib/events/record';
import { documentStatus } from '@/lib/status';
```

> **Dependencia explícita:** `recordDocumentEvent` espeja a Arkiv solo si `lifecycle_status === 'anchored'`. Por eso el hook va **después** de marcar el documento como `anchored` en Postgres, garantizando que el evento `anchored` y el `renewed` también se anclen.

- [ ] **Step 2: Hook `status_recomputed` en el cron/sync**

El cron/sync recalcula `documentStatus`. Donde detecta que el estado **cambió** respecto al anterior (en `lib/arkiv/sync.ts` o `lib/notifications/expirations.ts`), insertá, usando el cliente service-role (`actorUserId: null`):

```typescript
  if (newStatus !== oldStatus) {
    await recordDocumentEvent({
      documentId: doc.id,
      eventType: 'status_recomputed',
      actorUserId: null, // cron / sistema
      payload: { oldStatus, newStatus },
      supabase, // supabaseAdmin() en el contexto del cron
    });
  }
```

> **Nota:** en el cron no hay sesión de cookie, así que `supabase` es `supabaseAdmin()` (bypass RLS). El insert en `document_events` funciona igual; la política RLS solo aplica al cliente con sesión.

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: PASS (si Feature 2 ya integró `lib/arkiv/anchor.ts`; si no, aplicá este task al integrarla).

- [ ] **Step 4: Commit**

```bash
git add lib/arkiv/anchor.ts lib/arkiv/sync.ts lib/notifications/expirations.ts
git commit -m "feat(events): hooks anchored/renewed (anchor F2) y status_recomputed (cron)"
```

---

## Task 8: API de eventos — timeline autenticado y público filtrado

**Files:**
- Create: `app/api/documents/[id]/events/route.ts` (auth)
- Create: `lib/events/public.ts` (helper de lectura pública)
- Create: `app/api/verify/[documentId]/events/route.ts` (público filtrado)

- [ ] **Step 1: Timeline autenticado (Postgres, RLS)**

Create `app/api/documents/[id]/events/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/api-auth';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { id } = await params;
  const { data, error } = await auth.supabase
    .from('document_events')
    .select('id, document_id, event_type, actor_user_id, payload, created_at')
    .eq('document_id', id)
    .order('created_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ events: data ?? [] });
}
```

- [ ] **Step 2: Helper de lectura pública**

Create `lib/events/public.ts`:

```typescript
import { listEvents } from '@/lib/arkiv/events';
import { isPublicEvent } from '@/lib/events/payload';
import type { ArkivDocumentEvent } from '@/lib/types';

/**
 * Eventos públicos no sensibles de un documento (anchored, status_recomputed, renewed),
 * leídos de Arkiv (o del store en memoria en dev), más recientes primero, máx. `limit`.
 */
export async function listPublicEvents(documentId: string, limit = 10): Promise<ArkivDocumentEvent[]> {
  const events = await listEvents(documentId);
  return events
    .filter(e => isPublicEvent(e.eventType))
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, limit);
}
```

- [ ] **Step 3: API pública filtrada**

Create `app/api/verify/[documentId]/events/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { listPublicEvents } from '@/lib/events/public';
import { getStoreSource } from '@/lib/arkiv/validations';

export async function GET(_req: Request, { params }: { params: Promise<{ documentId: string }> }) {
  const { documentId } = await params;
  try {
    const events = await listPublicEvents(documentId);
    return NextResponse.json({ source: getStoreSource(), events });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 });
  }
}
```

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "app/api/documents/[id]/events/route.ts" lib/events/public.ts "app/api/verify/[documentId]/events/route.ts"
git commit -m "feat(api): GET eventos (timeline auth) y verify/events (público filtrado)"
```

---

## Task 9: Renovación (supersede) — `POST /api/documents/[id]/renew`

Crea un nuevo `draft` que reemplaza a un documento anclado vencido/por vencer, con `supersedes_document_id`. El evento `renewed` y el marcado de `superseded_by_document_id` ocurren **al anclar el nuevo** (Task 7, Step 1).

**Files:**
- Create: `app/api/documents/[id]/renew/route.ts`

- [ ] **Step 1: Crear el endpoint**

Create `app/api/documents/[id]/renew/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/api-auth';
import { documentStatus } from '@/lib/status';
import type { VendorDocument } from '@/lib/types';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  // El documento a renovar debe existir, ser del usuario (RLS), estar anclado y no vigente.
  const { data: prev, error } = await auth.supabase
    .from('documents')
    .select('*')
    .eq('id', id)
    .single();
  if (error || !prev) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });

  const prevDoc = prev as VendorDocument & { lifecycle_status?: string; superseded_by_document_id?: string | null };
  if (prevDoc.lifecycle_status !== 'anchored') {
    return NextResponse.json({ error: 'Solo se puede renovar un documento anclado' }, { status: 400 });
  }
  if (prevDoc.superseded_by_document_id) {
    return NextResponse.json({ error: 'Este documento ya fue renovado' }, { status: 400 });
  }
  if (documentStatus(prevDoc) === 'vigente') {
    return NextResponse.json({ error: 'El documento aún está vigente' }, { status: 400 });
  }

  // Nuevo draft que hereda metadatos y referencia al anterior. Sin evento todavía:
  // el evento "renewed" y el marcado de superseded_by ocurren al anclar el nuevo (F2).
  const { data: draft, error: insErr } = await auth.supabase
    .from('documents')
    .insert({
      vendor_id: prevDoc.vendor_id,
      document_type: prevDoc.document_type,
      document_name: prevDoc.document_name,
      issued_at: body.issued_at ?? prevDoc.issued_at,
      expires_at: body.expires_at ?? prevDoc.expires_at,
      criticality: prevDoc.criticality,
      file_url: body.file_url ?? null,
      file_hash: body.file_hash ?? null,
      notes: body.notes ?? prevDoc.notes,
      lifecycle_status: 'draft',
      supersedes_document_id: prevDoc.id,
    })
    .select()
    .single();
  if (insErr || !draft) return NextResponse.json({ error: insErr?.message ?? 'No se pudo crear la renovación' }, { status: 400 });

  return NextResponse.json({ document: draft }, { status: 201 });
}
```

> **Importante (regla "documento vigente"):** este task crea el `draft` con `supersedes_document_id`, pero **no** registra `created` aquí para no duplicar el del POST de creación; el draft de renovación se considera un alta y, si tu flujo de Feature 2 fuerza el alta vía `POST /api/documents`, podés en cambio llamar a ese endpoint con `supersedes_document_id`. Acá se ofrece el atajo dedicado. El marcado `superseded_by_document_id` y el evento `renewed` se disparan al anclar (Task 7).

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add "app/api/documents/[id]/renew/route.ts"
git commit -m "feat(api): renovación de documentos (supersede draft)"
```

---

## Task 10: UI — timeline en el detalle del documento + botón Renovar

**Files:**
- Create: `components/vendor-pass/document-event-timeline.tsx`
- Create: `components/vendor-pass/renew-document-button.tsx`
- Modify: `app/vendors/[id]/documents/[docId]/edit/page.tsx`

- [ ] **Step 1: Componente timeline**

Create `components/vendor-pass/document-event-timeline.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { History, ShieldCheck, RefreshCw, FileEdit, FilePlus, FileX, Repeat } from 'lucide-react';
import type { DocumentEvent, DocumentEventType } from '@/lib/types';

const LABELS: Record<DocumentEventType, string> = {
  created: 'Documento creado',
  anchored: 'Anclado en Arkiv',
  updated: 'Datos actualizados',
  status_recomputed: 'Estado recalculado',
  renewed: 'Renovado (reemplaza a otro documento)',
  revoked: 'Documento dado de baja',
  file_replaced: 'Archivo reemplazado',
};

const ICONS: Record<DocumentEventType, React.ComponentType<{ size?: number; className?: string }>> = {
  created: FilePlus,
  anchored: ShieldCheck,
  updated: FileEdit,
  status_recomputed: RefreshCw,
  renewed: Repeat,
  revoked: FileX,
  file_replaced: FileEdit,
};

function describePayload(e: DocumentEvent): string | null {
  const p = e.payload ?? {};
  switch (e.event_type) {
    case 'status_recomputed':
      return `${p.oldStatus} → ${p.newStatus}`;
    case 'anchored':
      return typeof p.entityKey === 'string' ? `entity ${String(p.entityKey).slice(0, 10)}…` : null;
    case 'updated': {
      const changes = (p.changes as Record<string, unknown>) ?? {};
      const keys = Object.keys(changes);
      return keys.length ? `Campos: ${keys.join(', ')}` : null;
    }
    case 'revoked':
      return typeof p.reason === 'string' && p.reason ? `Motivo: ${p.reason}` : null;
    case 'renewed':
      return 'Reemplaza a un documento anterior';
    case 'file_replaced':
      return 'Hash del archivo modificado';
    default:
      return null;
  }
}

export function DocumentEventTimeline({ documentId }: { documentId: string }) {
  const [events, setEvents] = useState<DocumentEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch(`/api/documents/${documentId}/events`)
      .then(r => (r.ok ? r.json() : { events: [] }))
      .then(d => {
        if (alive) setEvents(d.events ?? []);
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [documentId]);

  return (
    <section className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <History size={16} className="text-primary" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-foreground">Historial de cambios</h2>
      </div>
      {loading && <p className="text-sm text-muted-foreground">Cargando…</p>}
      {!loading && events.length === 0 && (
        <p className="text-sm text-muted-foreground">Todavía no hay eventos registrados.</p>
      )}
      <ol className="flex flex-col gap-3">
        {events
          .slice()
          .reverse()
          .map(e => {
            const Icon = ICONS[e.event_type] ?? History;
            const detail = describePayload(e);
            return (
              <li key={e.id} className="flex items-start gap-3">
                <span className="mt-0.5 shrink-0 rounded-full bg-secondary p-1.5">
                  <Icon size={14} className="text-foreground" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{LABELS[e.event_type] ?? e.event_type}</p>
                  {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(e.created_at).toLocaleString('es-AR')}
                    {e.actor_user_id ? ' · por un usuario' : ' · sistema'}
                  </p>
                </div>
              </li>
            );
          })}
      </ol>
    </section>
  );
}
```

> **Nota sobre el actor:** la UI muestra "por un usuario" vs "sistema" según `actor_user_id`. Mostrar el **nombre** del usuario requeriría unir con `profiles`; queda como mejora simple (incluir `actor_name` en la respuesta del endpoint si Feature de perfiles está disponible). El criterio de aceptación "timeline muestra actor humano en cambios manuales" se cumple distinguiendo humano vs sistema; el nombre es opcional.

- [ ] **Step 2: Botón Renovar**

Create `components/vendor-pass/renew-document-button.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Repeat } from 'lucide-react';
import { Button } from '@/components/vendor-pass/button';

export function RenewDocumentButton({ documentId, vendorId }: { documentId: string; vendorId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRenew() {
    if (!confirm('Crear una renovación de este documento? Se generará un borrador que lo reemplazará al anclarse.')) return;
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/documents/${documentId}/renew`, { method: 'POST' });
    setLoading(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? 'No se pudo renovar');
      return;
    }
    const { document } = await res.json();
    router.push(`/vendors/${vendorId}/documents/${document.id}/edit`);
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleRenew}
        loading={loading}
        leftIcon={<Repeat size={14} />}
        className="min-h-11"
      >
        Renovar documento
      </Button>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 3: Montar timeline + botón en el detalle del documento**

In `app/vendors/[id]/documents/[docId]/edit/page.tsx`, agregá los imports:

```typescript
import { DocumentEventTimeline } from '@/components/vendor-pass/document-event-timeline';
import { RenewDocumentButton } from '@/components/vendor-pass/renew-document-button';
import { documentStatus } from '@/lib/status';
```

Después del `<EditDocumentClient ... />` (y dentro del `<div className="flex flex-col gap-6">`), insertá:

```tsx
        {(d as { lifecycle_status?: string }).lifecycle_status === 'anchored' &&
          documentStatus(d) !== 'vigente' &&
          !(d as { superseded_by_document_id?: string | null }).superseded_by_document_id && (
            <RenewDocumentButton documentId={docId} vendorId={vendorId} />
          )}

        <DocumentEventTimeline documentId={docId} />
```

> **Verificado:** la página ya tiene `const d = doc as VendorDocument;` y `AppShell`/`PageHeader`. `documentStatus(d)` funciona con el `VendorDocument`. El botón solo aparece para documentos anclados, no vigentes y aún no renovados.

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/vendor-pass/document-event-timeline.tsx components/vendor-pass/renew-document-button.tsx "app/vendors/[id]/documents/[docId]/edit/page.tsx"
git commit -m "feat(ui): timeline de eventos y botón de renovación en el detalle del documento"
```

---

## Task 11: Verify público — sección "Historial verificable"

**Files:**
- Modify: `app/verify/[documentId]/page.tsx`

- [ ] **Step 1: Cargar y renderizar los eventos públicos**

In `app/verify/[documentId]/page.tsx`, agregá el import:

```typescript
import { listPublicEvents } from '@/lib/events/public';
```

Dentro de `VerifyPage`, después de `const { entity, entityKey, resolvedFrom } = lookup;`, agregá:

```typescript
  const publicEvents = await listPublicEvents(documentId);

  const EVENT_LABELS: Record<string, string> = {
    anchored: 'Anclado en Arkiv',
    status_recomputed: 'Estado recalculado',
    renewed: 'Renovado',
  };
```

Antes del cierre de la `<section>` final (o como nueva `<section>` dentro del `<div className="flex flex-col gap-6">`, después de la sección de detalle), insertá:

```tsx
        {publicEvents.length > 0 && (
          <section className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-foreground">Historial verificable</h2>
            <ol className="flex flex-col gap-2">
              {publicEvents.map((e, i) => (
                <li key={`${e.eventType}-${e.occurredAt}-${i}`} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-foreground">{EVENT_LABELS[e.eventType] ?? e.eventType}</span>
                  <span className="text-xs text-muted-foreground">
                    {e.occurredAt ? new Date(e.occurredAt).toLocaleDateString('es-MX') : ''}
                  </span>
                </li>
              ))}
            </ol>
            <p className="text-[11px] text-muted-foreground">
              Solo se muestran eventos no sensibles registrados en la red verificable.
            </p>
          </section>
        )}
```

> **Verificado:** la página es Server Component `async` (ya usa `await`), por lo que `await listPublicEvents(...)` es válido. Solo lista tipos no sensibles (`anchored`, `status_recomputed`, `renewed`) por construcción de `listPublicEvents` (`isPublicEvent`).

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add "app/verify/[documentId]/page.tsx"
git commit -m "feat(verify): sección Historial verificable (eventos públicos filtrados)"
```

---

## Task 12: Tests de integración (TDD del flujo)

Valida la secuencia de eventos, la renovación (supersede) y el filtrado público, usando el store en memoria (sin Arkiv real) y un mock del cliente Supabase.

**Files:**
- Create: `tests/document-events.test.ts`

- [ ] **Step 1: Escribir los tests**

Create `tests/document-events.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { listPublicEvents } from '@/lib/events/public';
import { createEventEntity, listEvents } from '@/lib/arkiv/events';
import { isPublicEvent, buildEventPayload, diffDocumentFields } from '@/lib/events/payload';
import type { ArkivDocumentEvent, VendorDocument } from '@/lib/types';

// Sin credenciales Arkiv → store en memoria (getStoreSource() === 'memory').
delete process.env.ARKIV_RPC_URL;
delete process.env.ARKIV_PRIVATE_KEY;

const baseDoc: VendorDocument = {
  id: 'doc-1', vendor_id: 'ven-1', document_type: 'poliza', document_name: 'ART',
  issued_at: '2026-01-01', expires_at: '2026-12-31', criticality: 'critical',
  file_url: null, file_hash: 'h-a', notes: null,
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
};

function event(type: ArkivDocumentEvent['eventType'], occurredAt: string, payload = {}): ArkivDocumentEvent {
  return { documentId: 'doc-1', vendorId: 'ven-1', eventType: type, occurredAt, payload, parentDocumentId: null };
}

describe('secuencia created → anchored → status_recomputed (en memoria)', () => {
  beforeEach(async () => {
    // limpiar: re-importar módulo no es trivial; usamos un documentId único por test.
  });

  it('ancla y lista eventos en orden cronológico', async () => {
    await createEventEntity({ ...event('created', '2026-01-01T00:00:00Z'), documentId: 'seq-1' });
    await createEventEntity({ ...event('anchored', '2026-01-02T00:00:00Z'), documentId: 'seq-1' });
    await createEventEntity({ ...event('status_recomputed', '2026-03-01T00:00:00Z'), documentId: 'seq-1' });

    const all = await listEvents('seq-1');
    expect(all.map(e => e.eventType)).toEqual(['created', 'anchored', 'status_recomputed']);
  });
});

describe('filtrado público', () => {
  it('excluye created, updated, revoked y file_replaced', async () => {
    await createEventEntity({ ...event('created', '2026-01-01T00:00:00Z'), documentId: 'pub-1' });
    await createEventEntity({ ...event('anchored', '2026-01-02T00:00:00Z'), documentId: 'pub-1' });
    await createEventEntity({ ...event('updated', '2026-01-03T00:00:00Z'), documentId: 'pub-1' });
    await createEventEntity({ ...event('status_recomputed', '2026-02-01T00:00:00Z'), documentId: 'pub-1' });
    await createEventEntity({ ...event('revoked', '2026-02-02T00:00:00Z'), documentId: 'pub-1' });

    const pub = await listPublicEvents('pub-1');
    const types = pub.map(e => e.eventType);
    expect(types).toContain('anchored');
    expect(types).toContain('status_recomputed');
    expect(types).not.toContain('created');
    expect(types).not.toContain('updated');
    expect(types).not.toContain('revoked');
  });

  it('isPublicEvent solo aprueba anchored/status_recomputed/renewed', () => {
    expect(isPublicEvent('anchored')).toBe(true);
    expect(isPublicEvent('status_recomputed')).toBe(true);
    expect(isPublicEvent('renewed')).toBe(true);
    expect(isPublicEvent('created')).toBe(false);
    expect(isPublicEvent('updated')).toBe(false);
    expect(isPublicEvent('revoked')).toBe(false);
    expect(isPublicEvent('file_replaced')).toBe(false);
  });
});

describe('renovación (supersede)', () => {
  it('el evento renewed referencia al documento anterior y es público', async () => {
    const payload = buildEventPayload('renewed', { supersedesDocumentId: 'doc-old' });
    expect(payload).toEqual({ supersedesDocumentId: 'doc-old' });

    await createEventEntity({
      ...event('renewed', '2026-12-01T00:00:00Z', payload),
      documentId: 'doc-new',
      parentDocumentId: 'doc-old',
    });
    const pub = await listPublicEvents('doc-new');
    expect(pub.some(e => e.eventType === 'renewed')).toBe(true);
    expect(pub.find(e => e.eventType === 'renewed')?.parentDocumentId).toBe('doc-old');
  });
});

describe('diff de actualización', () => {
  it('captura el cambio de fecha de vencimiento como evento updated', () => {
    const next = { ...baseDoc, expires_at: '2027-12-31' };
    const changes = diffDocumentFields(baseDoc, next);
    const payload = buildEventPayload('updated', { changes });
    expect(payload.changes.expires_at).toEqual({ from: '2026-12-31', to: '2027-12-31' });
  });
});
```

> **Nota:** los tests usan `documentId` único por caso porque el store en memoria es un módulo singleton (acumula). No requieren red ni Supabase: ejercitan el camino Arkiv-en-memoria + helpers puros, que es donde vive la lógica de filtrado/orden/diff. El cableado de `recordDocumentEvent` con Postgres se cubre en la verificación e2e (Task 13) con la app real.

- [ ] **Step 2: Correr los tests**

Run: `npx vitest run tests/document-events.test.ts tests/document-events.payload.test.ts`
Expected: PASS

- [ ] **Step 3: Suite completa**

Run: `npm test`
Expected: PASS (incluye los tests previos del repo).

- [ ] **Step 4: Commit**

```bash
git add tests/document-events.test.ts
git commit -m "test(events): secuencia, filtrado público, supersede y diff"
```

---

## Task 13: Verificación end-to-end

**Files:** ninguno (verificación manual)

- [ ] **Step 1: Migrar y arrancar**

Run: `npx supabase migration up && npm run dev`
Expected: migración aplicada; dev server en `http://localhost:3000`.

- [ ] **Step 2: Evento `created` + `updated`**

1. Login → creá un documento de un proveedor.
2. Abrí su detalle (`/vendors/[id]/documents/[docId]/edit`) → el **Historial de cambios** muestra "Documento creado" con marca "por un usuario".
3. Editá la fecha de vencimiento y guardá → aparece "Datos actualizados" con `Campos: expires_at`.

- [ ] **Step 3: Evento `anchored` (depende de Feature 2)**

1. Anclá el documento (flujo de Feature 2).
2. El timeline muestra "Anclado en Arkiv".
3. `curl -s http://localhost:3000/api/verify/<docId>/events | head` → incluye `anchored`. La sección **Historial verificable** del `/verify/<docId>` lo muestra (no muestra `created`/`updated`).

- [ ] **Step 4: Evento `status_recomputed`**

1. Forzá el recálculo (cron/sync, o un documento que cruce el umbral de 30 días).
2. El timeline muestra "Estado recalculado" con `vigente → por_vencer` y marca **"sistema"** (sin actor humano).

- [ ] **Step 5: Renovación (supersede)**

1. En un documento anclado vencido/por vencer, usá **Renovar documento** → te lleva al draft nuevo.
2. Anclá el draft → en su timeline aparece "Renovado"; en el documento anterior, las consultas de cumplimiento lo ignoran (`superseded_by_document_id` seteado).
3. `curl -s http://localhost:3000/api/verify/<docNuevo>/events` → incluye `renewed` (público).
4. En el pasaporte del proveedor, el documento renovado deja de contar para el estado y el viejo queda como histórico.

- [ ] **Step 6: Inmutabilidad / criterios**

1. Confirmá en Supabase que cada anchor produjo una fila en `document_events` (`select event_type, actor_user_id from document_events where document_id = '<docId>' order by created_at;`).
2. Con Arkiv configurado (`ARKIV_RPC_URL`/`ARKIV_PRIVATE_KEY`), confirmá que el evento `anchored` también existe como entidad `vendor_document_event` (consulta por `entityType`/`documentId`).

- [ ] **Step 7: Commit final (si hubo ajustes)**

```bash
git add -A
git commit -m "chore(events): ajustes finales tras verificación end-to-end"
```

---

## Criterios de aceptación

- [ ] **Cada anchor genera fila en `document_events` + entidad Arkiv `vendor_document_event`** → Task 1 (tabla + tipo), Task 4 (`createEventEntity`), Task 5 (`recordDocumentEvent` espeja a Arkiv si `anchored`), Task 7 (hook `anchored` en `anchorDocument`).
- [ ] **El timeline muestra el actor humano en cambios manuales** (vs "sistema" en cron) → Task 6 (`actorUserId: auth.user.id` en create/update/revoke; `null` en `status_recomputed`), Task 10 (render "por un usuario" / "sistema").
- [ ] **La renovación deja rastro consultable públicamente (tipo `renewed`)** → Task 9 (draft supersede), Task 7 (evento `renewed` + `superseded_by_document_id` al anclar), Task 8/11 (`renewed` está en `PUBLIC_EVENT_TYPES`, aparece en `/verify/[id]/events` y en la sección "Historial verificable").
- [ ] **Las consultas de cumplimiento/pasaporte ignoran documentos con `superseded_by_document_id NOT NULL`** → regla aplicada en Task 7 (marcado) + a verificar en Task 13 Step 5 (queda como integración con las consultas existentes de cumplimiento; si alguna no filtra, agregar `.is('superseded_by_document_id', null)`).
- [ ] **Eventos sensibles (`created`, `updated`, `revoked`, `file_replaced`) nunca se exponen en el verify público** → Task 3 (`PUBLIC_EVENT_TYPES`/`isPublicEvent`), Task 8 (`listPublicEvents` filtra), Task 12 (test de filtrado).

---

## Self-Review

**1. Cobertura del objetivo:**
- ✅ Historial inmutable en Postgres (append-only, sin update/delete por RLS) → Task 1.
- ✅ Mirror inmutable en Arkiv para documentos anclados (tipo nuevo, no toca el existente) → Task 4 + Task 5.
- ✅ Los 7 tipos de evento (`created`, `anchored`, `updated`, `status_recomputed`, `renewed`, `revoked`, `file_replaced`) → enum en Task 1, payloads en Task 2/3, hooks en Task 6/7.
- ✅ Timeline autenticado en el detalle del documento → Task 8 (API) + Task 10 (UI).
- ✅ Sección pública filtrada en el verify → Task 8 (`/verify/[id]/events`) + Task 11 (UI).
- ✅ Renovación/supersede con regla "documento vigente" → Task 9 (endpoint) + Task 7 (cierre del ciclo al anclar) + criterios.
- ✅ Responder "¿quién cambió la fecha?" (diff + actor) y "¿estaba vigente el 15/03?" (timeline de `status_recomputed`) → Task 3 (`diffDocumentFields`), Task 6/7 (eventos), Task 10 (render).

**2. Placeholders:** sin TODOs ni stubs. El único código que depende de archivos externos es el de Task 7 (`lib/arkiv/anchor.ts` y el cron), que es introducido por **Feature 2**; por eso Task 7 documenta el **punto de inserción exacto** del hook en lugar de reescribir la lógica de anclaje, en línea con la dependencia declarada.

**3. Consistencia de tipos/nombres:** `DocumentEventType`/`DocumentEvent`/`ArkivDocumentEvent` (Task 2) se usan idénticos en `payload.ts` (Task 3), `events.ts` (Task 4), `record.ts` (Task 5), las APIs (Task 8) y la UI (Task 10/11). `buildEventPayload(type, input)` (Task 3) recibe lo mismo que pasan los hooks (Task 6/7) y `recordDocumentEvent` (Task 5). `ENTITY_TYPE_EVENT = 'vendor_document_event'` (Task 4) es distinto de `ENTITY_TYPE` (validaciones) y se consulta con `eq('entityType', ENTITY_TYPE_EVENT)` + `asc('occurredAt','string')`, siguiendo el patrón verificado en `lib/arkiv/validations.ts`. `PUBLIC_EVENT_TYPES`/`isPublicEvent` (Task 3) es la única fuente de verdad del filtrado, consumida por `listPublicEvents` (Task 8) y los tests (Task 12). Las columnas `supersedes_document_id`/`superseded_by_document_id` (Task 1) se escriben en Task 9 (set `supersedes_*`) y Task 7 (set `superseded_by_*`) y se leen en Task 10 (gating del botón) y en los criterios de cumplimiento. `recordDocumentEvent` usa `lifecycle_status` (Feature 2) para decidir el mirror Arkiv, alineado con la dependencia. `requireUser()` devuelve `{ user, supabase, error }` y se consume idéntico en todas las rutas autenticadas; las rutas con `params` usan `params: Promise<…>` + `await params`, verificado contra el código existente.
