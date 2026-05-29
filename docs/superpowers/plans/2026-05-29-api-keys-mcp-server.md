# API Keys + MCP Server — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (1) Que cada usuario genere hasta 5 API keys con nombre, mostradas en texto plano **una sola vez** al crearlas (copiables las veces que quiera mientras la pantalla esté abierta, nunca más después). (2) Un MCP server que permita conectar a Claude (Desktop / Code) con VendorPass usando esa API key, exponiendo como herramientas los datos de cumplimiento, la **verificación de documentos en Arkiv**, la **auditoría de paridad** DB↔blockchain y los **reportes de auditoría**.

**Architecture:** Tabla `api_keys` (RLS por dueño) que guarda **solo el hash SHA-256** de la clave + un prefijo visible. La gestión (crear/listar/revocar) usa la sesión por cookie (`requireUser`). Una nueva superficie REST versionada `/api/v1/*` se autentica por API key vía `requireApiKey()`, que resuelve la clave con el cliente service-role (`supabaseAdmin()`) y **filtra explícitamente por `user_id`** (no hay RLS sin sesión). La lógica de cumplimiento se reutiliza de `lib/status.ts`, y las capacidades Arkiv (verificar un documento contra la cadena, auditar la paridad DB↔Arkiv y generar un reporte de auditoría) reutilizan `lib/arkiv/validations.ts` y `auditArkivParity` (extendido para scopear por `userId`, porque sin sesión no hay RLS). El MCP server es un proceso stdio independiente (`mcp-server/`, paquete propio con `@modelcontextprotocol/sdk`) que llama a `/api/v1/*` con la API key en `Authorization: Bearer`. La página de UI vive en `/integrations` (no `/api-keys`, que colisionaría con el prefijo `/api` del middleware).

**Tech Stack:** Next.js 16.2.6 (App Router, route handlers con `params: Promise<…>`), Supabase (`@supabase/ssr`, RLS, service-role), Node `crypto` (sin dependencias nuevas en la app), `@modelcontextprotocol/sdk` + `zod` (solo en `mcp-server/`), TypeScript, Vitest.

**Decisiones tomadas (objetá si querés cambiarlas):**
- **Transporte del MCP: stdio** (proceso local agregado a Claude Desktop/Code), no HTTP remoto. Es lo más robusto y universalmente demoable. El MCP HTTP remoto queda como *stretch* al final.
- **Hash, no cifrado:** se guarda SHA-256 de la clave; es irrecuperable, por eso se muestra una sola vez (igual que GitHub/Stripe/OpenAI).
- **Revocación soft:** `revoked_at` (no DELETE físico) para conservar auditoría de `last_used_at`.
- **Scoping sin RLS:** las rutas `/api/v1` usan service-role y filtran por `user_id` a mano. Es la única forma de scopear sin sesión de Supabase.

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `supabase/migrations/0005_api_keys.sql` (crear) | Tabla `api_keys` + RLS por dueño + índices |
| `lib/types.ts` (modificar) | Tipos `ApiKey` y `ApiKeyCreated` |
| `lib/api-keys/keys.ts` (crear) | Generación/hash/validación de claves (funciones puras + `crypto`) |
| `tests/api-keys.test.ts` (crear) | Tests de las funciones de `keys.ts` |
| `lib/api-keys/auth.ts` (crear) | `requireApiKey(req)` — resuelve API key → `{ userId, supabase, keyId }` |
| `lib/api-keys/data.ts` (crear) | Consultas de datos scopeadas por `user_id` para `/api/v1`: proveedores, documentos, cumplimiento, verificación Arkiv y reporte (reusa `lib/status.ts` y Arkiv) |
| `lib/arkiv/verify-parity.ts` (modificar) | Añadir scoping por `userId` a `auditArkivParity` para auth por API key |
| `app/api/api-keys/route.ts` (crear) | `GET` lista (sin secreto), `POST` crea (máx. 5, devuelve texto plano una vez) |
| `app/api/api-keys/[id]/route.ts` (crear) | `DELETE` revoca (soft) |
| `app/api/v1/vendors/route.ts` (crear) | `GET` proveedores con estado (API key) |
| `app/api/v1/vendors/[id]/route.ts` (crear) | `GET` detalle de proveedor (API key) |
| `app/api/v1/vendors/[id]/compliance/route.ts` (crear) | `GET` cumplimiento de proveedor (API key) |
| `app/api/v1/documents/route.ts` (crear) | `GET` documentos, filtro `vendor_id` opcional (API key) |
| `app/api/v1/expirations/route.ts` (crear) | `GET` documentos por vencer/vencidos (API key) |
| `app/api/v1/documents/[id]/verify/route.ts` (crear) | `GET` valida un documento contra Arkiv (API key) |
| `app/api/v1/arkiv/audit/route.ts` (crear) | `GET` auditoría de paridad DB↔Arkiv scopeada (API key) |
| `app/api/v1/arkiv/report/route.ts` (crear) | `GET` reporte de auditoría (cumplimiento + paridad) (API key) |
| `components/vendor-pass/api-keys-manager.tsx` (crear) | UI: listar, crear (revelar una vez + copiar), revocar |
| `app/integrations/page.tsx` (crear) | Página "Integraciones" en el `AppShell` |
| `components/vendor-pass/sidebar.tsx` (modificar) | Entrada de navegación "Integraciones" |
| `mcp-server/package.json` (crear) | Paquete del MCP server (stdio) |
| `mcp-server/tsconfig.json` (crear) | TS config del MCP server (ESM/NodeNext) |
| `mcp-server/src/index.ts` (crear) | MCP server: tools que llaman a `/api/v1/*` |
| `mcp-server/README.md` (crear) | Cómo configurarlo en Claude Desktop / Code |
| `.gitignore` (modificar) | Ignorar `mcp-server/node_modules` y `mcp-server/dist` |

---

## Task 1: Migración — tabla `api_keys`

> **Nota de numeración:** si ya aplicaste el plan de perfil (que crea `0005_profiles.sql`), renombrá este archivo a `0006_api_keys.sql` para mantener el orden.

**Files:**
- Create: `supabase/migrations/0005_api_keys.sql`

