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
