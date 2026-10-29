-- Rodar em um projeto Supabase NOVO e exclusivo do BackScan.
-- Nenhum dado é acessível de forma anônima.
create table if not exists public.incidents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  contact text not null check (char_length(contact) between 1 and 160),
  channel text not null check (char_length(channel) between 1 and 60),
  title text not null check (char_length(title) between 1 and 180),
  details text not null check (char_length(details) between 1 and 4000),
  status text not null default 'aberto' check (status in ('aberto','fechado')),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create table if not exists public.evidence (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  file_path text not null unique,
  file_name text not null check (char_length(file_name) between 1 and 240),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);
create index if not exists incidents_by_owner on public.incidents(owner_id, created_at desc);
create index if not exists evidence_by_incident on public.evidence(incident_id, created_at desc);
alter table public.incidents enable row level security;
alter table public.evidence enable row level security;

revoke all on public.incidents, public.evidence from anon;
grant select,insert,update,delete on public.incidents, public.evidence to authenticated;

create policy "incidents_select_owned" on public.incidents
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "incidents_insert_owned" on public.incidents
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "incidents_update_owned" on public.incidents
  for update to authenticated using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy "incidents_delete_owned" on public.incidents
  for delete to authenticated using ((select auth.uid()) = owner_id);

create policy "evidence_select_owned" on public.evidence
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "evidence_insert_owned" on public.evidence
  for insert to authenticated with check (
    (select auth.uid()) = owner_id and
    exists (select 1 from public.incidents i
      where i.id = incident_id and i.owner_id = (select auth.uid())) and
    split_part(file_path, '/', 1) = (select auth.uid())::text
  );
create policy "evidence_delete_owned" on public.evidence
  for delete to authenticated using ((select auth.uid()) = owner_id);

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values (
  'backscan-evidence','backscan-evidence',false,10485760,
  array['image/png','image/jpeg','image/webp','application/pdf','text/plain']
) on conflict (id) do nothing;

create policy "backscan_storage_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'backscan-evidence'
    and split_part(name, '/', 1) = (select auth.uid())::text);
create policy "backscan_storage_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'backscan-evidence'
    and split_part(name, '/', 1) = (select auth.uid())::text);
create policy "backscan_storage_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'backscan-evidence'
    and split_part(name, '/', 1) = (select auth.uid())::text);