- [ ] **Step 1: Escribir la migración**

Create `supabase/migrations/0005_api_keys.sql`:

```sql
-- API keys por usuario (se guarda solo el hash SHA-256)
create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  key_prefix text not null,
  key_hash text not null unique,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists api_keys_user_id_idx on public.api_keys(user_id);
create index if not exists api_keys_key_hash_idx on public.api_keys(key_hash);

alter table public.api_keys enable row level security;

drop policy if exists "api_keys_select_own" on public.api_keys;
create policy "api_keys_select_own" on public.api_keys
  for select using (auth.uid() = user_id);

drop policy if exists "api_keys_insert_own" on public.api_keys;
create policy "api_keys_insert_own" on public.api_keys
  for insert with check (auth.uid() = user_id);

drop policy if exists "api_keys_update_own" on public.api_keys;
create policy "api_keys_update_own" on public.api_keys
  for update using (auth.uid() = user_id);

drop policy if exists "api_keys_delete_own" on public.api_keys;
create policy "api_keys_delete_own" on public.api_keys
  for delete using (auth.uid() = user_id);
```

- [ ] **Step 2: Aplicar la migración**

Run: `npx supabase migration up`
(alternativa que **borra datos** en local: `npx supabase db reset`)
Expected: se aplica sin errores.

- [ ] **Step 3: Verificar la tabla**

En el SQL editor de Supabase (o `psql`):
`select count(*) from public.api_keys;`
Expected: `0` (tabla creada y vacía).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0005_api_keys.sql
git commit -m "feat(db): tabla api_keys con RLS por dueño"
```

---

## Task 2: Tipos `ApiKey` / `ApiKeyCreated`

**Files:**
- Modify: `lib/types.ts` (append al final, después de la línea 36)

- [ ] **Step 1: Añadir los tipos**

Append to `lib/types.ts`:

```typescript
/** Metadatos de una API key — NUNCA incluye el secreto. */
export interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  last_used_at: string | null;
  created_at: string;
  revoked_at: string | null;
}

/** Respuesta de creación: incluye el texto plano visible UNA sola vez. */
export interface ApiKeyCreated {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  plaintext: string;
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add lib/types.ts
git commit -m "feat(types): tipos ApiKey y ApiKeyCreated"
```

---

## Task 3: Generación y hash de claves (TDD)

**Files:**
- Create: `lib/api-keys/keys.ts`
- Test: `tests/api-keys.test.ts`

- [ ] **Step 1: Escribir los tests que fallan**

Create `tests/api-keys.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { generateApiKey, hashApiKey, isValidKeyFormat } from '@/lib/api-keys/keys';

describe('hashApiKey', () => {
  it('es determinístico y devuelve sha256 hex (64 chars)', () => {
    const h1 = hashApiKey('vp_abc');
    const h2 = hashApiKey('vp_abc');
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[a-f0-9]{64}$/);
  });
  it('cambia con la entrada', () => {
    expect(hashApiKey('vp_abc')).not.toBe(hashApiKey('vp_abd'));
  });
});

describe('isValidKeyFormat', () => {
  it('acepta una clave generada', () => {
    expect(isValidKeyFormat(generateApiKey().plaintext)).toBe(true);
  });
  it('rechaza formatos inválidos', () => {
    expect(isValidKeyFormat('abc')).toBe(false);
    expect(isValidKeyFormat('vp_short')).toBe(false);
    expect(isValidKeyFormat('')).toBe(false);
  });
});

describe('generateApiKey', () => {
  it('produce texto plano con prefijo vp_ y hash consistente', () => {
    const key = generateApiKey();
    expect(key.plaintext.startsWith('vp_')).toBe(true);
    expect(key.hash).toBe(hashApiKey(key.plaintext));
    expect(key.prefix.startsWith('vp_')).toBe(true);
  });
  it('genera claves distintas en cada llamada', () => {
    expect(generateApiKey().plaintext).not.toBe(generateApiKey().plaintext);
  });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `npx vitest run tests/api-keys.test.ts`
Expected: FAIL con "Failed to resolve import '@/lib/api-keys/keys'".

- [ ] **Step 3: Implementar**

Create `lib/api-keys/keys.ts`:

```typescript
import { createHash, randomBytes } from 'crypto';

export const KEY_PREFIX = 'vp_';

export function hashApiKey(plaintext: string): string {
  return createHash('sha256').update(plaintext).digest('hex');
}

export function isValidKeyFormat(key: string): boolean {
  return /^vp_[A-Za-z0-9_-]{24,}$/.test(key);
}

export interface GeneratedKey {
  plaintext: string;
  prefix: string;
  hash: string;
}

export function generateApiKey(): GeneratedKey {
  const random = randomBytes(24).toString('base64url'); // 32 chars URL-safe
  const plaintext = `${KEY_PREFIX}${random}`;
  const prefix = `${plaintext.slice(0, 11)}…`; // 'vp_' + 8 chars + elipsis para mostrar
  return { plaintext, prefix, hash: hashApiKey(plaintext) };
}
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `npx vitest run tests/api-keys.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/api-keys/keys.ts tests/api-keys.test.ts
git commit -m "feat(api-keys): generación y hash de claves con tests"
```

---

## Task 4: `requireApiKey()` — autenticación por API key

**Files:**
- Create: `lib/api-keys/auth.ts`

- [ ] **Step 1: Crear el helper**

Create `lib/api-keys/auth.ts`:

```typescript
import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/server';
import { hashApiKey, isValidKeyFormat } from '@/lib/api-keys/keys';

export type ApiKeyAuth =
  | { userId: string; supabase: SupabaseClient; keyId: string; error: null }
  | { userId: null; supabase: null; keyId: null; error: NextResponse };

function unauthorized(): ApiKeyAuth {
  return {
    userId: null,
    supabase: null,
    keyId: null,
    error: NextResponse.json({ error: 'API key inválida o revocada' }, { status: 401 }),
  };
}

/** Resuelve el header Authorization: Bearer vp_... a un usuario, vía service-role. */
export async function requireApiKey(req: Request): Promise<ApiKeyAuth> {
  const header = req.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!isValidKeyFormat(token)) return unauthorized();

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from('api_keys')
    .select('id, user_id, revoked_at')
    .eq('key_hash', hashApiKey(token))
    .maybeSingle();

  if (error || !data || data.revoked_at) return unauthorized();

  // Marcar último uso (best-effort, sin bloquear la respuesta).
  void admin.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', data.id);

  return { userId: data.user_id, supabase: admin, keyId: data.id, error: null };
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add lib/api-keys/auth.ts
git commit -m "feat(api-keys): requireApiKey con resolución service-role"
```

---

## Task 5: API de gestión — `GET`/`POST /api/api-keys`

**Files:**
- Create: `app/api/api-keys/route.ts`

- [ ] **Step 1: Crear el endpoint**

Create `app/api/api-keys/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/api-auth';
import { generateApiKey } from '@/lib/api-keys/keys';

const MAX_ACTIVE_KEYS = 5;

export async function GET() {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { data, error } = await auth.supabase
    .from('api_keys')
    .select('id, name, key_prefix, last_used_at, created_at, revoked_at')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ keys: data });
}

