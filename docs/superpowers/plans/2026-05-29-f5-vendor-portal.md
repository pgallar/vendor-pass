# Portal del Proveedor (autoservicio + aprobación) — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Escalar VendorPass a un modelo B2B2B: el subcontratista (proveedor invitado) carga sus propios documentos en un **portal de autoservicio**, y la constructora (owner del tenant) los **revisa, aprueba y ancla** en Arkiv. El proveedor invitado ve **únicamente** los proveedores donde es miembro, sube documentos siempre como borrador, los envía a revisión, y **nunca** puede anclar. El owner tiene una **cola de pendientes** desde donde aprueba (con anclaje opcional en un clic) o rechaza con motivo, que vuelve visible en el portal.

**Architecture:** Dos tablas nuevas — `vendor_portal_invites` (token de un solo uso, expira a 7 días, se guarda **solo el hash SHA-256**, mismo patrón que las API keys) y `vendor_portal_members` (membresía proveedor↔usuario con rol `uploader`/`viewer`). La tabla `documents` gana un workflow de revisión: `review_status ∈ {portal_draft, submitted, approved, rejected, anchored}`, `rejection_reason`, `submitted_by_portal` y `submitted_by`. Las políticas RLS de `vendors` y `documents` se **amplían** para que los `portal_members` lean/inserten **solo** su `vendor_id` (sin ver otros proveedores del tenant) y **no** puedan pasar un documento a `anchored` — solo a `submitted`. El owner conserva todo su acceso actual. El portal vive bajo un route group propio `app/(portal)/` con un **layout mínimo sin el sidebar del tenant**; `/portal/accept` es público (token mágico) y el resto autenticado. Las invitaciones, notificaciones y la transición approve→anchor reutilizan piezas existentes (`lib/email/transport.ts`, el store de Arkiv). La generación/validación del token de invitación se aísla en `lib/portal/invites.ts` como **funciones puras testeables** (TDD).

**Tech Stack:** Next.js 16.2.6 (App Router; route handlers con `params: Promise<…>` y `const { id } = await params`), Supabase (`@supabase/ssr`, RLS, service-role via `supabaseAdmin()`), Node `crypto` (sin dependencias nuevas), nodemailer (vía `lib/email/transport.ts`), TypeScript, Vitest. UI con el design system existente (`AppShell`, `PageHeader`, `StatusBadge`, `Button`, `FormField`/`Input`/`Select`).

**Dependencias:**
- **Feature 2 (OBLIGATORIA): approve → anchor.** El portal sube siempre como borrador y el anclaje real lo hace el owner al aprobar. El punto de integración es el endpoint/función de anclaje de Feature 2 (`POST /api/documents/[id]/anchor` o `anchorDocument()` de `lib/arkiv/anchor.ts`). Si Feature 2 todavía no está mergeada, este plan deja un **fallback de anclaje** explícito (upsert al store de Arkiv, igual que hace hoy `app/api/documents/route.ts`) y marca el punto exacto a reemplazar.
- **Feature 4 (timeline de eventos): integración opcional.** Los eventos `submitted` y `approved` se registran vía `recordDocumentEvent()` de Feature 4. Cada llamada está marcada como opcional (no rompe si Feature 4 no existe; se invoca con `try/catch` best-effort).
- **Feature 1 (pasaporte público): solo tras anchor.** El pasaporte/verificación pública de Feature 1 sigue mostrando únicamente documentos con `review_status = 'anchored'`. Esta feature no lo modifica; solo garantiza que un documento no llega a `anchored` sin pasar por la aprobación del owner.

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `supabase/migrations/0009_vendor_portal.sql` (crear) | Tablas `vendor_portal_invites` + `vendor_portal_members`; columnas `review_status`/`rejection_reason`/`submitted_by_portal`/`submitted_by` en `documents`; **ampliación** de RLS de `vendors`/`documents` para portal_members; RLS de las tablas nuevas. **Nota:** orden relativo F2(0007) < F4(0008) < F5(0009); en este repo las migraciones ya llegan a `0006_api_keys.sql` y este set agrega 0007–0009. |
| `lib/types.ts` (modificar) | Tipos `ReviewStatus`, `PortalInvite`, `PortalMember`, `PortalRole`; extender `VendorDocument` con los campos de revisión |
| `lib/portal/invites.ts` (crear) | Funciones puras: `generateInviteToken`, `hashInviteToken`, `isInviteExpired`, `isInviteUsable`, `isValidTokenFormat` (TDD) |
| `tests/portal.test.ts` (crear) | Tests de `invites.ts` (hash determinístico, expira a 7 días, un solo uso, formato) + checklist RLS manual |
| `lib/portal/membership.ts` (crear) | `requirePortalMember(supabase, userId, vendorId)` y `listMemberVendors(supabase, userId)` — scoping de portal |
| `app/api/portal/invites/route.ts` (crear) | `POST` owner crea invitación (genera token, guarda hash, envía email) |
| `app/api/portal/accept/route.ts` (crear) | `POST` valida token (público + sesión), crea `vendor_portal_member`, marca `accepted_at` |
| `app/api/portal/documents/route.ts` (crear) | `POST` proveedor sube documento como `portal_draft` (`submitted_by_portal=true`) |
| `app/api/portal/documents/[id]/submit/route.ts` (crear) | `POST` proveedor pasa `portal_draft` → `submitted` (+ email + evento) |
| `app/api/documents/[id]/approve/route.ts` (crear) | `POST` owner `submitted` → `approved`; con `?anchor=1` llama al anclaje de Feature 2 → `anchored` (+ email) |
| `app/api/documents/[id]/reject/route.ts` (crear) | `POST` owner `submitted` → `rejected` con `rejection_reason` (+ email) |
| `lib/email/templates/portal.ts` (crear) | Plantillas: invitación, documento enviado, aprobado, rechazado, anclado |
| `lib/notifications/portal.ts` (crear) | Envío de cada notificación reusando `sendEmail` |
| `app/(portal)/layout.tsx` (crear) | Shell mínimo del portal (sin sidebar del tenant) |
| `app/(portal)/portal/page.tsx` (crear) | Home del portal: lista de proveedores del miembro |
| `app/(portal)/portal/vendors/[id]/page.tsx` (crear) | Documentos del proveedor + estados + acción subir |
| `app/(portal)/portal/vendors/[id]/documents/new/page.tsx` (crear) | Form simplificado de subida (mismos tipos de documento) |
| `app/(portal)/portal/accept/page.tsx` (crear) | Pantalla pública de aceptación de invitación (token en query) |
| `components/vendor-pass/portal-document-form.tsx` (crear) | Form de subida simplificado del portal (sube como `portal_draft`) |
| `components/vendor-pass/portal-shell.tsx` (crear) | Encabezado/branding mínimo del portal |
| `app/vendors/[id]/reviews/page.tsx` (crear) | Owner: cola de revisión (approve/reject) de un proveedor |
| `components/vendor-pass/review-queue.tsx` (crear) | UI cliente de la cola de revisión (approve+anchor / reject con motivo) |
| `components/vendor-pass/invite-vendor.tsx` (crear) | UI owner para invitar un contacto al portal de un proveedor |
| `components/vendor-pass/pending-reviews-badge.tsx` (crear) | Badge contador de documentos pendientes de aprobación |
| `app/vendors/[id]/page.tsx` (modificar) | Botón "Invitar al portal" + enlace a "Revisiones" + badge de pendientes |
| `middleware.ts` (modificar) | Agregar `/portal/accept` a `PUBLIC_PREFIXES` (sin abrir todo `/portal`) |

---

## Task 1: Migración — portal, workflow de revisión y RLS

**Files:**
- Create: `supabase/migrations/0009_vendor_portal.sql`

> **Nota de numeración:** este archivo es `0009_vendor_portal.sql`. Orden de este set: Feature 2 = `0007`, Feature 4 = `0008`, Feature 5 = `0009` (el repo ya llega a `0006_api_keys.sql`). Mantené F2 < F4 < F5.

- [ ] **Step 1: Escribir la migración**

Create `supabase/migrations/0009_vendor_portal.sql`:

