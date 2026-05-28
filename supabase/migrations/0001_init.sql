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

create policy "vendors all" on public.vendors for all using (true) with check (true);
create policy "documents all" on public.documents for all using (true) with check (true);