export async function POST(req: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });
  if (name.length > 60) return NextResponse.json({ error: 'Máximo 60 caracteres' }, { status: 400 });

  const { count, error: countErr } = await auth.supabase
    .from('api_keys')
    .select('id', { count: 'exact', head: true })
    .is('revoked_at', null);
  if (countErr) return NextResponse.json({ error: countErr.message }, { status: 500 });
  if ((count ?? 0) >= MAX_ACTIVE_KEYS) {
    return NextResponse.json(
      { error: `Alcanzaste el máximo de ${MAX_ACTIVE_KEYS} API keys activas. Revocá una para crear otra.` },
      { status: 400 },
    );
  }

  const { plaintext, prefix, hash } = generateApiKey();
  const { data, error } = await auth.supabase
    .from('api_keys')
    .insert({ user_id: auth.user.id, name, key_prefix: prefix, key_hash: hash })
    .select('id, name, key_prefix, created_at')
    .single();
  if (error || !data) return NextResponse.json({ error: error?.message ?? 'Error creando la API key' }, { status: 400 });

  // El texto plano se devuelve UNA sola vez; nunca se vuelve a poder recuperar.
  return NextResponse.json({ key: { ...data, plaintext } }, { status: 201 });
}
```

- [ ] **Step 2: Verificar tipos + smoke test**

Run: `npx tsc --noEmit`
Expected: PASS

Run (sin sesión): `curl -i http://localhost:3000/api/api-keys`
Expected: `HTTP/1.1 401` con `{"error":"No autorizado"}`.

- [ ] **Step 3: Commit**

```bash
git add app/api/api-keys/route.ts
git commit -m "feat(api): gestión de API keys (listar/crear, máximo 5)"
```

---

## Task 6: Revocación — `DELETE /api/api-keys/[id]`

**Files:**
- Create: `app/api/api-keys/[id]/route.ts`

- [ ] **Step 1: Crear el endpoint**

Create `app/api/api-keys/[id]/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/api-auth';

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { id } = await params;
  // Revocación soft; RLS garantiza que la clave sea del usuario.
  const { error } = await auth.supabase
    .from('api_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
    .is('revoked_at', null);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add "app/api/api-keys/[id]/route.ts"
git commit -m "feat(api): revocación de API keys"
```

---

## Task 7: Capa de datos para `/api/v1` (scopeada por usuario)

Reutiliza `lib/status.ts` y Arkiv. Como el cliente es service-role (sin RLS), **toda** consulta filtra por `user_id`.

**Files:**
- Modify: `lib/arkiv/verify-parity.ts`
- Create: `lib/api-keys/data.ts`

- [ ] **Step 1: Extender `auditArkivParity` con scoping por `userId`**

Sin sesión de cookie no hay RLS, así que la auditoría por API key debe filtrar por dueño a mano. En `lib/arkiv/verify-parity.ts`, reemplazá el tipo `AuditOptions` y el comienzo de `auditArkivParity` (desde `type AuditOptions` hasta la línea `const postgresDocs = (docs ?? []) as VendorDocument[];` inclusive) por:

```typescript
type AuditOptions = {
  supabase?: SupabaseClient;
  /** Scope por dueño cuando se usa el cliente service-role (sin RLS), p. ej. auth por API key. */
  userId?: string;
};

export async function auditArkivParity(options: AuditOptions = {}): Promise<ParityAuditResult> {
  const sb = options.supabase ?? supabaseAdmin();
  const scoped = options.supabase != null || options.userId != null;

  let vendorsQuery = sb.from('vendors').select('id');
  if (options.userId) vendorsQuery = vendorsQuery.eq('user_id', options.userId);
  const { data: vendors, error: vendorsError } = await vendorsQuery;
  if (vendorsError) throw vendorsError;
  const vendorIds = new Set((vendors ?? []).map(v => v.id));

  let docsQuery = sb.from('documents').select('*');
  if (options.userId) docsQuery = docsQuery.in('vendor_id', [...vendorIds]);
  const { data: docs, error } = await docsQuery;
  if (error) throw error;

  const postgresDocs = (docs ?? []) as VendorDocument[];
```

Esto elimina la antigua línea `const scoped = options.supabase != null;` (ya está arriba) y el bloque `Promise.all([...])`/`const vendorIds = ...` original. El resto de la función (uso de `store`, `arkivEntities`, el `for` y el `return`) queda igual.

> **Compatibilidad:** las llamadas existentes (`auditArkivParity({ supabase: auth.supabase })` en `app/api/arkiv/audit/route.ts`) siguen funcionando: sin `userId`, las queries no agregan filtros y la RLS del cliente cookie las scopea como antes.

- [ ] **Step 2: Crear la capa de datos**

Create `lib/api-keys/data.ts`:

