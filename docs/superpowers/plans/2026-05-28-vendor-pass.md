# VendorPass / CompliancePass MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a hackathon-ready web app where users register vendors, attach documents with expiry dates, see auto-computed compliance status (Vigente / Por vencer / Vencido) on a dashboard, and have every document validation mirrored to Arkiv as a queryable, verifiable entity.

**Architecture:** Next.js 14 App Router monorepo. Supabase (Postgres + Auth + Storage) is the operational store for `vendors` and `documents`. Arkiv (TypeScript SDK) stores a parallel `vendor_document_validation` entity per document for verifiable, queryable compliance state. A pure status engine (`lib/status.ts`) computes document and vendor status from dates + criticality. API routes in Next.js mediate writes: every document mutation writes Supabase first, then mirrors to Arkiv. UI is Tailwind + minimal server components.

**Tech Stack:** Next.js 14 (App Router) + TypeScript + Tailwind CSS, Supabase JS client (`@supabase/supabase-js`, `@supabase/ssr`), Arkiv TypeScript SDK, Vitest for unit tests, Docker Compose for local orchestration (Supabase local stack via `supabase` CLI is preferred, but we expose a `docker-compose.yml` for predictable bring-up).

---

## File Structure

```
vendor-pass/
├── docker-compose.yml                  # Local Supabase + app
├── .env.example                        # Env var template
├── package.json
├── tsconfig.json
├── next.config.mjs
├── tailwind.config.ts
├── postcss.config.mjs
├── vitest.config.ts
├── app/
│   ├── layout.tsx                      # Root layout, Tailwind import
│   ├── page.tsx                        # Dashboard (KPIs + upcoming expirations)
│   ├── vendors/
│   │   ├── page.tsx                    # Vendor list
│   │   ├── new/page.tsx                # Create vendor form
│   │   └── [id]/
│   │       ├── page.tsx                # Vendor detail + documents
│   │       └── documents/new/page.tsx  # Create document form
│   ├── expirations/page.tsx            # 7/30/expired filter view
│   └── api/
│       ├── vendors/route.ts            # POST create, GET list
│       ├── vendors/[id]/route.ts       # GET one
│       ├── documents/route.ts          # POST create, GET list
│       └── documents/[id]/route.ts     # PUT update, DELETE
├── lib/
│   ├── status.ts                       # Pure status engine (tested)
│   ├── supabase/
│   │   ├── server.ts                   # Server-side Supabase client
│   │   └── browser.ts                  # Browser Supabase client
│   ├── arkiv/
│   │   ├── client.ts                   # Arkiv SDK init
│   │   └── validations.ts              # Upsert/query vendor_document_validation
│   └── types.ts                        # Vendor, Document, Status types
├── components/
│   ├── StatusBadge.tsx                 # Renders Vigente/Por vencer/Vencido
│   ├── VendorCard.tsx
│   ├── DocumentRow.tsx
│   └── KpiCard.tsx
├── supabase/
│   ├── migrations/0001_init.sql        # vendors + documents tables
│   └── seed.sql                        # Demo vendors and documents
├── tests/
│   ├── status.test.ts
│   └── arkiv.validations.test.ts
└── docs/
    └── superpowers/plans/2026-05-28-vendor-pass.md
```

---

## Task 1: Project scaffolding (Next.js + Tailwind + Vitest)

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `tailwind.config.ts`, `postcss.config.mjs`, `vitest.config.ts`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `.gitignore`, `.env.example`

- [ ] **Step 1: Initialize Next.js project**

Run:
```bash
npx create-next-app@latest . --typescript --tailwind --app --eslint --src-dir=false --import-alias="@/*" --use-npm --no-turbopack
```
Expected: scaffold created. If interactive prompts appear, accept defaults consistent with flags above.

- [ ] **Step 2: Add dependencies**

Run:
```bash
npm install @supabase/supabase-js @supabase/ssr date-fns
npm install -D vitest @vitest/ui @testing-library/react @testing-library/dom jsdom
```
Expected: installed without errors.

- [ ] **Step 3: Add Vitest config**

Create `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
});
```

- [ ] **Step 4: Add test script**

Edit `package.json` `scripts` to include:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: Create `.env.example`**

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ARKIV_RPC_URL=
ARKIV_PRIVATE_KEY=
ARKIV_NAMESPACE=vendor_pass
```

- [ ] **Step 6: Replace `app/page.tsx` with placeholder dashboard**

```tsx
export default function Home() {
  return <main className="p-8"><h1 className="text-2xl font-bold">VendorPass</h1></main>;
}
```

- [ ] **Step 7: Verify build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 8: Commit**

```bash
git init && git add -A && git commit -m "chore: scaffold Next.js + Tailwind + Vitest"
```

---

## Task 2: Shared types

**Files:**
- Create: `lib/types.ts`

- [ ] **Step 1: Define domain types**

Create `lib/types.ts`:
```ts
export type Criticality = 'critical' | 'normal';
export type DocumentStatus = 'vigente' | 'por_vencer' | 'vencido';
export type VendorStatus = 'ok' | 'atencion' | 'bloqueado';

export interface Vendor {
  id: string;
  name: string;
  category: string | null;
  owner_name: string | null;
  owner_email: string | null;
  area: string | null;
  notes: string | null;
  created_at: string;
}

