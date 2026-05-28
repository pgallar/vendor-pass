create table public.email_notifications (
  id uuid primary key default uuid_generate_v4(),
  document_id uuid not null references public.documents(id) on delete cascade,
  notification_type text not null
    check (notification_type in ('expiring_30d', 'expiring_7d', 'expired')),
  recipient_email text not null,
  sent_at timestamptz not null default now(),
  unique (document_id, notification_type)
);

create index email_notifications_sent_at_idx on public.email_notifications(sent_at);

alter table public.email_notifications enable row level security;
create policy "email_notifications service" on public.email_notifications
  for all using (true) with check (true);

grant all on public.email_notifications to anon, authenticated, service_role;