```sql
-- ── Portal del proveedor: invitaciones, membresías y workflow de revisión ──

-- Invitaciones (token de un solo uso, expira a 7 días; se guarda SOLO el hash sha256)
create table if not exists public.vendor_portal_invites (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  email text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists vendor_portal_invites_vendor_idx on public.vendor_portal_invites(vendor_id);
create index if not exists vendor_portal_invites_token_hash_idx on public.vendor_portal_invites(token_hash);

-- Membresías: un usuario es miembro del portal de un proveedor con un rol
create table if not exists public.vendor_portal_members (
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('uploader','viewer')),
  created_at timestamptz not null default now(),
  unique (vendor_id, user_id)
);

create index if not exists vendor_portal_members_user_idx on public.vendor_portal_members(user_id);
create index if not exists vendor_portal_members_vendor_idx on public.vendor_portal_members(vendor_id);

-- Workflow de revisión en documents
alter table public.documents
  add column if not exists review_status text not null default 'approved'
    check (review_status in ('portal_draft','submitted','approved','rejected','anchored')),
  add column if not exists rejection_reason text,
  add column if not exists submitted_by_portal boolean not null default false,
  add column if not exists submitted_by uuid references auth.users(id) on delete set null;

create index if not exists documents_review_status_idx on public.documents(review_status);

-- ── Helper: ¿es el usuario miembro del portal de este vendor? ──
-- security definer evita recursión de RLS al consultar la tabla de membresías.
create or replace function public.is_portal_member(p_vendor_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.vendor_portal_members m
    where m.vendor_id = p_vendor_id and m.user_id = auth.uid()
  );
$$;

revoke all on function public.is_portal_member(uuid) from public;
grant execute on function public.is_portal_member(uuid) to authenticated;

-- ── RLS tablas nuevas ──
alter table public.vendor_portal_invites enable row level security;
alter table public.vendor_portal_members enable row level security;

-- Invitaciones: solo el owner del vendor las gestiona
drop policy if exists "invites_owner_all" on public.vendor_portal_invites;
create policy "invites_owner_all" on public.vendor_portal_invites
  for all using (
    exists (select 1 from public.vendors v where v.id = vendor_id and v.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.vendors v where v.id = vendor_id and v.user_id = auth.uid())
  );

-- Membresías: el owner del vendor las ve/gestiona; el miembro ve su propia membresía
drop policy if exists "members_owner_all" on public.vendor_portal_members;
create policy "members_owner_all" on public.vendor_portal_members
  for all using (
    exists (select 1 from public.vendors v where v.id = vendor_id and v.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.vendors v where v.id = vendor_id and v.user_id = auth.uid())
  );

drop policy if exists "members_self_select" on public.vendor_portal_members;
create policy "members_self_select" on public.vendor_portal_members
  for select using (user_id = auth.uid());

-- ── AMPLIAR RLS de vendors: el miembro lee SOLO su vendor (no otros del tenant) ──
drop policy if exists "vendors_select_member" on public.vendors;
create policy "vendors_select_member" on public.vendors
  for select using (public.is_portal_member(id));

-- ── AMPLIAR RLS de documents para portal_members ──
-- SELECT: el miembro ve documentos de su vendor
drop policy if exists "documents_select_member" on public.documents;
create policy "documents_select_member" on public.documents
  for select using (public.is_portal_member(vendor_id));

-- INSERT: el miembro inserta SOLO como portal_draft de su vendor
drop policy if exists "documents_insert_member" on public.documents;
create policy "documents_insert_member" on public.documents
  for insert with check (
    public.is_portal_member(vendor_id)
    and review_status = 'portal_draft'
    and submitted_by_portal = true
  );

-- UPDATE: el miembro puede mover portal_draft → submitted (y editar borradores),
-- pero NUNCA llegar a 'anchored' (eso lo hace el owner via approve).
drop policy if exists "documents_update_member" on public.documents;
create policy "documents_update_member" on public.documents
  for update using (
    public.is_portal_member(vendor_id)
    and review_status in ('portal_draft','rejected')
  ) with check (
    public.is_portal_member(vendor_id)
    and review_status in ('portal_draft','submitted')
  );
```

> **Sobre el default `'approved'`:** los documentos creados por el owner (flujo actual de `app/api/documents/route.ts`) no son del portal, así que entran como `approved` y el comportamiento existente no cambia. Solo los documentos del portal nacen como `portal_draft`.

- [ ] **Step 2: Aplicar la migración**

Run: `npx supabase migration up`
(alternativa que **borra datos** en local: `npx supabase db reset`)
Expected: se aplica sin errores.

- [ ] **Step 3: Verificar columnas y tablas**

En el SQL editor de Supabase (o `psql`):
```sql
select count(*) from public.vendor_portal_invites;
select count(*) from public.vendor_portal_members;
select column_name from information_schema.columns
  where table_name='documents' and column_name in ('review_status','rejection_reason','submitted_by_portal','submitted_by');
```
Expected: ambos counts en `0` y las 4 columnas listadas.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0009_vendor_portal.sql
git commit -m "feat(db): portal del proveedor (invites, members, review_status) + RLS"
```

---

## Task 2: Tipos del portal

**Files:**
- Modify: `lib/types.ts` (append al final)

- [ ] **Step 1: Añadir los tipos y extender `VendorDocument`**

Append to `lib/types.ts`:

```typescript
/** Estado del workflow de revisión de un documento. */
export type ReviewStatus =
  | 'portal_draft'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'anchored';

export type PortalRole = 'uploader' | 'viewer';

/** Invitación al portal — NUNCA incluye el token en claro. */
export interface PortalInvite {
  id: string;
  vendor_id: string;
  email: string;
  expires_at: string;
  accepted_at: string | null;
  created_by: string;
  created_at: string;
}

export interface PortalMember {
  vendor_id: string;
  user_id: string;
  role: PortalRole;
  created_at: string;
}
```

Luego ubicá la interfaz `VendorDocument` existente y agregale (dentro de la interfaz, junto a los campos actuales) estos campos del workflow:

```typescript
  review_status: ReviewStatus;
  rejection_reason: string | null;
  submitted_by_portal: boolean;
  submitted_by: string | null;
```

> **Verificá:** si `VendorDocument` se construye en algún seed/factory de tests, agregá los defaults (`review_status: 'approved'`, los demás `null`/`false`) para que `npx tsc --noEmit` siga pasando.

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add lib/types.ts
git commit -m "feat(types): tipos del portal y campos de review en VendorDocument"
```

---

## Task 3: Token de invitación (TDD)

Funciones puras de generación/hash/validación del token. Mismo patrón que las API keys (`crypto`, se compara por hash, nunca se guarda el claro).

**Files:**
- Create: `lib/portal/invites.ts`
- Test: `tests/portal.test.ts`

- [ ] **Step 1: Escribir los tests que fallan**

Create `tests/portal.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  generateInviteToken,
  hashInviteToken,
  isValidTokenFormat,
  isInviteExpired,
  isInviteUsable,
  INVITE_TTL_DAYS,
} from '@/lib/portal/invites';

describe('hashInviteToken', () => {
  it('es determinístico y devuelve sha256 hex (64 chars)', () => {
    const h1 = hashInviteToken('vpi_abc');
    const h2 = hashInviteToken('vpi_abc');
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[a-f0-9]{64}$/);
  });
  it('cambia con la entrada', () => {
    expect(hashInviteToken('vpi_abc')).not.toBe(hashInviteToken('vpi_abd'));
  });
});

describe('isValidTokenFormat', () => {
  it('acepta un token generado', () => {
    expect(isValidTokenFormat(generateInviteToken().plaintext)).toBe(true);
  });
  it('rechaza formatos inválidos', () => {
    expect(isValidTokenFormat('abc')).toBe(false);
    expect(isValidTokenFormat('vpi_short')).toBe(false);
    expect(isValidTokenFormat('')).toBe(false);
  });
});

describe('generateInviteToken', () => {
  it('produce claro con prefijo vpi_, hash consistente y expiración a 7 días', () => {
    const now = new Date('2026-05-29T00:00:00Z');
    const t = generateInviteToken(now);
    expect(t.plaintext.startsWith('vpi_')).toBe(true);
    expect(t.hash).toBe(hashInviteToken(t.plaintext));
    const expected = new Date(now.getTime() + INVITE_TTL_DAYS * 86_400_000).toISOString();
    expect(t.expiresAt).toBe(expected);
  });
  it('genera tokens distintos en cada llamada', () => {
    expect(generateInviteToken().plaintext).not.toBe(generateInviteToken().plaintext);
  });
});

describe('isInviteExpired', () => {
  it('false antes de expirar, true después', () => {
    const exp = '2026-05-29T00:00:00.000Z';
    expect(isInviteExpired(exp, new Date('2026-05-28T23:59:59Z'))).toBe(false);
    expect(isInviteExpired(exp, new Date('2026-05-29T00:00:01Z'))).toBe(true);
  });
});

describe('isInviteUsable', () => {
  const future = '2026-12-31T00:00:00.000Z';
  const past = '2020-01-01T00:00:00.000Z';
  it('usable: no aceptada y no expirada', () => {
    expect(isInviteUsable({ accepted_at: null, expires_at: future })).toBe(true);
  });
  it('no usable: ya aceptada (un solo uso)', () => {
    expect(isInviteUsable({ accepted_at: '2026-05-29T00:00:00Z', expires_at: future })).toBe(false);
  });
  it('no usable: expirada', () => {
    expect(isInviteUsable({ accepted_at: null, expires_at: past })).toBe(false);
  });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `npx vitest run tests/portal.test.ts`
Expected: FAIL con "Failed to resolve import '@/lib/portal/invites'".

- [ ] **Step 3: Implementar**

Create `lib/portal/invites.ts`:

```typescript
import { createHash, randomBytes } from 'crypto';

