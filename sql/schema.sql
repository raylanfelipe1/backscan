-- Execute apenas em um projeto NOVO e exclusivo do BackScan.
-- A transação falha por inteiro se as tabelas já existirem.
begin;

-- Gerenciada somente pelo administrador no SQL Editor (não pelo navegador).
create table public.authorized_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.authorized_users enable row level security;
revoke all on public.authorized_users from public, anon, authenticated;
grant select on public.authorized_users to authenticated;
create policy "authorization_read_self" on public.authorized_users
  for select to authenticated using (user_id = (select auth.uid()));

create table public.incidents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  contact text not null check (char_length(btrim(contact)) between 1 and 160),
  channel text not null check (char_length(btrim(channel)) between 1 and 60),
  title text not null check (char_length(btrim(title)) between 1 and 180),
  details text not null check (char_length(btrim(details)) between 1 and 4000),
  status text not null default 'aberto' check (status in ('aberto','fechado')),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (id, owner_id)
);
create table public.evidence (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  file_path text not null unique,
  file_name text not null check (char_length(btrim(file_name)) between 1 and 240),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  foreign key (incident_id, owner_id) references public.incidents(id, owner_id) on delete cascade,
  check (split_part(file_path, '/', 1) = owner_id::text
    and split_part(file_path, '/', 2) = incident_id::text
    and file_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}$')
);
create index incidents_by_owner on public.incidents(owner_id, created_at desc);
create index evidence_by_owner on public.evidence(owner_id);
create index evidence_by_incident on public.evidence(incident_id, owner_id, created_at desc);
alter table public.incidents enable row level security;
alter table public.evidence enable row level security;

revoke all on public.incidents, public.evidence from public, anon, authenticated;
grant select, insert, update, delete on public.incidents to authenticated;
-- Evidências não podem ser sobrescritas. Um novo arquivo recebe outro identificador.
grant select, insert, delete on public.evidence to authenticated;

create policy "incidents_authorized" on public.incidents as restrictive
  for all to authenticated
  using (exists (select 1 from public.authorized_users where user_id = (select auth.uid())))
  with check (exists (select 1 from public.authorized_users where user_id = (select auth.uid())));
create policy "incidents_select_owned" on public.incidents
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "incidents_insert_owned" on public.incidents
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "incidents_update_owned" on public.incidents
  for update to authenticated using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy "incidents_delete_owned" on public.incidents
  for delete to authenticated using ((select auth.uid()) = owner_id);

create policy "evidence_authorized" on public.evidence as restrictive
  for all to authenticated
  using (exists (select 1 from public.authorized_users where user_id = (select auth.uid())))
  with check (exists (select 1 from public.authorized_users where user_id = (select auth.uid())));
create policy "evidence_select_owned" on public.evidence
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "evidence_insert_owned" on public.evidence
  for insert to authenticated with check (
    (select auth.uid()) = owner_id
    and exists (select 1 from public.incidents i
      where i.id = incident_id and i.owner_id = (select auth.uid()))
    and exists (select 1 from storage.objects o
      where o.bucket_id = 'backscan-evidence' and o.name = file_path)
  );
create policy "evidence_delete_owned" on public.evidence
  for delete to authenticated using ((select auth.uid()) = owner_id);

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('backscan-evidence','backscan-evidence',false,10485760,
  array['image/png','image/jpeg','image/webp','application/pdf','text/plain']);

create policy "backscan_storage_insert" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'backscan-evidence'
    and split_part(name, '/', 1) = (select auth.uid())::text
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}$'
    and exists (select 1 from public.incidents i
      where i.id::text = split_part(name, '/', 2) and i.owner_id = (select auth.uid()))
  );
create policy "backscan_storage_read" on storage.objects
  for select to authenticated using (
    bucket_id = 'backscan-evidence'
    and split_part(name, '/', 1) = (select auth.uid())::text
    and exists (select 1 from public.authorized_users where user_id = (select auth.uid()))
  );
-- Permite limpar inclusive arquivos órfãos após falha no registro do metadado.
create policy "backscan_storage_delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'backscan-evidence'
    and split_part(name, '/', 1) = (select auth.uid())::text
    and exists (select 1 from public.authorized_users where user_id = (select auth.uid()))
  );
commit;