```typescript
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  documentStatus,
  isVendorAllowed,
  vendorComplianceReasons,
  vendorStatus,
} from '@/lib/status';
import { auditArkivParity } from '@/lib/arkiv/verify-parity';
import { getStore, getStoreSource } from '@/lib/arkiv/validations';
import type { VendorDocument } from '@/lib/types';

async function userVendorIds(supabase: SupabaseClient, userId: string): Promise<string[]> {
  const { data, error } = await supabase.from('vendors').select('id').eq('user_id', userId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((v: { id: string }) => v.id);
}

export async function listVendors(supabase: SupabaseClient, userId: string) {
  const { data: vendors, error } = await supabase
    .from('vendors')
    .select('*')
    .eq('user_id', userId)
    .order('name');
  if (error) throw new Error(error.message);

  const list = vendors ?? [];
  const ids = list.map((v: { id: string }) => v.id);
  let docs: VendorDocument[] = [];
  if (ids.length) {
    const r = await supabase.from('documents').select('*').in('vendor_id', ids);
    if (r.error) throw new Error(r.error.message);
    docs = (r.data ?? []) as VendorDocument[];
  }

  return list.map((v: Record<string, unknown>) => {
    const vdocs = docs.filter(d => d.vendor_id === v.id);
    return {
      id: v.id,
      name: v.name,
      category: v.category,
      area: v.area,
      owner_name: v.owner_name,
      owner_email: v.owner_email,
      status: vendorStatus(vdocs),
      documents_count: vdocs.length,
    };
  });
}

export async function getVendorDetail(supabase: SupabaseClient, userId: string, id: string) {
  const { data: vendor, error } = await supabase
    .from('vendors')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!vendor) return null;

  const r = await supabase
    .from('documents')
    .select('*')
    .eq('vendor_id', id)
    .order('expires_at', { ascending: true });
  if (r.error) throw new Error(r.error.message);
  const docs = (r.data ?? []) as VendorDocument[];

  return { vendor, documents: docs.map(d => ({ ...d, status: documentStatus(d) })) };
}

export async function getVendorCompliance(supabase: SupabaseClient, userId: string, id: string) {
  const detail = await getVendorDetail(supabase, userId, id);
  if (!detail) return null;
  const docs = detail.documents as VendorDocument[];
  return {
    vendorId: id,
    vendorName: detail.vendor.name,
    allowed: isVendorAllowed(docs),
    status: vendorStatus(docs),
    reasons: vendorComplianceReasons(docs),
    documents: docs.map(d => ({
      id: d.id,
      documentName: d.document_name,
      documentType: d.document_type,
      expiresAt: d.expires_at,
      criticality: d.criticality,
      status: documentStatus(d),
    })),
  };
}

export async function listDocuments(supabase: SupabaseClient, userId: string, vendorId?: string) {
  let ids = await userVendorIds(supabase, userId);
  if (vendorId) ids = ids.filter(i => i === vendorId);
  if (!ids.length) return [];

  const r = await supabase
    .from('documents')
    .select('*')
    .in('vendor_id', ids)
    .order('expires_at', { ascending: true });
  if (r.error) throw new Error(r.error.message);
  return (r.data ?? []).map((d: VendorDocument) => ({ ...d, status: documentStatus(d) }));
}

export async function listExpirations(supabase: SupabaseClient, userId: string) {
  const docs = await listDocuments(supabase, userId);
  return docs.filter(d => d.status !== 'vigente');
}

// ── Arkiv: verificación de documento, auditoría y reporte ──────────────────

/** Valida un documento del usuario contra su validación anclada en Arkiv. */
export async function verifyDocumentInArkiv(supabase: SupabaseClient, userId: string, docId: string) {
  const ids = await userVendorIds(supabase, userId);
  if (!ids.length) return null;

  const { data: doc, error } = await supabase
    .from('documents')
    .select('*')
    .eq('id', docId)
    .in('vendor_id', ids)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!doc) return null;

  const typed = doc as VendorDocument;
  const expectedStatus = documentStatus(typed);
  const lookup = await getStore().getByDocumentId(docId);

  if (!lookup) {
    return { documentId: docId, found: false, source: getStoreSource(), expectedStatus };
  }

  return {
    documentId: docId,
    found: true,
    source: getStoreSource(),
    entityKey: lookup.entityKey,
    expectedStatus,
    onChainStatus: lookup.entity.status,
    statusMatch: lookup.entity.status === expectedStatus,
    hashMatch: typed.file_hash != null && lookup.entity.fileHash === typed.file_hash,
    validation: lookup.entity,
  };
}

/** Reporte de auditoría: combina el estado de cumplimiento con la paridad DB↔Arkiv. */
export async function buildAuditReport(supabase: SupabaseClient, userId: string) {
  const [vendors, expirations, parity] = await Promise.all([
    listVendors(supabase, userId),
    listExpirations(supabase, userId),
    auditArkivParity({ userId }),
  ]);

  const summary = {
    vendors: vendors.length,
    blocked: vendors.filter(v => v.status === 'bloqueado').length,
    attention: vendors.filter(v => v.status === 'atencion').length,
    ok: vendors.filter(v => v.status === 'ok').length,
    documentsExpiringOrExpired: expirations.length,
  };

  return {
    generatedAt: new Date().toISOString(),
    source: getStoreSource(),
    summary,
    arkiv: parity,
    conclusion: parity.ok
      ? 'La base de datos y Arkiv están en paridad: cada documento tiene su validación anclada con el estado correcto.'
      : 'Hay discrepancias entre la base de datos y Arkiv. Revisá los documentos faltantes, huérfanos o con estado distinto y ejecutá una sincronización.',
  };
}
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add lib/api-keys/data.ts lib/arkiv/verify-parity.ts
git commit -m "feat(api-keys): capa de datos v1 (cumplimiento + Arkiv) scopeada por usuario"
```

---

## Task 8: Endpoints `/api/v1/*` (autenticados por API key)

**Files:**
- Create: `app/api/v1/vendors/route.ts`
- Create: `app/api/v1/vendors/[id]/route.ts`
- Create: `app/api/v1/vendors/[id]/compliance/route.ts`
- Create: `app/api/v1/documents/route.ts`
- Create: `app/api/v1/expirations/route.ts`

- [ ] **Step 1: Crear `GET /api/v1/vendors`**