export const TOKEN_PREFIX = 'vpi_';
export const INVITE_TTL_DAYS = 7;
const MS_PER_DAY = 86_400_000;

export function hashInviteToken(plaintext: string): string {
  return createHash('sha256').update(plaintext).digest('hex');
}

export function isValidTokenFormat(token: string): boolean {
  return /^vpi_[A-Za-z0-9_-]{24,}$/.test(token);
}

export interface GeneratedInvite {
  plaintext: string;
  hash: string;
  expiresAt: string;
}

/** Genera un token de un solo uso con expiración a 7 días. */
export function generateInviteToken(now: Date = new Date()): GeneratedInvite {
  const random = randomBytes(24).toString('base64url'); // 32 chars URL-safe
  const plaintext = `${TOKEN_PREFIX}${random}`;
  const expiresAt = new Date(now.getTime() + INVITE_TTL_DAYS * MS_PER_DAY).toISOString();
  return { plaintext, hash: hashInviteToken(plaintext), expiresAt };
}

export function isInviteExpired(expiresAt: string, now: Date = new Date()): boolean {
  return now.getTime() > new Date(expiresAt).getTime();
}

/** Un solo uso: usable solo si no fue aceptada y no expiró. */
export function isInviteUsable(
  invite: { accepted_at: string | null; expires_at: string },
  now: Date = new Date(),
): boolean {
  if (invite.accepted_at) return false;
  return !isInviteExpired(invite.expires_at, now);
}
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `npx vitest run tests/portal.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/portal/invites.ts tests/portal.test.ts
git commit -m "feat(portal): token de invitación (hash, expira 7d, un solo uso) con tests"
```

---

## Task 4: Helpers de membresía del portal

`requirePortalMember` valida que el usuario sea miembro del vendor; `listMemberVendors` lista los vendors del miembro. Usan la sesión por cookie (RLS aplica), por eso solo devuelven lo permitido.

**Files:**
- Create: `lib/portal/membership.ts`

- [ ] **Step 1: Crear el helper**

Create `lib/portal/membership.ts`:

```typescript
import type { SupabaseClient } from '@supabase/supabase-js';
import type { PortalRole } from '@/lib/types';

export interface MemberVendor {
  vendor_id: string;
  role: PortalRole;
  vendor: { id: string; name: string; category: string | null; area: string | null };
}

/** Lista los proveedores donde el usuario es miembro del portal. RLS limita a lo permitido. */
export async function listMemberVendors(
  supabase: SupabaseClient,
  userId: string,
): Promise<MemberVendor[]> {
  const { data, error } = await supabase
    .from('vendor_portal_members')
    .select('vendor_id, role, vendor:vendors(id, name, category, area)')
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as MemberVendor[];
}

/** Devuelve el rol si el usuario es miembro del vendor, o null si no lo es. */
export async function requirePortalMember(
  supabase: SupabaseClient,
  userId: string,
  vendorId: string,
): Promise<PortalRole | null> {
  const { data, error } = await supabase
    .from('vendor_portal_members')
    .select('role')
    .eq('user_id', userId)
    .eq('vendor_id', vendorId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? (data.role as PortalRole) : null;
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add lib/portal/membership.ts
git commit -m "feat(portal): helpers de membresía (listMemberVendors, requirePortalMember)"
```

---

## Task 5: Plantillas y envío de notificaciones del portal

Reutiliza `sendEmail` (`lib/email/transport.ts`) y el patrón de `lib/email/templates/expiration-digest.ts` (función `render*` que devuelve `{ subject, text, html }` y usa `NEXT_PUBLIC_APP_URL`).

**Files:**
- Create: `lib/email/templates/portal.ts`
- Create: `lib/notifications/portal.ts`

- [ ] **Step 1: Crear las plantillas**

Create `lib/email/templates/portal.ts`:

```typescript
function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
}

type Rendered = { subject: string; text: string; html: string };

function wrap(title: string, bodyLines: string[], cta?: { label: string; url: string }): Rendered {
  const text = [title, '', ...bodyLines, ...(cta ? ['', `${cta.label}: ${cta.url}`] : [])].join('\n');
  const html = [
    `<h2 style="font-family:sans-serif">${title}</h2>`,
    ...bodyLines.map(l => `<p style="font-family:sans-serif;color:#374151">${l}</p>`),
    cta
      ? `<p><a href="${cta.url}" style="font-family:sans-serif;background:#4f46e5;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">${cta.label}</a></p>`
      : '',
  ].join('\n');
  return { subject: title, text, html };
}

/** Invitación al portal (incluye el token mágico en la URL pública). */
export function renderPortalInvite(input: { vendorName: string; token: string }): Rendered {
  const url = `${appUrl()}/portal/accept?token=${encodeURIComponent(input.token)}`;
  return wrap(
    `Te invitaron al portal de proveedores de VendorPass`,
    [
      `Fuiste invitado a cargar documentación para "${input.vendorName}".`,
      `El enlace es de un solo uso y vence en 7 días.`,
    ],
    { label: 'Aceptar invitación', url },
  );
}

export function renderDocumentSubmitted(input: { vendorName: string; documentName: string; vendorId: string }): Rendered {
  const url = `${appUrl()}/vendors/${input.vendorId}/reviews`;
  return wrap(
    `Nuevo documento pendiente de revisión`,
    [`"${input.vendorName}" envió "${input.documentName}" para tu aprobación.`],
    { label: 'Revisar', url },
  );
}

export function renderDocumentApproved(input: { documentName: string; vendorId: string }): Rendered {
  const url = `${appUrl()}/portal/vendors/${input.vendorId}`;
  return wrap(
    `Tu documento fue aprobado`,
    [`"${input.documentName}" fue aprobado por la empresa.`],
    { label: 'Ver en el portal', url },
  );
}

export function renderDocumentRejected(input: { documentName: string; reason: string; vendorId: string }): Rendered {
  const url = `${appUrl()}/portal/vendors/${input.vendorId}`;
  return wrap(
    `Tu documento necesita correcciones`,
    [`"${input.documentName}" fue rechazado.`, `Motivo: ${input.reason}`, `Corregilo y volvé a enviarlo.`],
    { label: 'Corregir documento', url },
  );
}

export function renderDocumentAnchored(input: { documentName: string; verifyUrl: string }): Rendered {
  return wrap(
    `Documento anclado en blockchain`,
    [`"${input.documentName}" fue anclado y ya es verificable públicamente.`],
    { label: 'Ver verificación', url: input.verifyUrl },
  );
}
```

- [ ] **Step 2: Crear el módulo de envío**

Create `lib/notifications/portal.ts`:

```typescript
import { sendEmail } from '@/lib/email/transport';
import {
  renderPortalInvite,
  renderDocumentSubmitted,
  renderDocumentApproved,
  renderDocumentRejected,
  renderDocumentAnchored,
} from '@/lib/email/templates/portal';

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
}

export async function notifyPortalInvite(to: string, vendorName: string, token: string) {
  await sendEmail({ to, ...renderPortalInvite({ vendorName, token }) });
}

export async function notifyDocumentSubmitted(to: string, vendorName: string, documentName: string, vendorId: string) {
  await sendEmail({ to, ...renderDocumentSubmitted({ vendorName, documentName, vendorId }) });
}

export async function notifyDocumentApproved(to: string, documentName: string, vendorId: string) {
  await sendEmail({ to, ...renderDocumentApproved({ documentName, vendorId }) });
}

export async function notifyDocumentRejected(to: string, documentName: string, reason: string, vendorId: string) {
  await sendEmail({ to, ...renderDocumentRejected({ documentName, reason, vendorId }) });
}

export async function notifyDocumentAnchored(to: string, documentName: string, documentId: string) {
  const verifyUrl = `${appUrl()}/verify/${documentId}`;
  await sendEmail({ to, ...renderDocumentAnchored({ documentName, verifyUrl }) });
}
```

> **Verificá** la ruta pública de verificación de Feature 1. En este repo existe `app/verify/[documentId]/`, por eso `/verify/{documentId}`. Si Feature 1 cambió el path, ajustá `verifyUrl`.

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add lib/email/templates/portal.ts lib/notifications/portal.ts
git commit -m "feat(portal): plantillas y envío de notificaciones (invitación, submitted, approved, rejected, anchored)"
```

---

## Task 6: API — crear invitación (owner)

**Files:**
- Create: `app/api/portal/invites/route.ts`

- [ ] **Step 1: Crear el endpoint**

Create `app/api/portal/invites/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/api-auth';
import { generateInviteToken } from '@/lib/portal/invites';
import { notifyPortalInvite } from '@/lib/notifications/portal';

