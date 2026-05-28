-- Multi-tenant: vendors owned by auth user (nullable = demo seed orphans)
alter table public.vendors
  add column if not exists user_id uuid;

create index if not exists vendors_user_id_idx on public.vendors(user_id);

-- Claim orphan demo vendors for the authenticated user (first registrant wins)
create or replace function public.claim_legacy_vendors()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed integer;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  update public.vendors
  set user_id = auth.uid()
  where user_id is null;

  get diagnostics claimed = row_count;
  return claimed;
end;
$$;

revoke all on function public.claim_legacy_vendors() from public;
grant execute on function public.claim_legacy_vendors() to authenticated;

drop policy if exists "vendors all" on public.vendors;
drop policy if exists "documents all" on public.documents;

create policy "vendors_select_own" on public.vendors
  for select using (auth.uid() = user_id);

create policy "vendors_insert_own" on public.vendors
  for insert with check (auth.uid() = user_id);

create policy "vendors_update_own" on public.vendors
  for update using (auth.uid() = user_id);

create policy "vendors_delete_own" on public.vendors
  for delete using (auth.uid() = user_id);

create policy "documents_select_own" on public.documents
  for select using (
    exists (
      select 1 from public.vendors v
      where v.id = vendor_id and v.user_id = auth.uid()
    )
  );

create policy "documents_insert_own" on public.documents
  for insert with check (
    exists (
      select 1 from public.vendors v
      where v.id = vendor_id and v.user_id = auth.uid()
    )
  );

create policy "documents_update_own" on public.documents
  for update using (
    exists (
      select 1 from public.vendors v
      where v.id = vendor_id and v.user_id = auth.uid()
    )
  );

create policy "documents_delete_own" on public.documents
  for delete using (
    exists (
      select 1 from public.vendors v
      where v.id = vendor_id and v.user_id = auth.uid()
    )
  );