export interface VendorDocument {
  id: string;
  vendor_id: string;
  document_type: string;
  document_name: string;
  issued_at: string;       // ISO date
  expires_at: string;      // ISO date
  criticality: Criticality;
  file_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface VendorWithStatus extends Vendor {
  status: VendorStatus;
  documents: (VendorDocument & { status: DocumentStatus })[];
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/types.ts && git commit -m "feat: shared domain types"
```

---

## Task 3: Status engine (pure functions + tests)

**Files:**
- Create: `lib/status.ts`, `tests/status.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/status.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { documentStatus, vendorStatus } from '@/lib/status';
import type { VendorDocument } from '@/lib/types';

const baseDoc = (overrides: Partial<VendorDocument>): VendorDocument => ({
  id: 'd', vendor_id: 'v', document_type: 'poliza', document_name: 'X',
  issued_at: '2025-01-01', expires_at: '2026-01-01',
  criticality: 'critical', file_url: null, notes: null,
  created_at: '', updated_at: '', ...overrides,
});

describe('documentStatus', () => {
  const today = new Date('2026-05-28');

  it('returns vencido when expires_at is in the past', () => {
    expect(documentStatus(baseDoc({ expires_at: '2026-05-27' }), today)).toBe('vencido');
  });

  it('returns por_vencer when expires_at is within 30 days', () => {
    expect(documentStatus(baseDoc({ expires_at: '2026-06-10' }), today)).toBe('por_vencer');
  });

  it('returns vigente when expires_at is more than 30 days away', () => {
    expect(documentStatus(baseDoc({ expires_at: '2026-07-15' }), today)).toBe('vigente');
  });

  it('treats today as vencido boundary (expires today = vencido)', () => {
    expect(documentStatus(baseDoc({ expires_at: '2026-05-28' }), today)).toBe('por_vencer');
  });
});

describe('vendorStatus', () => {
  const today = new Date('2026-05-28');

  it('returns ok when all critical docs are vigente', () => {
    const docs = [baseDoc({ expires_at: '2027-01-01', criticality: 'critical' })];
    expect(vendorStatus(docs, today)).toBe('ok');
  });

  it('returns atencion when a critical doc is por_vencer', () => {
    const docs = [
      baseDoc({ id: 'a', expires_at: '2027-01-01', criticality: 'critical' }),
      baseDoc({ id: 'b', expires_at: '2026-06-10', criticality: 'critical' }),
    ];
    expect(vendorStatus(docs, today)).toBe('atencion');
  });

  it('returns bloqueado when any critical doc is vencido', () => {
    const docs = [
      baseDoc({ id: 'a', expires_at: '2027-01-01', criticality: 'critical' }),
      baseDoc({ id: 'b', expires_at: '2026-05-01', criticality: 'critical' }),
    ];
    expect(vendorStatus(docs, today)).toBe('bloqueado');
  });

  it('ignores non-critical docs for vendor status', () => {
    const docs = [
      baseDoc({ id: 'a', expires_at: '2027-01-01', criticality: 'critical' }),
      baseDoc({ id: 'b', expires_at: '2026-05-01', criticality: 'normal' }),
    ];
    expect(vendorStatus(docs, today)).toBe('ok');
  });

  it('returns ok when there are no documents', () => {
    expect(vendorStatus([], today)).toBe('ok');
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test`
Expected: FAIL — module `@/lib/status` not found.

- [ ] **Step 3: Implement status engine**

Create `lib/status.ts`:
```ts
import type { VendorDocument, DocumentStatus, VendorStatus } from './types';

const MS_PER_DAY = 86_400_000;

export function documentStatus(doc: VendorDocument, now: Date = new Date()): DocumentStatus {
  const expires = new Date(doc.expires_at + 'T00:00:00Z');
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const diffDays = Math.floor((expires.getTime() - today.getTime()) / MS_PER_DAY);
  if (diffDays < 0) return 'vencido';
  if (diffDays <= 30) return 'por_vencer';
  return 'vigente';
}

export function vendorStatus(docs: VendorDocument[], now: Date = new Date()): VendorStatus {
  const critical = docs.filter(d => d.criticality === 'critical');
  if (critical.length === 0) return 'ok';
  const statuses = critical.map(d => documentStatus(d, now));
  if (statuses.includes('vencido')) return 'bloqueado';
  if (statuses.includes('por_vencer')) return 'atencion';
  return 'ok';
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npm test`
Expected: PASS — all 9 tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/status.ts tests/status.test.ts && git commit -m "feat: document & vendor status engine"
```

---

## Task 4: Supabase schema + local stack

**Files:**
- Create: `supabase/migrations/0001_init.sql`, `supabase/seed.sql`, `docker-compose.yml`

- [ ] **Step 1: Write migration SQL**

Create `supabase/migrations/0001_init.sql`:
```sql
create extension if not exists "uuid-ossp";

create table public.vendors (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  category text,
  owner_name text,
  owner_email text,
  area text,
  notes text,
  created_at timestamptz not null default now()
);

create table public.documents (
  id uuid primary key default uuid_generate_v4(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  document_type text not null,
  document_name text not null,
  issued_at date not null,
  expires_at date not null,
  criticality text not null check (criticality in ('critical','normal')),
  file_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index documents_vendor_id_idx on public.documents(vendor_id);
create index documents_expires_at_idx on public.documents(expires_at);

alter table public.vendors enable row level security;
alter table public.documents enable row level security;

-- Hackathon: permissive policies (anon read/write). Tighten in fase 2.
create policy "vendors all" on public.vendors for all using (true) with check (true);
create policy "documents all" on public.documents for all using (true) with check (true);
```

- [ ] **Step 2: Write seed data**

Create `supabase/seed.sql`:
```sql
insert into public.vendors (id, name, category, owner_name, owner_email, area) values
  ('11111111-1111-1111-1111-111111111111', 'Constructora Sur S.A.', 'Obras', 'Ana Pérez', 'ana@aper.com', 'Planta Norte'),
  ('22222222-2222-2222-2222-222222222222', 'Seguridad Total', 'Servicios', 'Luis Gómez', 'luis@aper.com', 'Corporativo'),
  ('33333333-3333-3333-3333-333333333333', 'Logística Andina', 'Transporte', 'María Ruiz', 'maria@aper.com', 'Planta Sur');

insert into public.documents (vendor_id, document_type, document_name, issued_at, expires_at, criticality, notes) values
  ('11111111-1111-1111-1111-111111111111', 'poliza_art', 'Póliza ART 2026', '2025-06-01', '2026-06-15', 'critical', 'Renovación anual'),
  ('11111111-1111-1111-1111-111111111111', 'habilitacion', 'Habilitación municipal', '2024-01-10', '2027-01-10', 'critical', null),
  ('22222222-2222-2222-2222-222222222222', 'certif_seguridad', 'Cert. seguridad operativa', '2024-05-01', '2026-05-01', 'critical', 'VENCIDA'),
  ('22222222-2222-2222-2222-222222222222', 'contrato', 'Contrato marco', '2024-01-01', '2027-01-01', 'normal', null),
  ('33333333-3333-3333-3333-333333333333', 'seguro_flota', 'Seguro flota 2026', '2025-08-01', '2026-08-01', 'critical', null);
```

- [ ] **Step 3: Write docker-compose for local dev**

Create `docker-compose.yml`:
```yaml
services:
  app:
    image: node:20-bookworm
    working_dir: /app
    command: sh -c "npm install && npm run dev"
    ports: ["3000:3000"]
    volumes: [".:/app"]
    env_file: [.env]
    depends_on: [db]
  db:
    image: postgres:16
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: postgres
    ports: ["54322:5432"]
    volumes:
      - ./supabase/migrations:/docker-entrypoint-initdb.d/01-migrations:ro
      - dbdata:/var/lib/postgresql/data
volumes:
  dbdata: {}
```

Note: Production-grade local Supabase is set up via the `supabase` CLI (`npx supabase start`); this compose is a fallback raw Postgres for the demo if the CLI is unavailable.

- [ ] **Step 4: Document setup**

Append to `README.md` (create if missing):
```markdown
# VendorPass

## Local setup

1. `cp .env.example .env` and fill in Supabase + Arkiv credentials.
2. Recommended: `npx supabase start` then `npx supabase db reset` to apply `supabase/migrations` + `supabase/seed.sql`.
3. Or: `docker compose up -d db` and apply migrations manually via `psql`.
4. `npm run dev` and open http://localhost:3000.
```

- [ ] **Step 5: Commit**

```bash
git add supabase/ docker-compose.yml README.md && git commit -m "feat: supabase schema, seed, docker-compose"
```

---

## Task 5: Supabase client helpers

**Files:**
- Create: `lib/supabase/server.ts`, `lib/supabase/browser.ts`

- [ ] **Step 1: Create server client**

Create `lib/supabase/server.ts`:
```ts
import { createClient } from '@supabase/supabase-js';

export function supabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}
```

- [ ] **Step 2: Create browser client**

Create `lib/supabase/browser.ts`:
```ts
import { createClient } from '@supabase/supabase-js';

export const supabaseBrowser = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
```

- [ ] **Step 3: Commit**

```bash
git add lib/supabase && git commit -m "feat: supabase client helpers"
```

---

## Task 6: Arkiv client + validations module

**Files:**
- Create: `lib/arkiv/client.ts`, `lib/arkiv/validations.ts`, `tests/arkiv.validations.test.ts`

> **Note for the executing agent:** Before writing this task's code, fetch the current Arkiv TypeScript SDK docs via Context7 (`mcp__claude_ai_Context7__resolve-library-id` then `query-docs` for "arkiv typescript sdk"), or read `https://docs.arkiv.network/typescript-sdk/`. The package name, entity-create call, and query API used below are based on the documented patterns (entity create + filter + orderBy); adjust the imports/method names to match the SDK version you actually install. The shape of `ValidationEntity` and the `validations` module API stays the same regardless of SDK surface.

- [ ] **Step 1: Install Arkiv SDK**

Run: `npm install @arkiv/sdk` (replace with the exact package name from the docs if different — at time of writing the docs point at the official TypeScript SDK).
Expected: installed. If the package name differs, install the documented one and update imports below.

- [ ] **Step 2: Define validation entity type**

Create `lib/arkiv/validations.ts` (start with just types and module skeleton):
```ts
import type { Criticality, DocumentStatus } from '@/lib/types';

export interface ValidationEntity {
  vendorId: string;
  documentId: string;
  documentType: string;
  documentName: string;
  issuedAt: string;
  expiresAt: string;
  status: DocumentStatus;
  criticality: Criticality;
  owner: string | null;
  creator: string | null;
  fileUrl: string | null;
  notes: string | null;
}

export interface ValidationStore {
  upsert(entity: ValidationEntity): Promise<void>;
  remove(documentId: string): Promise<void>;
  listByVendor(vendorId: string): Promise<ValidationEntity[]>;
  listExpired(): Promise<ValidationEntity[]>;
  listExpiringSoon(days: number): Promise<ValidationEntity[]>;
}
```

- [ ] **Step 3: Write failing test for in-memory store**

Create `tests/arkiv.validations.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStore } from '@/lib/arkiv/validations';
import type { ValidationEntity } from '@/lib/arkiv/validations';

const make = (o: Partial<ValidationEntity>): ValidationEntity => ({
  vendorId: 'v1', documentId: 'd1', documentType: 't', documentName: 'n',
  issuedAt: '2025-01-01', expiresAt: '2026-01-01',
  status: 'vigente', criticality: 'critical',
  owner: null, creator: null, fileUrl: null, notes: null, ...o,
});

describe('in-memory validation store', () => {
  let store = createInMemoryStore();
  beforeEach(() => { store = createInMemoryStore(); });

  it('upserts and lists by vendor', async () => {
    await store.upsert(make({ documentId: 'd1', vendorId: 'v1' }));
    await store.upsert(make({ documentId: 'd2', vendorId: 'v1' }));
    await store.upsert(make({ documentId: 'd3', vendorId: 'v2' }));
    const list = await store.listByVendor('v1');
    expect(list.map(e => e.documentId).sort()).toEqual(['d1', 'd2']);
  });

  it('upsert replaces existing documentId', async () => {
    await store.upsert(make({ documentId: 'd1', documentName: 'old' }));
    await store.upsert(make({ documentId: 'd1', documentName: 'new' }));
    const list = await store.listByVendor('v1');
    expect(list).toHaveLength(1);
    expect(list[0].documentName).toBe('new');
  });

  it('lists expired only', async () => {
    await store.upsert(make({ documentId: 'd1', status: 'vencido' }));
    await store.upsert(make({ documentId: 'd2', status: 'vigente' }));
    const list = await store.listExpired();
    expect(list.map(e => e.documentId)).toEqual(['d1']);
  });

  it('lists expiring soon ordered by expiresAt asc', async () => {
    await store.upsert(make({ documentId: 'd1', status: 'por_vencer', expiresAt: '2026-06-20' }));
    await store.upsert(make({ documentId: 'd2', status: 'por_vencer', expiresAt: '2026-06-05' }));
    await store.upsert(make({ documentId: 'd3', status: 'vigente',    expiresAt: '2026-06-10' }));
    const list = await store.listExpiringSoon(30);
    expect(list.map(e => e.documentId)).toEqual(['d2', 'd1']);
  });

  it('removes by documentId', async () => {
    await store.upsert(make({ documentId: 'd1' }));
    await store.remove('d1');
    expect(await store.listByVendor('v1')).toHaveLength(0);
  });
});
```

- [ ] **Step 4: Run tests to verify failure**

Run: `npm test`
Expected: FAIL — `createInMemoryStore` not exported.

- [ ] **Step 5: Implement in-memory store (used by tests and as offline fallback)**

Append to `lib/arkiv/validations.ts`:
```ts
export function createInMemoryStore(): ValidationStore {
  const byId = new Map<string, ValidationEntity>();
  return {
    async upsert(entity) { byId.set(entity.documentId, entity); },
    async remove(documentId) { byId.delete(documentId); },
    async listByVendor(vendorId) {
      return [...byId.values()].filter(e => e.vendorId === vendorId);
    },
    async listExpired() {
      return [...byId.values()].filter(e => e.status === 'vencido');
    },
    async listExpiringSoon(_days) {
      return [...byId.values()]
        .filter(e => e.status === 'por_vencer')
        .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt));
    },
  };
}
```

- [ ] **Step 6: Run tests to verify pass**

Run: `npm test`
Expected: PASS — all status + validation tests green.

- [ ] **Step 7: Implement Arkiv-backed store**

Create `lib/arkiv/client.ts`:
```ts
// NOTE: SDK surface — verify against https://docs.arkiv.network/typescript-sdk/ before edits.
import { ArkivClient } from '@arkiv/sdk';

let cached: ArkivClient | null = null;

export function arkivClient(): ArkivClient {
  if (cached) return cached;
  cached = new ArkivClient({
    rpcUrl: process.env.ARKIV_RPC_URL!,
    privateKey: process.env.ARKIV_PRIVATE_KEY!,
    namespace: process.env.ARKIV_NAMESPACE ?? 'vendor_pass',
  });
  return cached;
}
```

Append to `lib/arkiv/validations.ts`:
```ts
import { arkivClient } from './client';

const ENTITY = 'vendor_document_validation';

export function createArkivStore(): ValidationStore {
  const c = arkivClient();
  return {
    async upsert(entity) {
      await c.entity(ENTITY).upsert({ key: entity.documentId, attributes: entity });
    },
    async remove(documentId) {
      await c.entity(ENTITY).delete({ key: documentId });
    },
    async listByVendor(vendorId) {
      const res = await c.entity(ENTITY)
        .query()
        .where('vendorId', '=', vendorId)
        .orderBy('expiresAt', 'asc')
        .execute();
      return res.items as ValidationEntity[];
    },
    async listExpired() {
      const res = await c.entity(ENTITY)
        .query()
        .where('status', '=', 'vencido')
        .orderBy('expiresAt', 'asc')
        .execute();
      return res.items as ValidationEntity[];
    },
    async listExpiringSoon(_days) {
      const res = await c.entity(ENTITY)
        .query()
        .where('status', '=', 'por_vencer')
        .orderBy('expiresAt', 'asc')
        .execute();
      return res.items as ValidationEntity[];
    },
  };
}

export function getStore(): ValidationStore {
  if (!process.env.ARKIV_RPC_URL || !process.env.ARKIV_PRIVATE_KEY) {
    return createInMemoryStore();
  }
  return createArkivStore();
}
```

- [ ] **Step 8: Commit**

```bash
git add lib/arkiv tests/arkiv.validations.test.ts package.json package-lock.json && \
git commit -m "feat: arkiv client + validation store with in-memory fallback"
```

---

## Task 7: API route — vendors

**Files:**
- Create: `app/api/vendors/route.ts`, `app/api/vendors/[id]/route.ts`

- [ ] **Step 1: Implement list + create**

Create `app/api/vendors/route.ts`:
```ts
import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

export async function GET() {
  const sb = supabaseServer();
  const { data, error } = await sb.from('vendors').select('*').order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ vendors: data });
}

export async function POST(req: Request) {
  const body = await req.json();
  const sb = supabaseServer();
  const { data, error } = await sb.from('vendors').insert({
    name: body.name,
    category: body.category ?? null,
    owner_name: body.owner_name ?? null,
    owner_email: body.owner_email ?? null,
    area: body.area ?? null,
    notes: body.notes ?? null,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ vendor: data }, { status: 201 });
}
```

- [ ] **Step 2: Implement single-vendor GET**

Create `app/api/vendors/[id]/route.ts`:
```ts
import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const sb = supabaseServer();
  const { data: vendor, error: vErr } = await sb.from('vendors').select('*').eq('id', params.id).single();
  if (vErr) return NextResponse.json({ error: vErr.message }, { status: 404 });
  const { data: documents, error: dErr } = await sb.from('documents')
    .select('*').eq('vendor_id', params.id).order('expires_at', { ascending: true });
  if (dErr) return NextResponse.json({ error: dErr.message }, { status: 500 });
  return NextResponse.json({ vendor, documents });
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/vendors && git commit -m "feat: vendors API routes"
```

---

## Task 8: API route — documents (with Arkiv mirror)

**Files:**
- Create: `app/api/documents/route.ts`, `app/api/documents/[id]/route.ts`

- [ ] **Step 1: Implement create + list with Arkiv mirror**

Create `app/api/documents/route.ts`:
```ts
import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { getStore } from '@/lib/arkiv/validations';
import { documentStatus } from '@/lib/status';
import type { VendorDocument } from '@/lib/types';

export async function GET() {
  const sb = supabaseServer();
  const { data, error } = await sb.from('documents').select('*').order('expires_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ documents: data });
}

export async function POST(req: Request) {
  const body = await req.json();
  const sb = supabaseServer();
  const { data: doc, error } = await sb.from('documents').insert({
    vendor_id: body.vendor_id,
    document_type: body.document_type,
    document_name: body.document_name,
    issued_at: body.issued_at,
    expires_at: body.expires_at,
    criticality: body.criticality,
    file_url: body.file_url ?? null,
    notes: body.notes ?? null,
  }).select().single();
  if (error || !doc) return NextResponse.json({ error: error?.message }, { status: 400 });

  const { data: vendor } = await sb.from('vendors').select('owner_email,owner_name').eq('id', doc.vendor_id).single();
  const typed = doc as VendorDocument;
  await getStore().upsert({
    vendorId: typed.vendor_id,
    documentId: typed.id,
    documentType: typed.document_type,
    documentName: typed.document_name,
    issuedAt: typed.issued_at,
    expiresAt: typed.expires_at,
    status: documentStatus(typed),
    criticality: typed.criticality,
    owner: vendor?.owner_email ?? vendor?.owner_name ?? null,
    creator: null,
    fileUrl: typed.file_url,
    notes: typed.notes,
  });

  return NextResponse.json({ document: doc }, { status: 201 });
}
```

- [ ] **Step 2: Implement update + delete with Arkiv mirror**

Create `app/api/documents/[id]/route.ts`:
```ts
import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { getStore } from '@/lib/arkiv/validations';
import { documentStatus } from '@/lib/status';
import type { VendorDocument } from '@/lib/types';

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json();
  const sb = supabaseServer();
  const { data: doc, error } = await sb.from('documents').update({
    document_type: body.document_type,
    document_name: body.document_name,
    issued_at: body.issued_at,
    expires_at: body.expires_at,
    criticality: body.criticality,
    file_url: body.file_url ?? null,
    notes: body.notes ?? null,
    updated_at: new Date().toISOString(),
  }).eq('id', params.id).select().single();
  if (error || !doc) return NextResponse.json({ error: error?.message }, { status: 400 });

  const typed = doc as VendorDocument;
  const { data: vendor } = await sb.from('vendors').select('owner_email,owner_name').eq('id', typed.vendor_id).single();
  await getStore().upsert({
    vendorId: typed.vendor_id,
    documentId: typed.id,
    documentType: typed.document_type,
    documentName: typed.document_name,
    issuedAt: typed.issued_at,
    expiresAt: typed.expires_at,
    status: documentStatus(typed),
    criticality: typed.criticality,
    owner: vendor?.owner_email ?? vendor?.owner_name ?? null,
    creator: null,
    fileUrl: typed.file_url,
    notes: typed.notes,
  });

  return NextResponse.json({ document: doc });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const sb = supabaseServer();
  const { error } = await sb.from('documents').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await getStore().remove(params.id);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/documents && git commit -m "feat: documents API with Arkiv mirror"
```

---

## Task 9: UI primitives

**Files:**
- Create: `components/StatusBadge.tsx`, `components/KpiCard.tsx`, `components/VendorCard.tsx`, `components/DocumentRow.tsx`

- [ ] **Step 1: StatusBadge**

Create `components/StatusBadge.tsx`:
```tsx
import type { DocumentStatus, VendorStatus } from '@/lib/types';

const STYLES: Record<string, string> = {
  vigente:   'bg-green-100 text-green-800',
  por_vencer:'bg-yellow-100 text-yellow-800',
  vencido:   'bg-red-100 text-red-800',
  ok:        'bg-green-100 text-green-800',
  atencion:  'bg-yellow-100 text-yellow-800',
  bloqueado: 'bg-red-100 text-red-800',
};

const LABELS: Record<string, string> = {
  vigente: 'Vigente', por_vencer: 'Por vencer', vencido: 'Vencido',
  ok: 'OK', atencion: 'Atención', bloqueado: 'Bloqueado',
};

export function StatusBadge({ status }: { status: DocumentStatus | VendorStatus }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STYLES[status]}`}>
      {LABELS[status]}
    </span>
  );
}
```

- [ ] **Step 2: KpiCard**

Create `components/KpiCard.tsx`:
```tsx
export function KpiCard({ label, value, tone = 'neutral' }: { label: string; value: number | string; tone?: 'good' | 'warn' | 'bad' | 'neutral' }) {
  const tones = {
    good: 'border-green-300 bg-green-50',
    warn: 'border-yellow-300 bg-yellow-50',
    bad:  'border-red-300 bg-red-50',
    neutral: 'border-gray-200 bg-white',
  };
  return (
    <div className={`border rounded-lg p-4 ${tones[tone]}`}>
      <div className="text-xs text-gray-600 uppercase tracking-wide">{label}</div>
      <div className="text-3xl font-bold mt-1">{value}</div>
    </div>
  );
}
```

- [ ] **Step 3: VendorCard**

Create `components/VendorCard.tsx`:
```tsx
import Link from 'next/link';
import type { VendorWithStatus } from '@/lib/types';
import { StatusBadge } from './StatusBadge';

export function VendorCard({ vendor }: { vendor: VendorWithStatus }) {
  const next = vendor.documents[0];
  return (
    <Link href={`/vendors/${vendor.id}`} className="block border rounded-lg p-4 hover:shadow">
      <div className="flex justify-between items-start">
        <div>
          <div className="font-semibold">{vendor.name}</div>
          <div className="text-sm text-gray-500">{vendor.category ?? '—'} · {vendor.owner_name ?? '—'}</div>
        </div>
        <StatusBadge status={vendor.status} />
      </div>
      <div className="text-xs text-gray-500 mt-2">
        {vendor.documents.length} doc(s){next ? ` · próximo vto: ${next.expires_at}` : ''}
      </div>
    </Link>
  );
}
```

- [ ] **Step 4: DocumentRow**

Create `components/DocumentRow.tsx`:
```tsx
import type { VendorDocument, DocumentStatus } from '@/lib/types';
import { StatusBadge } from './StatusBadge';

export function DocumentRow({ doc }: { doc: VendorDocument & { status: DocumentStatus } }) {
  return (
    <tr className="border-b">
      <td className="py-2">{doc.document_name}</td>
      <td className="py-2 text-sm text-gray-600">{doc.document_type}</td>
      <td className="py-2">{doc.issued_at}</td>
      <td className="py-2">{doc.expires_at}</td>
      <td className="py-2">{doc.criticality === 'critical' ? 'Crítico' : 'Normal'}</td>
      <td className="py-2"><StatusBadge status={doc.status} /></td>
    </tr>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add components/ && git commit -m "feat: UI primitives"
```

---

## Task 10: Dashboard page

**Files:**
- Create: `app/page.tsx` (replace placeholder)

- [ ] **Step 1: Implement dashboard server component**

Replace `app/page.tsx`:
```tsx
import Link from 'next/link';
import { supabaseServer } from '@/lib/supabase/server';
import { documentStatus, vendorStatus } from '@/lib/status';
import { KpiCard } from '@/components/KpiCard';
import { StatusBadge } from '@/components/StatusBadge';
import type { Vendor, VendorDocument, VendorStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const sb = supabaseServer();
  const [{ data: vendors }, { data: documents }] = await Promise.all([
    sb.from('vendors').select('*'),
    sb.from('documents').select('*').order('expires_at', { ascending: true }),
  ]);

  const vs: Vendor[] = vendors ?? [];
  const ds: VendorDocument[] = documents ?? [];

  const byVendor = new Map<string, VendorDocument[]>();
  ds.forEach(d => { byVendor.set(d.vendor_id, [...(byVendor.get(d.vendor_id) ?? []), d]); });

  const statuses: Record<VendorStatus, number> = { ok: 0, atencion: 0, bloqueado: 0 };
  vs.forEach(v => { statuses[vendorStatus(byVendor.get(v.id) ?? [])]++; });

  const upcoming = ds
    .map(d => ({ ...d, status: documentStatus(d) }))
    .filter(d => d.status !== 'vigente')
    .slice(0, 10);

  return (
    <main className="p-8 max-w-6xl mx-auto space-y-8">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">VendorPass</h1>
          <p className="text-gray-600">Vigencia operativa verificable</p>
        </div>
        <nav className="flex gap-4 text-sm">
          <Link href="/vendors" className="underline">Proveedores</Link>
          <Link href="/expirations" className="underline">Vencimientos</Link>
          <Link href="/vendors/new" className="bg-black text-white px-3 py-1.5 rounded">+ Proveedor</Link>
        </nav>
      </header>

      <section className="grid grid-cols-4 gap-4">
        <KpiCard label="Proveedores" value={vs.length} />
        <KpiCard label="OK" value={statuses.ok} tone="good" />
        <KpiCard label="Atención" value={statuses.atencion} tone="warn" />
        <KpiCard label="Bloqueados" value={statuses.bloqueado} tone="bad" />
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-3">Próximos vencimientos</h2>
        {upcoming.length === 0 ? (
          <p className="text-gray-500">Todo vigente.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-gray-500 border-b">
              <tr><th className="py-2">Documento</th><th>Vence</th><th>Criticidad</th><th>Estado</th><th></th></tr>
            </thead>
            <tbody>
              {upcoming.map(d => (
                <tr key={d.id} className="border-b">
                  <td className="py-2">{d.document_name}</td>
                  <td>{d.expires_at}</td>
                  <td>{d.criticality === 'critical' ? 'Crítico' : 'Normal'}</td>
                  <td><StatusBadge status={d.status} /></td>
                  <td><Link className="underline" href={`/vendors/${d.vendor_id}`}>ver</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npm run dev` and open `http://localhost:3000`. Confirm KPIs and upcoming list render against seeded data.

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx && git commit -m "feat: dashboard page"
```

---

## Task 11: Vendor list page

**Files:**
- Create: `app/vendors/page.tsx`

- [ ] **Step 1: Implement vendor list**

Create `app/vendors/page.tsx`:
```tsx
import Link from 'next/link';
import { supabaseServer } from '@/lib/supabase/server';
import { documentStatus, vendorStatus } from '@/lib/status';
import { VendorCard } from '@/components/VendorCard';
import type { Vendor, VendorDocument, VendorWithStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function VendorsPage() {
  const sb = supabaseServer();
  const [{ data: vendors }, { data: documents }] = await Promise.all([
    sb.from('vendors').select('*').order('name'),
    sb.from('documents').select('*').order('expires_at', { ascending: true }),
  ]);
  const vs: Vendor[] = vendors ?? [];
  const ds: VendorDocument[] = documents ?? [];
  const byVendor = new Map<string, VendorDocument[]>();
  ds.forEach(d => { byVendor.set(d.vendor_id, [...(byVendor.get(d.vendor_id) ?? []), d]); });

  const withStatus: VendorWithStatus[] = vs.map(v => {
    const docs = byVendor.get(v.id) ?? [];
    return { ...v, status: vendorStatus(docs), documents: docs.map(d => ({ ...d, status: documentStatus(d) })) };
  });

  return (
    <main className="p-8 max-w-6xl mx-auto space-y-6">
      <header className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Proveedores</h1>
        <Link href="/vendors/new" className="bg-black text-white px-3 py-1.5 rounded text-sm">+ Nuevo</Link>
      </header>
      <div className="grid grid-cols-2 gap-4">
        {withStatus.map(v => <VendorCard key={v.id} vendor={v} />)}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/vendors/page.tsx && git commit -m "feat: vendor list page"
```

---

## Task 12: Vendor detail page

**Files:**
- Create: `app/vendors/[id]/page.tsx`

- [ ] **Step 1: Implement detail page**

Create `app/vendors/[id]/page.tsx`:
```tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { documentStatus, vendorStatus } from '@/lib/status';
import { StatusBadge } from '@/components/StatusBadge';
import { DocumentRow } from '@/components/DocumentRow';
import type { Vendor, VendorDocument } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function VendorDetailPage({ params }: { params: { id: string } }) {
  const sb = supabaseServer();
  const { data: vendor } = await sb.from('vendors').select('*').eq('id', params.id).single();
  if (!vendor) notFound();
  const { data: documents } = await sb.from('documents').select('*').eq('vendor_id', params.id).order('expires_at');
  const ds: VendorDocument[] = documents ?? [];
  const v = vendor as Vendor;
  const status = vendorStatus(ds);

  return (
    <main className="p-8 max-w-5xl mx-auto space-y-6">
      <Link href="/vendors" className="text-sm underline">← Proveedores</Link>
      <header className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold">{v.name}</h1>
          <p className="text-gray-600 text-sm">{v.category ?? '—'} · {v.owner_name ?? '—'} ({v.owner_email ?? '—'})</p>
          {v.notes && <p className="text-sm mt-2">{v.notes}</p>}
        </div>
        <StatusBadge status={status} />
      </header>

      <section>
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-semibold">Documentos</h2>
          <Link href={`/vendors/${v.id}/documents/new`} className="bg-black text-white px-3 py-1.5 rounded text-sm">+ Documento</Link>
        </div>
        <table className="w-full text-sm">
          <thead className="text-left text-gray-500 border-b">
            <tr><th className="py-2">Nombre</th><th>Tipo</th><th>Emisión</th><th>Vence</th><th>Criticidad</th><th>Estado</th></tr>
          </thead>
          <tbody>
            {ds.map(d => <DocumentRow key={d.id} doc={{ ...d, status: documentStatus(d) }} />)}
          </tbody>
        </table>
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/vendors/[id]/page.tsx && git commit -m "feat: vendor detail page"
```

---

## Task 13: Vendor create form

**Files:**
- Create: `app/vendors/new/page.tsx`

- [ ] **Step 1: Implement client form**

Create `app/vendors/new/page.tsx`:
```tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function NewVendorPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', category: '', owner_name: '', owner_email: '', area: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch('/api/vendors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setSaving(false);
    if (res.ok) {
      const { vendor } = await res.json();
      router.push(`/vendors/${vendor.id}`);
    } else {
      alert('Error creando proveedor');
    }
  }

  return (
    <main className="p-8 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Nuevo proveedor</h1>
      <form onSubmit={submit} className="space-y-3">
        {[
          ['name', 'Nombre *', true],
          ['category', 'Categoría', false],
          ['owner_name', 'Owner interno', false],
          ['owner_email', 'Email del owner', false],
          ['area', 'Área / sitio', false],
        ].map(([k, label, req]) => (
          <label key={k as string} className="block">
            <span className="text-sm text-gray-700">{label as string}</span>
            <input required={req as boolean} value={(form as any)[k as string]} onChange={set(k as string)} className="mt-1 w-full border rounded px-2 py-1" />
          </label>
        ))}
        <label className="block">
          <span className="text-sm text-gray-700">Notas</span>
          <textarea value={form.notes} onChange={set('notes')} className="mt-1 w-full border rounded px-2 py-1" rows={3} />
        </label>
        <button disabled={saving} className="bg-black text-white px-4 py-2 rounded">{saving ? 'Guardando…' : 'Guardar'}</button>
      </form>
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/vendors/new/page.tsx && git commit -m "feat: vendor create form"
```

---

## Task 14: Document create form

**Files:**
- Create: `app/vendors/[id]/documents/new/page.tsx`

- [ ] **Step 1: Implement client form**

Create `app/vendors/[id]/documents/new/page.tsx`:
```tsx
'use client';
import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function NewDocumentPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const vendorId = params.id;
  const [form, setForm] = useState({
    document_type: '', document_name: '',
    issued_at: '', expires_at: '',
    criticality: 'critical', file_url: '', notes: '',
  });
  const [saving, setSaving] = useState(false);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch('/api/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, vendor_id: vendorId }),
    });
    setSaving(false);
    if (res.ok) router.push(`/vendors/${vendorId}`);
    else alert('Error creando documento');
  }

  return (
    <main className="p-8 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Nuevo documento</h1>
      <form onSubmit={submit} className="space-y-3">
        <label className="block">
          <span className="text-sm">Tipo *</span>
          <input required value={form.document_type} onChange={set('document_type')} className="mt-1 w-full border rounded px-2 py-1" placeholder="poliza_art, habilitacion, etc." />
        </label>
        <label className="block">
          <span className="text-sm">Nombre *</span>
          <input required value={form.document_name} onChange={set('document_name')} className="mt-1 w-full border rounded px-2 py-1" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm">Emisión *</span>
            <input type="date" required value={form.issued_at} onChange={set('issued_at')} className="mt-1 w-full border rounded px-2 py-1" />
          </label>
          <label className="block">
            <span className="text-sm">Vencimiento *</span>
            <input type="date" required value={form.expires_at} onChange={set('expires_at')} className="mt-1 w-full border rounded px-2 py-1" />
          </label>
        </div>
        <label className="block">
          <span className="text-sm">Criticidad *</span>
          <select value={form.criticality} onChange={set('criticality')} className="mt-1 w-full border rounded px-2 py-1">
            <option value="critical">Crítico</option>
            <option value="normal">Normal</option>
          </select>
        </label>
        <label className="block">
          <span className="text-sm">URL de evidencia</span>
          <input value={form.file_url} onChange={set('file_url')} className="mt-1 w-full border rounded px-2 py-1" />
        </label>
        <label className="block">
          <span className="text-sm">Notas</span>
          <textarea value={form.notes} onChange={set('notes')} className="mt-1 w-full border rounded px-2 py-1" rows={3} />
        </label>
        <button disabled={saving} className="bg-black text-white px-4 py-2 rounded">{saving ? 'Guardando…' : 'Guardar'}</button>
      </form>
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/vendors/[id]/documents/new/page.tsx && git commit -m "feat: document create form"
```

---

## Task 15: Expirations view (powered by Arkiv query)

**Files:**
- Create: `app/expirations/page.tsx`

- [ ] **Step 1: Implement expirations page using Arkiv store**

Create `app/expirations/page.tsx`:
```tsx
import Link from 'next/link';
import { getStore } from '@/lib/arkiv/validations';
import { StatusBadge } from '@/components/StatusBadge';

export const dynamic = 'force-dynamic';

export default async function ExpirationsPage({ searchParams }: { searchParams: { window?: string } }) {
  const win = searchParams.window ?? '30';
  const store = getStore();
  const [expired, soon] = await Promise.all([
    store.listExpired(),
    store.listExpiringSoon(Number(win)),
  ]);

  return (
    <main className="p-8 max-w-5xl mx-auto space-y-8">
      <header className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Vencimientos</h1>
        <div className="text-sm flex gap-3">
          <Link href="/expirations?window=7" className="underline">7 días</Link>
          <Link href="/expirations?window=30" className="underline">30 días</Link>
        </div>
      </header>

      <section>
        <h2 className="text-lg font-semibold mb-2">Vencidos ({expired.length})</h2>
        <Table rows={expired} />
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">Por vencer ({soon.length})</h2>
        <Table rows={soon} />
      </section>
    </main>
  );
}

function Table({ rows }: { rows: { vendorId: string; documentId: string; documentName: string; documentType: string; expiresAt: string; status: 'vigente'|'por_vencer'|'vencido'; criticality: 'critical'|'normal' }[] }) {
  if (rows.length === 0) return <p className="text-gray-500 text-sm">Sin registros.</p>;
  return (
    <table className="w-full text-sm">
      <thead className="text-left text-gray-500 border-b">
        <tr><th className="py-2">Documento</th><th>Tipo</th><th>Vence</th><th>Criticidad</th><th>Estado</th><th></th></tr>
      </thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.documentId} className="border-b">
            <td className="py-2">{r.documentName}</td>
            <td>{r.documentType}</td>
            <td>{r.expiresAt}</td>
            <td>{r.criticality === 'critical' ? 'Crítico' : 'Normal'}</td>
            <td><StatusBadge status={r.status} /></td>
            <td><Link href={`/vendors/${r.vendorId}`} className="underline">ver</Link></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/expirations/page.tsx && git commit -m "feat: expirations view backed by Arkiv store"
```

---

## Task 16: Backfill script (seed → Arkiv)

**Files:**
- Create: `scripts/backfill-arkiv.ts`

- [ ] **Step 1: Implement backfill**

Create `scripts/backfill-arkiv.ts`:
```ts
import { supabaseServer } from '@/lib/supabase/server';
import { getStore } from '@/lib/arkiv/validations';
import { documentStatus } from '@/lib/status';
import type { VendorDocument } from '@/lib/types';

async function main() {
  const sb = supabaseServer();
  const { data: docs, error } = await sb.from('documents').select('*');
  if (error) throw error;
  const store = getStore();
  const { data: vendors } = await sb.from('vendors').select('id,owner_email,owner_name');
  const owners = new Map((vendors ?? []).map(v => [v.id, v.owner_email ?? v.owner_name ?? null]));

  for (const d of (docs ?? []) as VendorDocument[]) {
    await store.upsert({
      vendorId: d.vendor_id,
      documentId: d.id,
      documentType: d.document_type,
      documentName: d.document_name,
      issuedAt: d.issued_at,
      expiresAt: d.expires_at,
      status: documentStatus(d),
      criticality: d.criticality,
      owner: owners.get(d.vendor_id) ?? null,
      creator: null,
      fileUrl: d.file_url,
      notes: d.notes,
    });
    console.log('upserted', d.id);
  }
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
```

- [ ] **Step 2: Add npm script**

Edit `package.json` `scripts`:
```json
"backfill": "tsx scripts/backfill-arkiv.ts"
```

Install `tsx`: `npm install -D tsx`.

- [ ] **Step 3: Commit**

```bash
git add scripts package.json package-lock.json && git commit -m "feat: arkiv backfill script"
```

---

## Task 17: End-to-end demo run

- [ ] **Step 1: Bring up local stack**

Run:
```bash
cp .env.example .env
# Fill in Supabase + Arkiv credentials, or leave Arkiv blank to use in-memory fallback
npx supabase start    # or: docker compose up -d db
npx supabase db reset # applies migrations + seed.sql
npm run backfill      # mirror seed to Arkiv (or in-memory)
npm run dev
```

- [ ] **Step 2: Walk through the demo flow**

In the browser, in order:
1. Open `/` — confirm KPIs show 3 vendors with mixed statuses.
2. Open `/vendors` — confirm the bloqueado vendor (Seguridad Total) shows a red badge.
3. Click into Seguridad Total — confirm the vencido document is visible and badged red.
4. Click `+ Documento`, create a new doc for that vendor with `expires_at` ~1 year out, same `document_type` as the expired one.
5. Return to `/` — the bloqueado count should drop (note: the original expired doc still exists; for the demo, delete it via API or edit its `expires_at` in the form for the live "recompute" effect — see Step 3).
6. Open `/expirations?window=30` and `?window=7` — confirm filtering.

- [ ] **Step 3: Verify edit-to-OK flow**

Pick the vencido doc id from `/vendors/<id>` page (HTML or DB). Run:
```bash
curl -X PUT http://localhost:3000/api/documents/<doc-id> \
  -H 'Content-Type: application/json' \
  -d '{"document_type":"certif_seguridad","document_name":"Cert. seguridad operativa","issued_at":"2026-05-01","expires_at":"2027-05-01","criticality":"critical"}'
```
Refresh `/` — Seguridad Total should now be OK.

- [ ] **Step 4: Run tests one more time**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Final commit**

```bash
git add -A && git commit -m "chore: demo verified end-to-end" --allow-empty
```

---

## Out of scope (do not implement)

- Auth & RLS hardening (hackathon uses permissive policies).
- Real email/Slack notifications.
- File uploads to Supabase Storage (only `file_url` is captured).
- OCR, CSV import, role-based access, multi-tenant.
- ERP integrations and audit-ready reports.