export async function POST(req: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const body = await req.json().catch(() => ({}));
  const vendorId = typeof body.vendor_id === 'string' ? body.vendor_id : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!vendorId || !email) {
    return NextResponse.json({ error: 'vendor_id e email son requeridos' }, { status: 400 });
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'Email inválido' }, { status: 400 });
  }

  // RLS de vendors garantiza que el vendor sea del owner; si no es suyo, no existe para él.
  const { data: vendor, error: vErr } = await auth.supabase
    .from('vendors')
    .select('id, name, user_id')
    .eq('id', vendorId)
    .maybeSingle();
  if (vErr) return NextResponse.json({ error: vErr.message }, { status: 500 });
  if (!vendor) return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 });

  const { plaintext, hash, expiresAt } = generateInviteToken();

  // RLS "invites_owner_all" valida que el vendor sea del owner en el insert.
  const { error: insErr } = await auth.supabase.from('vendor_portal_invites').insert({
    vendor_id: vendorId,
    email,
    token_hash: hash,
    expires_at: expiresAt,
    created_by: auth.user.id,
  });
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 });

  // Envío best-effort: si el email falla, la invitación igual existe.
  try {
    await notifyPortalInvite(email, vendor.name, plaintext);
  } catch (err) {
    console.error('[portal] error enviando invitación', err);
  }

  // El token en claro NO se persiste ni se devuelve; viaja solo en el email.
  return NextResponse.json({ ok: true, expiresAt }, { status: 201 });
}
```

- [ ] **Step 2: Verificar tipos + smoke test**

Run: `npx tsc --noEmit`
Expected: PASS

Run (sin sesión): `curl -i -X POST http://localhost:3000/api/portal/invites -H "Content-Type: application/json" -d '{}'`
Expected: `HTTP/1.1 401` con `{"error":"No autorizado"}`.

- [ ] **Step 3: Commit**

```bash
git add app/api/portal/invites/route.ts
git commit -m "feat(api): crear invitación al portal (token un solo uso por email)"
```

---

## Task 7: API — aceptar invitación (token)

El usuario ya autenticado (registrado/logueado) canjea el token: validamos hash + vigencia + un solo uso, creamos la membresía y marcamos `accepted_at`. Usa `supabaseAdmin()` porque el aceptante todavía no tiene RLS sobre la invitación (no es owner del vendor).

**Files:**
- Create: `app/api/portal/accept/route.ts`

- [ ] **Step 1: Crear el endpoint**

Create `app/api/portal/accept/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/api-auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import { hashInviteToken, isValidTokenFormat, isInviteUsable } from '@/lib/portal/invites';

export async function POST(req: Request) {
  // Requiere sesión: el usuario debe estar registrado/logueado para asociarse.
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const body = await req.json().catch(() => ({}));
  const token = typeof body.token === 'string' ? body.token.trim() : '';
  if (!isValidTokenFormat(token)) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { data: invite, error } = await admin
    .from('vendor_portal_invites')
    .select('id, vendor_id, email, expires_at, accepted_at')
    .eq('token_hash', hashInviteToken(token))
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!invite || !isInviteUsable(invite)) {
    return NextResponse.json({ error: 'Invitación inválida, vencida o ya utilizada' }, { status: 410 });
  }

  // Crear membresía (idempotente por unique(vendor_id,user_id)).
  const { error: memErr } = await admin
    .from('vendor_portal_members')
    .upsert(
      { vendor_id: invite.vendor_id, user_id: auth.user.id, role: 'uploader' },
      { onConflict: 'vendor_id,user_id' },
    );
  if (memErr) return NextResponse.json({ error: memErr.message }, { status: 400 });

  // Marcar como usada (un solo uso). Condición accepted_at IS NULL evita doble canje.
  const { error: updErr } = await admin
    .from('vendor_portal_invites')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', invite.id)
    .is('accepted_at', null);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 });

  return NextResponse.json({ ok: true, vendorId: invite.vendor_id });
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add app/api/portal/accept/route.ts
git commit -m "feat(api): aceptar invitación → membresía (valida hash, vigencia, un solo uso)"
```

---

## Task 8: API — subir y enviar documento (proveedor)

El proveedor sube como `portal_draft` (RLS exige `review_status='portal_draft'` y `submitted_by_portal=true`), luego lo envía a revisión (`submitted`). El submit notifica al owner y registra el evento de Feature 4 (opcional).

**Files:**
- Create: `app/api/portal/documents/route.ts`
- Create: `app/api/portal/documents/[id]/submit/route.ts`

- [ ] **Step 1: Crear `POST /api/portal/documents`**

Create `app/api/portal/documents/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/api-auth';
import { requirePortalMember } from '@/lib/portal/membership';

export async function POST(req: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const body = await req.json().catch(() => ({}));
  const vendorId = typeof body.vendor_id === 'string' ? body.vendor_id : '';
  if (!vendorId) return NextResponse.json({ error: 'vendor_id requerido' }, { status: 400 });

  const role = await requirePortalMember(auth.supabase, auth.user.id, vendorId);
  if (role !== 'uploader') {
    return NextResponse.json({ error: 'No tenés permiso para subir a este proveedor' }, { status: 403 });
  }

  // Sube SIEMPRE como borrador del portal. La RLS documents_insert_member
  // exige review_status='portal_draft' y submitted_by_portal=true.
  const { data: doc, error } = await auth.supabase
    .from('documents')
    .insert({
      vendor_id: vendorId,
      document_type: body.document_type,
      document_name: body.document_name,
      issued_at: body.issued_at,
      expires_at: body.expires_at,
      criticality: body.criticality ?? 'normal',
      file_url: body.file_url ?? null,
      file_hash: body.file_hash ?? null,
      notes: body.notes ?? null,
      review_status: 'portal_draft',
      submitted_by_portal: true,
      submitted_by: auth.user.id,
    })
    .select()
    .single();
  if (error || !doc) return NextResponse.json({ error: error?.message ?? 'Error' }, { status: 400 });

  return NextResponse.json({ document: doc }, { status: 201 });
}
```

> **Nota:** a diferencia del flujo del owner (`app/api/documents/route.ts`), el portal **no** hace `getStore().upsert(...)` al crear: el anclaje sucede recién cuando el owner aprueba (Task 9).

- [ ] **Step 2: Crear `POST /api/portal/documents/[id]/submit`**

Create `app/api/portal/documents/[id]/submit/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/api-auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import { requirePortalMember } from '@/lib/portal/membership';
import { notifyDocumentSubmitted } from '@/lib/notifications/portal';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const { id } = await params;

  // Leer el documento (RLS documents_select_member limita a su vendor).
  const { data: doc, error } = await auth.supabase
    .from('documents')
    .select('id, vendor_id, document_name, review_status')
    .eq('id', id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!doc) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });

  const role = await requirePortalMember(auth.supabase, auth.user.id, doc.vendor_id);
  if (role !== 'uploader') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  if (!['portal_draft', 'rejected'].includes(doc.review_status)) {
    return NextResponse.json({ error: 'Solo se pueden enviar borradores o documentos rechazados' }, { status: 409 });
  }

  // portal_draft|rejected → submitted (RLS documents_update_member lo permite).
  const { error: updErr } = await auth.supabase
    .from('documents')
    .update({ review_status: 'submitted', rejection_reason: null })
    .eq('id', id);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 });

  // Notificar al owner. El owner se resuelve vía service-role (el miembro no ve vendors.user_id).
  try {
    const admin = supabaseAdmin();
    const { data: vendor } = await admin
      .from('vendors')
      .select('name, owner_email, user_id')
      .eq('id', doc.vendor_id)
      .single();
    if (vendor?.owner_email) {
      await notifyDocumentSubmitted(vendor.owner_email, vendor.name, doc.document_name, doc.vendor_id);
    }
  } catch (err) {
    console.error('[portal] error notificando submit', err);
  }

  // (Opcional) Feature 4: timeline de eventos.
  // try { await recordDocumentEvent({ documentId: id, type: 'submitted', actorId: auth.user.id }); } catch {}

  return NextResponse.json({ ok: true });
}
```