Create `app/api/v1/vendors/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { requireApiKey } from '@/lib/api-keys/auth';
import { listVendors } from '@/lib/api-keys/data';

export async function GET(req: Request) {
  const auth = await requireApiKey(req);
  if (auth.error) return auth.error;
  try {
    const vendors = await listVendors(auth.supabase, auth.userId);
    return NextResponse.json({ vendors });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Crear `GET /api/v1/vendors/[id]`**

Create `app/api/v1/vendors/[id]/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { requireApiKey } from '@/lib/api-keys/auth';
import { getVendorDetail } from '@/lib/api-keys/data';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiKey(req);
  if (auth.error) return auth.error;
  const { id } = await params;
  try {
    const detail = await getVendorDetail(auth.supabase, auth.userId, id);
    if (!detail) return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 });
    return NextResponse.json(detail);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Crear `GET /api/v1/vendors/[id]/compliance`**

Create `app/api/v1/vendors/[id]/compliance/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { requireApiKey } from '@/lib/api-keys/auth';
import { getVendorCompliance } from '@/lib/api-keys/data';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiKey(req);
  if (auth.error) return auth.error;
  const { id } = await params;
  try {
    const compliance = await getVendorCompliance(auth.supabase, auth.userId, id);
    if (!compliance) return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 });
    return NextResponse.json(compliance);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 });
  }
}
```

- [ ] **Step 4: Crear `GET /api/v1/documents`**

Create `app/api/v1/documents/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { requireApiKey } from '@/lib/api-keys/auth';
import { listDocuments } from '@/lib/api-keys/data';

export async function GET(req: Request) {
  const auth = await requireApiKey(req);
  if (auth.error) return auth.error;
  const vendorId = new URL(req.url).searchParams.get('vendor_id') ?? undefined;
  try {
    const documents = await listDocuments(auth.supabase, auth.userId, vendorId);
    return NextResponse.json({ documents });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 });
  }
}
```

- [ ] **Step 5: Crear `GET /api/v1/expirations`**

Create `app/api/v1/expirations/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { requireApiKey } from '@/lib/api-keys/auth';
import { listExpirations } from '@/lib/api-keys/data';

export async function GET(req: Request) {
  const auth = await requireApiKey(req);
  if (auth.error) return auth.error;
  try {
    const documents = await listExpirations(auth.supabase, auth.userId);
    return NextResponse.json({ documents });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 });
  }
}
```

- [ ] **Step 6: Crear `GET /api/v1/documents/[id]/verify`**

Create `app/api/v1/documents/[id]/verify/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { requireApiKey } from '@/lib/api-keys/auth';
import { verifyDocumentInArkiv } from '@/lib/api-keys/data';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiKey(req);
  if (auth.error) return auth.error;
  const { id } = await params;
  try {
    const result = await verifyDocumentInArkiv(auth.supabase, auth.userId, id);
    if (!result) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 });
  }
}
```

- [ ] **Step 7: Crear `GET /api/v1/arkiv/audit`**

Create `app/api/v1/arkiv/audit/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { requireApiKey } from '@/lib/api-keys/auth';
import { auditArkivParity } from '@/lib/arkiv/verify-parity';

export async function GET(req: Request) {
  const auth = await requireApiKey(req);
  if (auth.error) return auth.error;
  try {
    const result = await auditArkivParity({ userId: auth.userId });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 });
  }
}
```

- [ ] **Step 8: Crear `GET /api/v1/arkiv/report`**

Create `app/api/v1/arkiv/report/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { requireApiKey } from '@/lib/api-keys/auth';
import { buildAuditReport } from '@/lib/api-keys/data';

export async function GET(req: Request) {
  const auth = await requireApiKey(req);
  if (auth.error) return auth.error;
  try {
    const report = await buildAuditReport(auth.supabase, auth.userId);
    return NextResponse.json(report);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 });
  }
}
```

- [ ] **Step 9: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add app/api/v1
git commit -m "feat(api): superficie REST v1 (cumplimiento + verificación, auditoría y reporte Arkiv)"
```

---

## Task 9: UI — gestor de API keys

Lista, crea (revela el secreto una sola vez con copia ilimitada mientras esté visible) y revoca.

**Files:**
- Create: `components/vendor-pass/api-keys-manager.tsx`

- [ ] **Step 1: Crear el componente**

Create `components/vendor-pass/api-keys-manager.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/vendor-pass/button';
import { FormField, Input } from '@/components/vendor-pass/button-fallback-import';
import { KeyRound, Copy, Check, Trash2, AlertTriangle } from 'lucide-react';
import type { ApiKey, ApiKeyCreated } from '@/lib/types';

const MAX_ACTIVE_KEYS = 5;

