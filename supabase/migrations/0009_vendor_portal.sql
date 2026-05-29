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