> **Integración Feature 4 (opcional):** descomentá la línea `recordDocumentEvent` e importalo de su módulo (p. ej. `@/lib/timeline/events`) cuando Feature 4 esté disponible. Está envuelto en `try/catch` para no romper si falta.

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add app/api/portal/documents
git commit -m "feat(api): portal sube como borrador y envía a revisión"
```

---

## Task 9: API — aprobar (con anchor) y rechazar (owner)

`approve` mueve `submitted → approved` y, con `?anchor=1`, ancla (Feature 2) → `anchored`. `reject` mueve `submitted → rejected` con motivo. Ambos usan la sesión del owner (RLS de dueño aplica).

**Files:**
- Create: `app/api/documents/[id]/approve/route.ts`
- Create: `app/api/documents/[id]/reject/route.ts`

- [ ] **Step 1: Crear `POST /api/documents/[id]/approve`**

Create `app/api/documents/[id]/approve/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/api-auth';
import { getStore } from '@/lib/arkiv/validations';
import { documentToValidationEntity } from '@/lib/arkiv/entity';
import { notifyDocumentApproved, notifyDocumentAnchored } from '@/lib/notifications/portal';
import type { VendorDocument } from '@/lib/types';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const { id } = await params;
  const doAnchor = new URL(req.url).searchParams.get('anchor') === '1';

  // RLS de documents (dueño vía vendors.user_id) limita esto al owner del vendor.
  const { data: doc, error } = await auth.supabase
    .from('documents')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!doc) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
  if (doc.review_status !== 'submitted') {
    return NextResponse.json({ error: 'Solo se pueden aprobar documentos enviados' }, { status: 409 });
  }

  const nextStatus = doAnchor ? 'anchored' : 'approved';
  const { data: updated, error: updErr } = await auth.supabase
    .from('documents')
    .update({ review_status: nextStatus, rejection_reason: null })
    .eq('id', id)
    .select()
    .single();
  if (updErr || !updated) return NextResponse.json({ error: updErr?.message ?? 'Error' }, { status: 400 });

  const { data: vendor } = await auth.supabase
    .from('vendors')
    .select('name, owner_email')
    .eq('id', doc.vendor_id)
    .single();

  if (doAnchor) {
    // ── PUNTO DE INTEGRACIÓN FEATURE 2 (approve → anchor) ──
    // Cuando Feature 2 esté mergeada, REEMPLAZÁ este bloque por su anclaje real:
    //   import { anchorDocument } from '@/lib/arkiv/anchor';
    //   await anchorDocument(updated as VendorDocument);
    // o un fetch interno a POST /api/documents/[id]/anchor.
    // Fallback actual (igual que app/api/documents/route.ts): upsert al store de Arkiv.
    const typed = updated as VendorDocument;
    await getStore().upsert(documentToValidationEntity(typed, vendor ?? null));
  }

  // Notificar al proveedor (uploader). Resolvemos su email del submitted_by.
  try {
    const submitterEmail = await resolveSubmitterEmail(auth, doc.submitted_by);
    if (submitterEmail) {
      if (doAnchor) await notifyDocumentAnchored(submitterEmail, doc.document_name, id);
      else await notifyDocumentApproved(submitterEmail, doc.document_name, doc.vendor_id);
    }
  } catch (err) {
    console.error('[portal] error notificando approve', err);
  }

  // (Opcional) Feature 4: recordDocumentEvent({ type: doAnchor ? 'anchored' : 'approved', ... })

  return NextResponse.json({ ok: true, review_status: nextStatus });
}

// El owner no necesariamente ve auth.users; resolvemos el email del invitado
// por la invitación aceptada de ese vendor (best-effort).
async function resolveSubmitterEmail(
  auth: { supabase: import('@supabase/supabase-js').SupabaseClient },
  submittedBy: string | null,
): Promise<string | null> {
  if (!submittedBy) return null;
  const { data } = await auth.supabase
    .from('vendor_portal_invites')
    .select('email')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.email ?? null;
}
```

> **Punto exacto de la llamada a Feature 2:** el bloque marcado `── PUNTO DE INTEGRACIÓN FEATURE 2 ──` dentro de `if (doAnchor)`. Reemplazá el fallback (`getStore().upsert(...)`) por `anchorDocument(updated)` de `lib/arkiv/anchor.ts` o un POST interno a `/api/documents/[id]/anchor` cuando Feature 2 exista. La transición de estado a `'anchored'` ya queda hecha por este endpoint.

- [ ] **Step 2: Crear `POST /api/documents/[id]/reject`**

Create `app/api/documents/[id]/reject/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/api-auth';
import { notifyDocumentRejected } from '@/lib/notifications/portal';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const { id } = await params;

  const body = await req.json().catch(() => ({}));
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  if (!reason) return NextResponse.json({ error: 'El motivo de rechazo es requerido' }, { status: 400 });

  const { data: doc, error } = await auth.supabase
    .from('documents')
    .select('id, vendor_id, document_name, review_status, submitted_by')
    .eq('id', id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!doc) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
  if (doc.review_status !== 'submitted') {
    return NextResponse.json({ error: 'Solo se pueden rechazar documentos enviados' }, { status: 409 });
  }

  const { error: updErr } = await auth.supabase
    .from('documents')
    .update({ review_status: 'rejected', rejection_reason: reason })
    .eq('id', id);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 });

  // Notificar al proveedor con el motivo (best-effort).
  try {
    const { data: invite } = await auth.supabase
      .from('vendor_portal_invites')
      .select('email')
      .eq('vendor_id', doc.vendor_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (invite?.email) {
      await notifyDocumentRejected(invite.email, doc.document_name, reason, doc.vendor_id);
    }
  } catch (err) {
    console.error('[portal] error notificando reject', err);
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add "app/api/documents/[id]/approve/route.ts" "app/api/documents/[id]/reject/route.ts"
git commit -m "feat(api): owner aprueba (con anchor de Feature 2) y rechaza con motivo"
```

---

## Task 10: Layout del portal + shell mínimo

Route group `(portal)` con layout sin el sidebar del tenant.

**Files:**
- Create: `components/vendor-pass/portal-shell.tsx`
- Create: `app/(portal)/layout.tsx`

- [ ] **Step 1: Crear el shell mínimo**

Create `components/vendor-pass/portal-shell.tsx`:

```tsx
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';

export function PortalShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-3xl flex items-center gap-2 px-4 py-3">
          <ShieldCheck size={18} className="text-primary" aria-hidden="true" />
          <Link href="/portal" className="text-sm font-semibold text-foreground">
            Portal del proveedor · VendorPass
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
    </div>
  );
}
```

- [ ] **Step 2: Crear el layout del route group**

Create `app/(portal)/layout.tsx`:

```tsx
import { PortalShell } from '@/components/vendor-pass/portal-shell';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return <PortalShell>{children}</PortalShell>;
}
```

> **Verificá** que no exista un `app/layout.tsx` que ya imponga el `AppShell` con sidebar de forma global. En este repo el `AppShell` se aplica por página (ver `app/integrations/page.tsx` / vistas del tenant), así que el route group `(portal)` queda libre del sidebar. Si hubiera un layout raíz con sidebar, mové el portal fuera de ese alcance.

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add "app/(portal)/layout.tsx" components/vendor-pass/portal-shell.tsx
git commit -m "feat(portal): layout y shell mínimo sin sidebar del tenant"
```

---

## Task 11: Form simplificado de subida del portal

**Files:**
- Create: `components/vendor-pass/portal-document-form.tsx`

- [ ] **Step 1: Crear el componente**

Create `components/vendor-pass/portal-document-form.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/vendor-pass/button';
import { FormField, Input, Select } from '@/components/vendor-pass/form-field';
import { FileText } from 'lucide-react';

const DOCUMENT_TYPES = [
  'Seguro de Responsabilidad Civil',
  'ART',
  'Habilitación Municipal',
  'Certificado AFIP',
  'Otro',
];

export function PortalDocumentForm({ vendorId }: { vendorId: string }) {
  const router = useRouter();
  const [documentType, setDocumentType] = useState(DOCUMENT_TYPES[0]);
  const [documentName, setDocumentName] = useState('');
  const [issuedAt, setIssuedAt] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!documentName.trim() || !expiresAt) {
      setError('Completá el nombre y la fecha de vencimiento.');
      return;
    }
    setSubmitting(true);
    // 1) Crear como borrador.
    const createRes = await fetch('/api/portal/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vendor_id: vendorId,
        document_type: documentType,
        document_name: documentName.trim(),
        issued_at: issuedAt || null,
        expires_at: expiresAt,
        criticality: 'normal',
        file_url: fileUrl.trim() || null,
      }),
    });
    if (!createRes.ok) {
      setSubmitting(false);
      const d = await createRes.json().catch(() => ({}));
      setError(d.error ?? 'Error subiendo el documento');
      return;
    }
    const { document } = await createRes.json();
    // 2) Enviar a revisión.
    const submitRes = await fetch(`/api/portal/documents/${document.id}/submit`, { method: 'POST' });
    setSubmitting(false);
    if (!submitRes.ok) {
      const d = await submitRes.json().catch(() => ({}));
      setError(d.error ?? 'El documento se guardó pero no se pudo enviar a revisión');
      return;
    }
    router.push(`/portal/vendors/${vendorId}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="bg-card border border-border rounded-xl p-4 flex flex-col gap-4">
      <FormField id="document_type" label="Tipo de documento">
        <Select id="document_type" value={documentType} onChange={e => setDocumentType(e.target.value)}>
          {DOCUMENT_TYPES.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </Select>
      </FormField>
      <FormField id="document_name" label="Nombre" required>
        <Input
          id="document_name"
          value={documentName}
          onChange={e => setDocumentName(e.target.value)}
          leftAddon={<FileText size={15} />}
          className="min-h-11"
          required
        />
      </FormField>
      <FormField id="issued_at" label="Fecha de emisión">
        <Input id="issued_at" type="date" value={issuedAt} onChange={e => setIssuedAt(e.target.value)} className="min-h-11" />
      </FormField>
      <FormField id="expires_at" label="Vence" required>
        <Input id="expires_at" type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} className="min-h-11" required />
      </FormField>
      <FormField id="file_url" label="Enlace al archivo (PDF)" hint="Pegá la URL del documento">
        <Input id="file_url" value={fileUrl} onChange={e => setFileUrl(e.target.value)} className="min-h-11" placeholder="https://…" />
      </FormField>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" variant="primary" size="lg" loading={submitting} className="w-full min-h-11">
        Subir y enviar a revisión
      </Button>
    </form>
  );
}
```

> **Verificá los imports del design system:** `FormField`/`Input`/`Select` viven en `@/components/vendor-pass/form-field` (confirmado en `app/(auth)/register/page.tsx` para `FormField`/`Input`). Si `Select` está en otro módulo, corregí el import. Los `DOCUMENT_TYPES` deben coincidir con los del `DocumentForm` del owner (`components/vendor-pass/document-form.tsx`); copialos de ahí para mantener paridad.

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add components/vendor-pass/portal-document-form.tsx
git commit -m "feat(portal): form simplificado de subida (borrador + envío)"
```