export function ApiKeysManager() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<ApiKeyCreated | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch('/api/api-keys');
    if (res.ok) {
      const data = await res.json();
      setKeys(data.keys ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const activeCount = keys.filter(k => !k.revoked_at).length;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Ingresá un nombre para identificar la clave.');
      return;
    }
    setCreating(true);
    const res = await fetch('/api/api-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() }),
    });
    setCreating(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? 'Error creando la API key');
      return;
    }
    const data = await res.json();
    setCreated(data.key as ApiKeyCreated);
    setCopied(false);
    setName('');
    load();
  }

  async function handleCopy() {
    if (!created) return;
    await navigator.clipboard.writeText(created.plaintext);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleRevoke(id: string) {
    if (!confirm('¿Revocar esta API key? Las integraciones que la usen dejarán de funcionar.')) return;
    const res = await fetch(`/api/api-keys/${id}`, { method: 'DELETE' });
    if (res.ok) load();
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Revelado de una sola vez */}
      {created && (
        <section className="bg-card border-2 border-primary rounded-xl p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <KeyRound size={16} className="text-primary" aria-hidden="true" />
            API key «{created.name}» creada
          </div>
          <div className="flex items-start gap-2 text-xs text-amber-600">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" aria-hidden="true" />
            Copiala ahora: por seguridad, <strong>no vas a poder verla de nuevo</strong>.
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 font-mono text-xs break-all bg-secondary rounded-lg p-2.5 text-foreground">
              {created.plaintext}
            </code>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopy}
              leftIcon={copied ? <Check size={14} /> : <Copy size={14} />}
              className="min-h-11 shrink-0"
            >
              {copied ? 'Copiada' : 'Copiar'}
            </Button>
          </div>
          <Button type="button" variant="ghost" size="sm" className="self-end" onClick={() => setCreated(null)}>
            Listo, la guardé
          </Button>
        </section>
      )}

      {/* Crear */}
      <form onSubmit={handleCreate} noValidate className="bg-card border border-border rounded-xl p-4 flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-foreground">Crear API key</h2>
        <FormField id="key_name" label="Nombre" hint={`${activeCount}/${MAX_ACTIVE_KEYS} claves activas`}>
          <Input
            id="key_name"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ej: Integración Claude MCP"
            leftAddon={<KeyRound size={15} />}
            className="min-h-11"
            disabled={activeCount >= MAX_ACTIVE_KEYS}
          />
        </FormField>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={creating}
          className="w-full min-h-11"
          disabled={activeCount >= MAX_ACTIVE_KEYS}
        >
          {activeCount >= MAX_ACTIVE_KEYS ? 'Máximo de 5 alcanzado' : 'Generar API key'}
        </Button>
      </form>

      {/* Lista */}
      <section className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-foreground">Tus API keys</h2>
        {loading && <p className="text-sm text-muted-foreground">Cargando…</p>}
        {!loading && keys.length === 0 && (
          <p className="text-sm text-muted-foreground">Todavía no creaste ninguna API key.</p>
        )}
        <ul className="flex flex-col divide-y divide-border">
          {keys.map(k => (
            <li key={k.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {k.name}
                  {k.revoked_at && <span className="ml-2 text-xs text-destructive">(revocada)</span>}
                </p>
                <p className="text-xs text-muted-foreground font-mono">{k.key_prefix}</p>
                <p className="text-[11px] text-muted-foreground">
                  Creada {new Date(k.created_at).toLocaleDateString('es-AR')}
                  {k.last_used_at ? ` · último uso ${new Date(k.last_used_at).toLocaleDateString('es-AR')}` : ' · sin usar'}
                </p>
              </div>
              {!k.revoked_at && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRevoke(k.id)}
                  leftIcon={<Trash2 size={14} />}
                  className="text-destructive shrink-0 min-h-11"
                >
                  Revocar
                </Button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
```

> **Corregí el import de la línea 6 antes de compilar:** debe ser
> `import { FormField, Input } from '@/components/vendor-pass/form-field';`
> (el placeholder `button-fallback-import` está puesto a propósito para forzar la corrección — `FormField` e `Input` viven en `form-field.tsx`, verificado en el código).

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: PASS (tras corregir el import indicado).

- [ ] **Step 3: Commit**

```bash
git add components/vendor-pass/api-keys-manager.tsx
git commit -m "feat(ui): gestor de API keys con revelado de una sola vez"
```

---

## Task 10: Página `/integrations` + navegación

**Files:**
- Create: `app/integrations/page.tsx`
- Modify: `components/vendor-pass/sidebar.tsx`

- [ ] **Step 1: Crear la página**

Create `app/integrations/page.tsx`:

```tsx
'use client';

import { AppShell } from '@/components/vendor-pass/app-shell';
import { PageHeader } from '@/components/vendor-pass/page-header';
import { ApiKeysManager } from '@/components/vendor-pass/api-keys-manager';

export default function IntegrationsPage() {
  return (
    <AppShell>
      <div className="flex flex-col gap-6 max-w-2xl">
        <PageHeader
          title="Integraciones"
          description="Generá API keys para conectar VendorPass con Claude (MCP) y otras herramientas."
        />

        <ApiKeysManager />

        <section className="bg-card border border-border rounded-xl p-4 flex flex-col gap-2 text-sm">
          <h2 className="text-sm font-semibold text-foreground">Conectar Claude (MCP)</h2>
          <p className="text-muted-foreground">
            Con una API key podés conectar el servidor MCP de VendorPass a Claude Desktop o Claude Code
            y consultar tu cumplimiento en lenguaje natural. Las instrucciones de configuración están en{' '}
            <code className="font-mono text-xs">mcp-server/README.md</code>.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
```

> **Verificado:** `PageHeader` acepta `title: string` y `description?: string`; `AppShell` toma `children`. No requieren ajustes.

- [ ] **Step 2: Añadir el ítem de navegación**

In `components/vendor-pass/sidebar.tsx`:

Change the icon import on line 6 to add `KeyRound`:
```typescript
import { LayoutDashboard, Users, CalendarClock, ShieldCheck, Database, KeyRound } from 'lucide-react';
```

Add this entry to `NAV_ITEMS` (after the `'Auditoría Arkiv'` item, before the closing `];`):
```typescript
  { label: 'Integraciones', href: '/integrations', icon: KeyRound, match: (p: string) => p.startsWith('/integrations') },
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add app/integrations/page.tsx components/vendor-pass/sidebar.tsx
git commit -m "feat(integrations): página de API keys y MCP + navegación"
```

---

## Task 11: MCP server (stdio)

Paquete independiente que se agrega a Claude Desktop/Code. Llama a `/api/v1/*` con la API key.

**Files:**
- Create: `mcp-server/package.json`
- Create: `mcp-server/tsconfig.json`
- Create: `mcp-server/src/index.ts`
- Create: `mcp-server/README.md`
- Modify: `.gitignore`

- [ ] **Step 1: Crear el `package.json`**

Create `mcp-server/package.json`:

```json
{
  "name": "vendorpass-mcp",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "bin": { "vendorpass-mcp": "dist/index.js" },
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsx src/index.ts"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.12.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "tsx": "^4.22.3",
    "typescript": "^5"
  }
}
```

- [ ] **Step 2: Crear el `tsconfig.json`**

Create `mcp-server/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Crear el servidor**

Create `mcp-server/src/index.ts`:

```typescript
#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const API_KEY = process.env.VENDORPASS_API_KEY;
const BASE_URL = (process.env.VENDORPASS_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');

if (!API_KEY) {
  console.error('Falta la variable de entorno VENDORPASS_API_KEY.');
  process.exit(1);
}

async function apiGet(path: string): Promise<string> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${API_KEY}`, Accept: 'application/json' },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text}`);
  return text;
}

const server = new McpServer({ name: 'vendorpass', version: '0.1.0' });

server.tool(
  'list_vendors',
  'Lista los proveedores del usuario con su estado de cumplimiento (ok / atención / bloqueado).',
  {},
  async () => ({ content: [{ type: 'text' as const, text: await apiGet('/api/v1/vendors') }] }),
);

server.tool(
  'get_vendor',
  'Obtiene el detalle de un proveedor por su ID, con sus documentos y estados.',
  { vendor_id: z.string().describe('ID (uuid) del proveedor') },
  async ({ vendor_id }) => ({
    content: [{ type: 'text' as const, text: await apiGet(`/api/v1/vendors/${vendor_id}`) }],
  }),
);

server.tool(
  'get_vendor_compliance',
  'Devuelve el estado de cumplimiento, si está habilitado y las razones de bloqueo/atención de un proveedor.',
  { vendor_id: z.string().describe('ID (uuid) del proveedor') },
  async ({ vendor_id }) => ({
    content: [{ type: 'text' as const, text: await apiGet(`/api/v1/vendors/${vendor_id}/compliance`) }],
  }),
);

server.tool(
  'list_documents',
  'Lista documentos de compliance. Pasá vendor_id para filtrar por proveedor.',
  { vendor_id: z.string().optional().describe('ID del proveedor (opcional)') },
  async ({ vendor_id }) => {
    const q = vendor_id ? `?vendor_id=${encodeURIComponent(vendor_id)}` : '';
    return { content: [{ type: 'text' as const, text: await apiGet(`/api/v1/documents${q}`) }] };
  },
);

server.tool(
  'list_expirations',
  'Lista los documentos próximos a vencer o ya vencidos del usuario.',
  {},
  async () => ({ content: [{ type: 'text' as const, text: await apiGet('/api/v1/expirations') }] }),
);

server.tool(
  'verify_document',
  'Valida un documento contra su validación anclada en Arkiv: confirma si está en la cadena, si el estado on-chain coincide con el esperado y si el hash del archivo coincide.',
  { document_id: z.string().describe('ID (uuid) del documento') },
  async ({ document_id }) => ({
    content: [{ type: 'text' as const, text: await apiGet(`/api/v1/documents/${document_id}/verify`) }],
  }),
);

server.tool(
  'arkiv_audit',
  'Auditoría de paridad entre la base de datos y Arkiv: documentos faltantes en la cadena, huérfanos y diferencias de estado.',
  {},
  async () => ({ content: [{ type: 'text' as const, text: await apiGet('/api/v1/arkiv/audit') }] }),
);

server.tool(
  'arkiv_report',
  'Genera un reporte de auditoría que combina el resumen de cumplimiento (proveedores bloqueados/atención/ok, vencimientos) con la paridad DB↔Arkiv y una conclusión.',
  {},
  async () => ({ content: [{ type: 'text' as const, text: await apiGet('/api/v1/arkiv/report') }] }),
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error('VendorPass MCP server conectado (stdio).');
```

- [ ] **Step 4: Crear el README**

Create `mcp-server/README.md`:

````markdown
# VendorPass MCP Server

Conecta VendorPass a Claude (Desktop / Code) usando una API key.

## Instalación

```bash
cd mcp-server
npm install
npm run build
```

## Obtener una API key

En la app: **Integraciones → Generar API key**. Copiala (se muestra una sola vez).

## Claude Desktop

Editá `claude_desktop_config.json` y agregá:

```json
{
  "mcpServers": {
    "vendorpass": {
      "command": "node",
      "args": ["/RUTA/ABSOLUTA/vendor-pass/mcp-server/dist/index.js"],
      "env": {
        "VENDORPASS_API_KEY": "vp_tu_clave",
        "VENDORPASS_BASE_URL": "http://localhost:3000"
      }
    }
  }
}
```

Reiniciá Claude Desktop.

## Claude Code

```bash
claude mcp add vendorpass \
  --env VENDORPASS_API_KEY=vp_tu_clave \
  --env VENDORPASS_BASE_URL=http://localhost:3000 \
  -- node /RUTA/ABSOLUTA/vendor-pass/mcp-server/dist/index.js
```

## Probar

Preguntale a Claude: *"¿Qué proveedores tengo bloqueados y por qué?"* — usará las
herramientas `list_vendors` / `get_vendor_compliance`. O pedile un **reporte de auditoría
blockchain** y usará `arkiv_report` / `arkiv_audit` / `verify_document`.

## Herramientas

| Tool | Descripción |
|---|---|
| `list_vendors` | Proveedores + estado de cumplimiento |
| `get_vendor` | Detalle de un proveedor + documentos |
| `get_vendor_compliance` | Estado, habilitación y razones |
| `list_documents` | Documentos (filtro `vendor_id` opcional) |
| `list_expirations` | Documentos por vencer / vencidos |
| `verify_document` | Valida un documento contra Arkiv (en cadena, estado y hash) |
| `arkiv_audit` | Auditoría de paridad DB↔Arkiv (faltantes, huérfanos, diferencias) |
| `arkiv_report` | Reporte de auditoría (cumplimiento + paridad + conclusión) |
````

- [ ] **Step 5: Ignorar artefactos del MCP server**

In `.gitignore`, append:

```
# MCP server
mcp-server/node_modules
mcp-server/dist
```

- [ ] **Step 6: Instalar y compilar**

Run: `cd mcp-server && npm install && npm run build && cd ..`
Expected: genera `mcp-server/dist/index.js` sin errores de TypeScript.

- [ ] **Step 7: Commit**

```bash
git add mcp-server/package.json mcp-server/tsconfig.json mcp-server/src/index.ts mcp-server/README.md mcp-server/package-lock.json .gitignore
git commit -m "feat(mcp): servidor MCP stdio para VendorPass"
```

---

## Task 12: Verificación end-to-end

**Files:** ninguno (verificación manual)

- [ ] **Step 1: Suite + arranque**

Run: `npm test && npm run dev`
Expected: tests en verde (incluye `tests/api-keys.test.ts`); dev server en `http://localhost:3000`.

- [ ] **Step 2: Crear y copiar una API key**

1. Login → barra lateral → **Integraciones**.
2. Generá una clave "Integración Claude MCP". Confirmá que: el secreto aparece, el botón **Copiar** funciona varias veces, y al hacer "Listo, la guardé" desaparece y no se puede volver a ver.
3. Verificá que la lista muestra el prefijo (`vp_xxxxxxxx…`), fecha y "sin usar".
4. Intentá crear 6 claves → la 6ª debe bloquearse con el mensaje de máximo.

- [ ] **Step 3: Probar la API v1 con curl**

Reemplazá `vp_...` por la clave copiada:
```bash
curl -s http://localhost:3000/api/v1/vendors -H "Authorization: Bearer vp_..." | head
curl -i http://localhost:3000/api/v1/vendors -H "Authorization: Bearer vp_invalida"
curl -s http://localhost:3000/api/v1/arkiv/audit  -H "Authorization: Bearer vp_..." | head
curl -s http://localhost:3000/api/v1/arkiv/report -H "Authorization: Bearer vp_..." | head
```
Expected: `/vendors` con clave válida devuelve `200` con `{"vendors":[...]}` (solo del dueño); con clave inválida `401`. `/arkiv/audit` devuelve la paridad (`postgresCount`, `arkivCount`, `missingInArkiv`, `ok`, …) **solo de los documentos del dueño**. `/arkiv/report` devuelve `summary` + `arkiv` + `conclusion`.

- [ ] **Step 4: Revocar y reintentar**

Revocá la clave en la UI y repetí el primer curl.
Expected: ahora `401` (la clave revocada deja de funcionar). Verificá también que en la lista figura "último uso" con fecha de hoy (por el `last_used_at`).

- [ ] **Step 5: Conectar el MCP a Claude**

1. Creá una clave nueva (la anterior quedó revocada).
2. Configurá el MCP server según `mcp-server/README.md` (Claude Desktop o Claude Code) con esa clave y `http://localhost:3000`.
3. Con el dev server corriendo, preguntá a Claude: *"¿Qué proveedores tengo en estado bloqueado o de atención y por qué?"*
Expected: Claude invoca `list_vendors` / `get_vendor_compliance` y responde con datos reales de VendorPass.
4. Pedile: *"Generá un reporte de auditoría de Arkiv y verificá si todos mis documentos están anclados en la blockchain."*
Expected: Claude invoca `arkiv_report` / `arkiv_audit` (y `verify_document` para casos puntuales) y resume paridad, faltantes y la conclusión.

- [ ] **Step 6: Commit final (si hubo ajustes)**

```bash
git add -A
git commit -m "chore(api-keys,mcp): ajustes finales tras verificación end-to-end"
```

---

## Self-Review

**1. Cobertura del objetivo:**
- ✅ Hasta 5 API keys con nombre → Task 5 (límite `MAX_ACTIVE_KEYS`) + Task 9 (UI con contador).
- ✅ Visible una sola vez, copiable las veces necesarias en ese momento → Task 5 (`plaintext` solo en el POST) + Task 9 (panel de revelado con copia y dismiss; nunca se re-renderiza).
- ✅ Solo se guarda el hash → Tasks 1/3 (`key_hash` SHA-256, `key_prefix` para mostrar).
- ✅ MCP server que conecta con API key → Task 11 (8 tools) + endpoints de Task 8.
- ✅ Usar los endpoints/APIs del sistema con la API key → Task 8 (`/api/v1/*` + `requireApiKey`).
- ✅ Validar documentos en Arkiv → Task 7 (`verifyDocumentInArkiv`) + Task 8 (`/api/v1/documents/[id]/verify`) + tool `verify_document`.
- ✅ Entregar auditoría → Task 7 (`auditArkivParity` con `userId`) + Task 8 (`/api/v1/arkiv/audit`) + tool `arkiv_audit`.
- ✅ Entregar reportes de auditoría → Task 7 (`buildAuditReport`) + Task 8 (`/api/v1/arkiv/report`) + tool `arkiv_report`.
- ✅ Aislamiento por tenant sin RLS → Task 7 (filtro `user_id` explícito; `auditArkivParity` scopeada por `userId`).

**2. Placeholders:** sin TODOs. El único marcador deliberado es el import `button-fallback-import` en Task 9, con instrucción explícita de corregirlo a `form-field` (verificado: `FormField`/`Input` viven ahí).

**3. Consistencia de tipos/nombres:** `ApiKey`/`ApiKeyCreated` (Task 2) se usan en la API (Task 5) y la UI (Task 9). `generateApiKey`/`hashApiKey`/`isValidKeyFormat` (Task 3) se consumen en la API (Task 5) y `requireApiKey` (Task 4). `requireApiKey` devuelve `{ userId, supabase, keyId, error }`, consumido idéntico por los 8 endpoints v1 (Task 8). Las funciones de `data.ts` (Task 7) tienen las mismas firmas que invocan los endpoints. La extensión de `auditArkivParity` con `userId` es retrocompatible: la llamada existente en `app/api/arkiv/audit/route.ts` (`{ supabase }` sin `userId`) conserva su comportamiento. El prefijo de clave `vp_` y el regex `isValidKeyFormat` concuerdan entre `keys.ts` y el formato real generado. La ruta `/integrations` coincide en la página, el `match` del sidebar y el README. Las tools del MCP (Task 11) apuntan a paths que existen en Task 8.

---

## Stretch opcional (fuera del MVP)

- **MCP remoto por HTTP:** exponer el server en una route de Next (`/api/mcp`) con Streamable HTTP (p. ej. `mcp-handler`), autenticando con la API key vía `requireApiKey`. Permite conectarse con solo una URL + clave, sin instalar nada local. Requiere validar compatibilidad con Next 16.
- **Scopes/permatisos por clave:** columna `scopes` (p. ej. `read:vendors`, `write:documents`) y chequeo en `requireApiKey`.
- **Tools de escritura en el MCP:** `create_vendor`, `add_document` (POST a `/api/v1/...`), con confirmación.
- **Rate limiting** por clave (columna + ventana, o un middleware).
