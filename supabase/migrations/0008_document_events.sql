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