---

## Task 12: Páginas del portal (home, vendor, nuevo, accept)

**Files:**
- Create: `app/(portal)/portal/page.tsx`
- Create: `app/(portal)/portal/vendors/[id]/page.tsx`
- Create: `app/(portal)/portal/vendors/[id]/documents/new/page.tsx`
- Create: `app/(portal)/portal/accept/page.tsx`

- [ ] **Step 1: Home del portal (lista de vendors del miembro)**

Create `app/(portal)/portal/page.tsx`:

```tsx
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { listMemberVendors } from '@/lib/portal/membership';

export default async function PortalHome() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/portal');

  const vendors = await listMemberVendors(supabase, user.id);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-foreground">Tus proveedores</h1>
      {vendors.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Todavía no fuiste asociado a ningún proveedor. Si recibiste una invitación, abrí su enlace.
        </p>
      )}
      <ul className="flex flex-col gap-2">
        {vendors.map(v => (
          <li key={v.vendor_id}>
            <Link
              href={`/portal/vendors/${v.vendor_id}`}
              className="block bg-card border border-border rounded-xl p-4 hover:border-primary"
            >
              <p className="text-sm font-medium text-foreground">{v.vendor.name}</p>
              <p className="text-xs text-muted-foreground">{v.vendor.category ?? 'Proveedor'} · rol: {v.role}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Detalle de vendor en el portal (documentos + estados)**

Create `app/(portal)/portal/vendors/[id]/page.tsx`:

```tsx
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requirePortalMember } from '@/lib/portal/membership';
import { Button } from '@/components/vendor-pass/button';
import { StatusBadge } from '@/components/vendor-pass/status-badge';
import type { ReviewStatus } from '@/lib/types';

const REVIEW_LABEL: Record<ReviewStatus, string> = {
  portal_draft: 'Borrador',
  submitted: 'En revisión',
  approved: 'Aprobado',
  rejected: 'Rechazado',
  anchored: 'Anclado',
};

export default async function PortalVendorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/portal/vendors/${id}`);

  const role = await requirePortalMember(supabase, user.id, id);
  if (!role) notFound();

  const { data: vendor } = await supabase.from('vendors').select('id, name').eq('id', id).maybeSingle();
  if (!vendor) notFound();

  const { data: docs } = await supabase
    .from('documents')
    .select('id, document_name, document_type, expires_at, review_status, rejection_reason')
    .eq('vendor_id', id)
    .order('expires_at', { ascending: true });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-foreground">{vendor.name}</h1>
        {role === 'uploader' && (
          <Button asChild variant="primary" size="sm">
            <Link href={`/portal/vendors/${id}/documents/new`}>Subir documento</Link>
          </Button>
        )}
      </div>
      <ul className="flex flex-col gap-2">
        {(docs ?? []).map(d => (
          <li key={d.id} className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-foreground">{d.document_name}</p>
              <span className="text-xs font-medium text-muted-foreground">{REVIEW_LABEL[d.review_status as ReviewStatus]}</span>
            </div>
            <p className="text-xs text-muted-foreground">{d.document_type} · vence {d.expires_at}</p>
            {d.review_status === 'rejected' && d.rejection_reason && (
              <p className="text-xs text-destructive">Motivo de rechazo: {d.rejection_reason}</p>
            )}
          </li>
        ))}
        {(docs ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">No hay documentos cargados todavía.</p>
        )}
      </ul>
    </div>
  );
}
```

> **Verificá** que `StatusBadge` exista en `@/components/vendor-pass/status-badge`. En esta página usamos una etiqueta de texto para `review_status` (que es distinto del `DocumentStatus` de vigencia que consume `StatusBadge`); si querés badge visual, mapeá. El import está incluido por si lo usás; si no, removelo para evitar un warning de import sin usar.

- [ ] **Step 3: Página de subida nueva**

Create `app/(portal)/portal/vendors/[id]/documents/new/page.tsx`:

```tsx
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requirePortalMember } from '@/lib/portal/membership';
import { PortalDocumentForm } from '@/components/vendor-pass/portal-document-form';

export default async function PortalNewDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/portal/vendors/${id}/documents/new`);

  const role = await requirePortalMember(supabase, user.id, id);
  if (role !== 'uploader') notFound();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-foreground">Subir documento</h1>
      <PortalDocumentForm vendorId={id} />
    </div>
  );
}
```

- [ ] **Step 4: Pantalla pública de aceptación**

Create `app/(portal)/portal/accept/page.tsx`:

```tsx
'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/browser';
import { Button } from '@/components/vendor-pass/button';

function AcceptInner() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const [state, setState] = useState<'checking' | 'need_auth' | 'accepting' | 'done' | 'error'>('checking');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!token) {
        setState('error');
        setMessage('Falta el token de invitación.');
        return;
      }
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        // Sin sesión: mandamos a registro conservando el destino con token.
        setState('need_auth');
        return;
      }
      setState('accepting');
      const res = await fetch('/api/portal/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      if (res.ok) {
        const { vendorId } = await res.json();
        setState('done');
        router.replace(`/portal/vendors/${vendorId}`);
      } else {
        const d = await res.json().catch(() => ({}));
        setState('error');
        setMessage(d.error ?? 'No se pudo aceptar la invitación.');
      }
    })();
  }, [token, router]);

  const next = `/portal/accept?token=${encodeURIComponent(token)}`;

  if (state === 'need_auth') {
    return (
      <div className="bg-card border border-border rounded-xl p-6 flex flex-col gap-4 text-center">
        <h1 className="text-lg font-semibold text-foreground">Aceptar invitación</h1>
        <p className="text-sm text-muted-foreground">
          Creá una cuenta o iniciá sesión para vincular tu acceso al portal del proveedor.
        </p>
        <Button asChild variant="primary" size="lg" className="w-full min-h-11">
          <Link href={`/register?next=${encodeURIComponent(next)}`}>Crear cuenta</Link>
        </Button>
        <Link href={`/login?next=${encodeURIComponent(next)}`} className="text-sm text-primary font-medium">
          Ya tengo cuenta
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-6 text-center">
      {state === 'error' ? (
        <p className="text-sm text-destructive">{message}</p>
      ) : (
        <p className="text-sm text-muted-foreground">Procesando invitación…</p>
      )}
    </div>
  );
}

export default function PortalAcceptPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground text-center">Cargando…</p>}>
      <AcceptInner />
    </Suspense>
  );
}
```

> **Flujo de cuenta nueva:** el registro (`app/(auth)/register/page.tsx`) ya soporta `?next=`. Tras confirmar el email y loguearse, el usuario vuelve a `/portal/accept?token=…`, que esta vez encuentra sesión y canjea el token.

- [ ] **Step 5: Verificar tipos + build de rutas**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add "app/(portal)/portal"
git commit -m "feat(portal): páginas home, vendor, nuevo documento y aceptación"
```

---

## Task 13: Middleware — `/portal/accept` público

**Files:**
- Modify: `middleware.ts`

- [ ] **Step 1: Agregar `/portal/accept` a `PUBLIC_PREFIXES`**

In `middleware.ts`, agregá `'/portal/accept'` al array `PUBLIC_PREFIXES` (entre `'/verify'` y el cierre `]`):

```typescript
const PUBLIC_PREFIXES = [
  '/login',
  '/register',
  '/auth',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/verify',
  '/portal/accept',
];
```

> **CUIDADO:** solo `/portal/accept` es público. `isPublicPath` hace match exacto o por prefijo `'/portal/accept/'`, así que `/portal`, `/portal/vendors/…` siguen requiriendo sesión (caen en el `if (!user) redirect('/login')`). No agregues `'/portal'` a la lista.

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add middleware.ts
git commit -m "feat(portal): /portal/accept público en middleware (resto autenticado)"
```

---

## Task 14: UI owner — invitar, cola de revisión y badge de pendientes

**Files:**
- Create: `components/vendor-pass/invite-vendor.tsx`
- Create: `components/vendor-pass/pending-reviews-badge.tsx`
- Create: `components/vendor-pass/review-queue.tsx`
- Create: `app/vendors/[id]/reviews/page.tsx`
- Modify: `app/vendors/[id]/page.tsx`

- [ ] **Step 1: Componente de invitación**

Create `components/vendor-pass/invite-vendor.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/vendor-pass/button';
import { FormField, Input } from '@/components/vendor-pass/form-field';
import { Mail, Send } from 'lucide-react';

export function InviteVendor({ vendorId }: { vendorId: string }) {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    setSending(true);
    const res = await fetch('/api/portal/invites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vendor_id: vendorId, email: email.trim() }),
    });
    setSending(false);
    if (res.ok) {
      setMsg('Invitación enviada. El enlace vence en 7 días.');
      setEmail('');
    } else {
      const d = await res.json().catch(() => ({}));
      setErr(d.error ?? 'No se pudo enviar la invitación');
    }
  }

  return (
    <form onSubmit={handleInvite} noValidate className="flex flex-col gap-3">
      <FormField id="invite_email" label="Invitar contacto del proveedor al portal">
        <Input
          id="invite_email"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          leftAddon={<Mail size={15} />}
          placeholder="contacto@proveedor.com"
          className="min-h-11"
        />
      </FormField>
      {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
      {msg && <p className="text-sm text-emerald-600">{msg}</p>}
      <Button type="submit" variant="outline" size="sm" loading={sending} leftIcon={<Send size={14} />} className="self-start min-h-11">
        Enviar invitación
      </Button>
    </form>
  );
}
```

- [ ] **Step 2: Badge de pendientes**

Create `components/vendor-pass/pending-reviews-badge.tsx`:

```tsx
export function PendingReviewsBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="inline-flex items-center justify-center rounded-full bg-amber-500 text-white text-xs font-semibold min-w-5 h-5 px-1.5">
      {count}
    </span>
  );
}
```

- [ ] **Step 3: Cola de revisión (cliente)**

Create `components/vendor-pass/review-queue.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/vendor-pass/button';

export interface ReviewDoc {
  id: string;
  document_name: string;
  document_type: string;
  expires_at: string;
}

export function ReviewQueue({ docs }: { docs: ReviewDoc[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function approve(id: string, anchor: boolean) {
    setBusyId(id);
    const res = await fetch(`/api/documents/${id}/approve${anchor ? '?anchor=1' : ''}`, { method: 'POST' });
    setBusyId(null);
    if (res.ok) router.refresh();
    else alert((await res.json().catch(() => ({}))).error ?? 'Error al aprobar');
  }

  async function reject(id: string) {
    const reason = prompt('Motivo del rechazo (visible para el proveedor):');
    if (!reason || !reason.trim()) return;
    setBusyId(id);
    const res = await fetch(`/api/documents/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: reason.trim() }),
    });
    setBusyId(null);
    if (res.ok) router.refresh();
    else alert((await res.json().catch(() => ({}))).error ?? 'Error al rechazar');
  }

  if (docs.length === 0) {
    return <p className="text-sm text-muted-foreground">No hay documentos pendientes de aprobación.</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {docs.map(d => (
        <li key={d.id} className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3">
          <div>
            <p className="text-sm font-medium text-foreground">{d.document_name}</p>
            <p className="text-xs text-muted-foreground">{d.document_type} · vence {d.expires_at}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="primary" loading={busyId === d.id} onClick={() => approve(d.id, true)}>
              Aprobar y anclar
            </Button>
            <Button size="sm" variant="outline" disabled={busyId === d.id} onClick={() => approve(d.id, false)}>
              Solo aprobar
            </Button>
            <Button size="sm" variant="ghost" className="text-destructive" disabled={busyId === d.id} onClick={() => reject(d.id)}>
              Rechazar
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 4: Página de cola de revisión del owner**

Create `app/vendors/[id]/reviews/page.tsx`:

```tsx
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/vendor-pass/app-shell';
import { PageHeader } from '@/components/vendor-pass/page-header';
import { ReviewQueue, type ReviewDoc } from '@/components/vendor-pass/review-queue';

export default async function VendorReviewsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/vendors/${id}/reviews`);

  // RLS de vendors (dueño) limita esto al owner.
  const { data: vendor } = await supabase.from('vendors').select('id, name').eq('id', id).maybeSingle();
  if (!vendor) notFound();

  const { data: docs } = await supabase
    .from('documents')
    .select('id, document_name, document_type, expires_at')
    .eq('vendor_id', id)
    .eq('review_status', 'submitted')
    .order('expires_at', { ascending: true });

  return (
    <AppShell>
      <div className="flex flex-col gap-6 max-w-2xl">
        <PageHeader
          title={`Revisiones · ${vendor.name}`}
          description="Documentos enviados por el proveedor pendientes de tu aprobación."
        />
        <ReviewQueue docs={(docs ?? []) as ReviewDoc[]} />
      </div>
    </AppShell>
  );
}
```

> **Verificá** los imports del shell del owner contra `app/integrations/page.tsx`: `AppShell` de `@/components/vendor-pass/app-shell` y `PageHeader` de `@/components/vendor-pass/page-header` (confirmados en ese archivo).

- [ ] **Step 5: Enganchar en el detalle del proveedor**

In `app/vendors/[id]/page.tsx`, agregá (donde se renderizan las acciones del proveedor) el bloque de invitación, un enlace a la cola de revisión y el badge de pendientes. Como es un Server Component, contá los `submitted` y pasalos al badge:

```tsx
// imports
import Link from 'next/link';
import { InviteVendor } from '@/components/vendor-pass/invite-vendor';
import { PendingReviewsBadge } from '@/components/vendor-pass/pending-reviews-badge';

// dentro del componente, tras obtener `supabase` y el vendor `id`:
const { count: pendingCount } = await supabase
  .from('documents')
  .select('id', { count: 'exact', head: true })
  .eq('vendor_id', id)
  .eq('review_status', 'submitted');

// en el JSX, en la zona de acciones del proveedor:
<div className="flex items-center gap-3">
  <Link href={`/vendors/${id}/reviews`} className="inline-flex items-center gap-2 text-sm font-medium text-primary">
    Revisiones del portal
    <PendingReviewsBadge count={pendingCount ?? 0} />
  </Link>
</div>
<section className="bg-card border border-border rounded-xl p-4">
  <InviteVendor vendorId={id} />
</section>
```

> **Adaptá** la inserción al layout real de `app/vendors/[id]/page.tsx` (este archivo ya está modificado en el working tree). Si la página es cliente, mové el conteo de `pendingCount` a un fetch o a un Server Component padre; lo importante es: enlace a `/vendors/[id]/reviews`, `<PendingReviewsBadge>` con el conteo de `submitted`, y `<InviteVendor vendorId={id} />`.

- [ ] **Step 6: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add components/vendor-pass/invite-vendor.tsx components/vendor-pass/pending-reviews-badge.tsx components/vendor-pass/review-queue.tsx "app/vendors/[id]/reviews/page.tsx" "app/vendors/[id]/page.tsx"
git commit -m "feat(portal): UI owner — invitar, cola de revisión y badge de pendientes"
```

---

## Task 15: Verificación end-to-end + RLS

**Files:** ninguno (verificación; los tests de token ya corren en `tests/portal.test.ts`)

- [ ] **Step 1: Suite + arranque**

Run: `npm test && npm run dev`
Expected: tests en verde (incluye `tests/portal.test.ts`); dev server en `http://localhost:3000`. Para ver los emails en desarrollo, abrí Mailpit en `http://localhost:8025` (ver `app/(auth)/register/page.tsx`).

- [ ] **Step 2: Invitar (owner)**

1. Login como owner → detalle de un proveedor → "Invitar contacto del proveedor al portal" → enviá a un email de prueba.
2. En Mailpit, abrí el correo "Te invitaron al portal…" y copiá el enlace `/portal/accept?token=vpi_…`.
Expected: la invitación se creó (DB: `select email, expires_at from vendor_portal_invites`); el token en claro **no** está en la DB (solo `token_hash`).

- [ ] **Step 3: Aceptar (proveedor)**

1. En una sesión/incógnito **sin login**, abrí el enlace → debe pedir crear cuenta/login (porque `/portal/accept` es público pero el canje requiere sesión).
2. Registrate (Mailpit → confirmá), volvé al enlace → debe canjear y redirigir a `/portal/vendors/[id]`.
3. Reabrí el mismo enlace → Expected: `410` "Invitación inválida, vencida o ya utilizada" (un solo uso).

- [ ] **Step 4: Subir y enviar (proveedor)**

1. En `/portal/vendors/[id]` → "Subir documento" → completá y "Subir y enviar a revisión".
Expected: el documento aparece "En revisión". El proveedor **no** ve ningún otro proveedor del tenant en `/portal` (solo el suyo).

- [ ] **Step 5: Verificación RLS (manual — criterio de aceptación)**

Con la sesión del proveedor (cookie) o vía SQL impersonando su `auth.uid()`:
```sql
-- Debe devolver SOLO su vendor (no otros del tenant):
select id, name from vendors;
-- Intento de leer otro vendor por id directo → 0 filas:
select id from vendors where id = '<OTRO_VENDOR_DEL_TENANT>';
-- Intento de pasar un doc directo a 'anchored' como miembro → debe fallar/0 filas por RLS:
update documents set review_status='anchored' where id='<DOC_DEL_PROVEEDOR>';
```
Expected: el miembro ve solo su vendor; el `update` a `anchored` no afecta filas (RLS `documents_update_member` solo admite `with check` en `portal_draft|submitted`).

Y vía API (sin Feature 2 expuesta, el endpoint de anchor podría no existir aún; si existe):
```bash
# Como proveedor (cookie de su sesión), intentar anclar directo:
curl -i -X POST http://localhost:3000/api/documents/<DOC>/anchor
```
Expected: `401/403/404` — el proveedor **no** puede anclar.

- [ ] **Step 6: Aprobar/anclar y rechazar (owner)**

1. Como owner → `/vendors/[id]/reviews` → el documento enviado aparece en la cola; el badge en el detalle muestra el conteo.
2. "Aprobar y anclar" → Expected: `review_status='anchored'`, el proveedor recibe email "Documento anclado" con link `/verify/[documentId]`, y (con Feature 2) el documento queda anclado en Arkiv. Sin Feature 2, el fallback hace `getStore().upsert(...)`.
3. Para otro documento, "Rechazar" con motivo → Expected: en `/portal/vendors/[id]` el proveedor ve "Rechazado" + "Motivo de rechazo: …", y puede corregir y reenviar (`rejected → submitted`).

- [ ] **Step 7: Commit final (si hubo ajustes)**

```bash
git add -A
git commit -m "chore(portal): ajustes finales tras verificación e2e/RLS"
```

---

## Criterios de aceptación

- [ ] **Aislamiento del proveedor:** un proveedor invitado sube documentos **sin ver otros proveedores del tenant** (Task 1 RLS `vendors_select_member`/`documents_*_member` + Task 4 `listMemberVendors` + Task 12 home; verificado en Task 15 Step 5).
- [ ] **Aprobar y anclar en un clic (o separados):** el owner tiene "Aprobar y anclar" y "Solo aprobar" (Task 14 `ReviewQueue` + Task 9 `?anchor=1`). El anclaje usa el endpoint/función de Feature 2 en el punto marcado.
- [ ] **El proveedor NO puede anclar:** RLS impide `→ anchored` para miembros (Task 1 `documents_update_member`) y no existe endpoint de anchor en el portal; verificado en Task 15 Step 5.
- [ ] **Rechazo con motivo visible:** `reject` guarda `rejection_reason` (Task 9) y el portal lo muestra (Task 12 detalle); reenvío `rejected → submitted` permitido (Task 8).
- [ ] **Token seguro:** un solo uso (`accepted_at` + `isInviteUsable`) y expira a 7 días (`INVITE_TTL_DAYS`), guardado solo como hash sha256 (Task 1/3/7); verificado en Task 15 Steps 2-3.
- [ ] **Notificaciones:** invitación, documento enviado, aprobado, rechazado y anclado (Task 5), enviadas en los endpoints correspondientes (Tasks 6/8/9).

---

## Self-Review

**1. Cobertura del objetivo:**
- ✅ Modelo de invitación (`vendor_portal_invites` + `vendor_portal_members`) → Task 1; token un solo uso/7 días/hash → Task 3 (TDD) + Task 6/7.
- ✅ Flujo documento portal `portal_draft → submitted → approved/rejected → anchored` → columna `review_status` (Task 1), subida/envío (Task 8), aprobación con anchor (Task 9), rechazo (Task 9).
- ✅ Permisos RLS: miembros leen/insertan **solo** su `vendor_id`, no ven otros vendors, **no** pueden anclar → Task 1 (`is_portal_member`, `vendors_select_member`, `documents_insert/update_member`).
- ✅ Rutas: `/portal`, `/portal/vendors/[id]`, `/portal/vendors/[id]/documents/new`, `/portal/accept`, `/vendors/[id]/reviews` → Tasks 10/12/14.
- ✅ Layout del portal sin sidebar del tenant → Task 10 (`app/(portal)/layout.tsx` + `PortalShell`).
- ✅ Cola "Pendientes de aprobación" + badge contador para el owner → Task 14.
- ✅ Notificaciones reusando `lib/email/transport.ts` → Task 5.
- ✅ Middleware: `/portal/*` autenticadas, `/portal/accept` público → Task 13 (con la advertencia de NO abrir todo `/portal`).
- ✅ Tests de token + checklist RLS manual → Task 3 (`tests/portal.test.ts`) + Task 15 Step 5.

**2. Dependencias declaradas y puntos de integración:**
- **Feature 2 (anchor):** punto exacto marcado `── PUNTO DE INTEGRACIÓN FEATURE 2 ──` en `app/api/documents/[id]/approve/route.ts` (dentro de `if (doAnchor)`). Fallback explícito (`getStore().upsert`, idéntico al patrón verificado en `app/api/documents/route.ts`) para no bloquear el desarrollo si F2 no está mergeada; reemplazo claro por `anchorDocument()`/POST `/api/documents/[id]/anchor`.
- **Feature 4 (timeline):** llamadas `recordDocumentEvent` declaradas como opcionales/comentadas con `try/catch` en submit (Task 8) y approve (Task 9). No rompen si F4 no existe.
- **Feature 1 (pasaporte tras anchor):** no se modifica; solo se garantiza que el camino a `anchored` pasa por la aprobación. `verifyUrl` usa `/verify/[documentId]` (verificado: `app/verify/[documentId]/` existe), con nota de ajuste.

**3. Placeholders y verificaciones pendientes:** sin TODOs ciegos. Marcadores deliberados con instrucción explícita: (a) numeración de migración `0009` (confirmada contra `supabase/migrations/` que ya llega a `0006`; F2=0007, F4=0008, F5=0009); (b) campos a agregar en `VendorDocument` (Task 2); (c) imports del design system (`form-field`, `app-shell`, `page-header`, `status-badge`) con nota de verificación contra archivos confirmados (`register/page.tsx`, `integrations/page.tsx`); (d) inserción en `app/vendors/[id]/page.tsx` adaptable al layout real (archivo ya modificado en el working tree); (e) punto de integración Feature 2.

**4. Consistencia de tipos/nombres:** `ReviewStatus` (Task 2) se usa en RLS (Task 1, mismos literales), en las páginas del portal (`REVIEW_LABEL`, Task 12) y en los endpoints (Tasks 8/9). `generateInviteToken`/`hashInviteToken`/`isInviteUsable`/`isValidTokenFormat` (Task 3) se consumen en invites/accept (Tasks 6/7). `requirePortalMember`/`listMemberVendors` (Task 4) se usan en API de subida (Task 8) y páginas del portal (Task 12). El prefijo `vpi_` y el regex `isValidTokenFormat` concuerdan con el token generado. Las rutas del portal coinciden entre páginas, redirects (`?next=`), el `PUBLIC_PREFIXES` del middleware (`/portal/accept`) y las URLs de los emails (`/portal/accept?token=`, `/portal/vendors/[id]`, `/vendors/[id]/reviews`, `/verify/[documentId]`). Las RLS de inserción/actualización (Task 1) y los `review_status` que escriben los endpoints (Tasks 8/9) son coherentes: el miembro nunca escribe `anchored`; solo el owner (sesión de dueño) lo hace en `approve`.

---

## Stretch opcional (fuera del MVP)

- **Invitado público sin cuenta (v2):** subida única por token mágico sin registro (actor "Público invitado" de la spec 5.1), con un endpoint que valide el token en cada request en vez de crear membership.
- **Rol `viewer` funcional:** hoy el rol existe en la tabla; agregar vistas de solo-lectura y bloquear el form de subida para `viewer` en la UI (la API ya lo bloquea).
- **Reenvío/expiración de invitaciones desde la UI del owner:** listar invitaciones pendientes, reenviar (nuevo token) o revocar.
- **Adjuntar archivo real + extracción IA** en el form del portal, reusando la subida con SHA-256 y la IA opcional del `DocumentForm` del owner.
- **Auto-anchor configurable:** preferencia del tenant para anclar automáticamente al aprobar (sin el clic extra).
