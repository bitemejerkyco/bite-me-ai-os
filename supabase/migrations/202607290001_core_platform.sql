begin;

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  system_role text not null default 'CUSTOMER'
    check (system_role in ('SUPER_ADMIN', 'CUSTOMER')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  slug text not null unique,
  website text,
  industry text not null default 'GENERAL_RETAIL',
  primary_goal text,
  audience text,
  voice text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_memberships (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'MEMBER'
    check (role in ('SUPER_ADMIN', 'ADMIN', 'MEMBER', 'DEMO')),
  billing_exempt boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists public.content_drafts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  channel text not null,
  objective text not null,
  title text not null,
  copy text not null,
  compliance_note text,
  status text not null default 'DRAFT'
    check (status in ('DRAFT', 'APPROVED', 'ARCHIVED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  name text not null,
  objective text not null,
  channel text not null,
  status text not null default 'PLANNED'
    check (status in ('PLANNED', 'ACTIVE', 'PAUSED')),
  start_date date not null,
  budget numeric(12, 2) not null default 0 check (budget >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  asset_type text not null,
  mime_type text,
  size_bytes bigint not null default 0 check (size_bytes >= 0),
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  target_type text,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists content_drafts_workspace_created_idx
  on public.content_drafts(workspace_id, created_at desc);
create index if not exists campaigns_workspace_created_idx
  on public.campaigns(workspace_id, created_at desc);
create index if not exists media_assets_workspace_created_idx
  on public.media_assets(workspace_id, created_at desc);
create index if not exists audit_logs_workspace_created_idx
  on public.audit_logs(workspace_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists workspaces_set_updated_at on public.workspaces;
create trigger workspaces_set_updated_at
before update on public.workspaces
for each row execute function public.set_updated_at();

drop trigger if exists content_drafts_set_updated_at on public.content_drafts;
create trigger content_drafts_set_updated_at
before update on public.content_drafts
for each row execute function public.set_updated_at();

drop trigger if exists campaigns_set_updated_at on public.campaigns;
create trigger campaigns_set_updated_at
before update on public.campaigns
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspaces w
    where w.id = target_workspace_id
      and w.owner_user_id = (select auth.uid())
  ) or exists (
    select 1
    from public.workspace_memberships m
    where m.workspace_id = target_workspace_id
      and m.user_id = (select auth.uid())
  );
$$;

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_memberships enable row level security;
alter table public.content_drafts enable row level security;
alter table public.campaigns enable row level security;
alter table public.media_assets enable row level security;
alter table public.audit_logs enable row level security;

create policy "profiles_select_own" on public.profiles
for select to authenticated using (user_id = (select auth.uid()));
create policy "profiles_update_own" on public.profiles
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy "workspaces_select_member" on public.workspaces
for select to authenticated using (public.is_workspace_member(id));
create policy "workspaces_insert_owner" on public.workspaces
for insert to authenticated with check (owner_user_id = (select auth.uid()));
create policy "workspaces_update_owner" on public.workspaces
for update to authenticated
using (owner_user_id = (select auth.uid()))
with check (owner_user_id = (select auth.uid()));
create policy "workspaces_delete_owner" on public.workspaces
for delete to authenticated using (owner_user_id = (select auth.uid()));

create policy "memberships_select_member" on public.workspace_memberships
for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "memberships_insert_owner" on public.workspace_memberships
for insert to authenticated with check (
  exists (
    select 1 from public.workspaces w
    where w.id = workspace_id and w.owner_user_id = (select auth.uid())
  )
);
create policy "memberships_update_owner" on public.workspace_memberships
for update to authenticated using (
  exists (
    select 1 from public.workspaces w
    where w.id = workspace_id and w.owner_user_id = (select auth.uid())
  )
);
create policy "memberships_delete_owner" on public.workspace_memberships
for delete to authenticated using (
  exists (
    select 1 from public.workspaces w
    where w.id = workspace_id and w.owner_user_id = (select auth.uid())
  )
);

create policy "drafts_member_all" on public.content_drafts
for all to authenticated
using (public.is_workspace_member(workspace_id))
with check (
  public.is_workspace_member(workspace_id)
  and created_by = (select auth.uid())
);

create policy "campaigns_member_all" on public.campaigns
for all to authenticated
using (public.is_workspace_member(workspace_id))
with check (
  public.is_workspace_member(workspace_id)
  and created_by = (select auth.uid())
);

create policy "media_member_all" on public.media_assets
for all to authenticated
using (public.is_workspace_member(workspace_id))
with check (
  public.is_workspace_member(workspace_id)
  and uploaded_by = (select auth.uid())
);

create policy "audit_select_member" on public.audit_logs
for select to authenticated using (
  actor_user_id = (select auth.uid())
  or public.is_workspace_member(workspace_id)
);
create policy "audit_insert_actor" on public.audit_logs
for insert to authenticated with check (actor_user_id = (select auth.uid()));

grant usage on schema public to authenticated, service_role;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.workspaces to authenticated;
grant select, insert, update, delete on public.workspace_memberships to authenticated;
grant select, insert, update, delete on public.content_drafts to authenticated;
grant select, insert, update, delete on public.campaigns to authenticated;
grant select, insert, update, delete on public.media_assets to authenticated;
grant select, insert on public.audit_logs to authenticated;
grant usage, select on sequence public.audit_logs_id_seq to authenticated;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on function public.is_workspace_member(uuid) to authenticated, service_role;

insert into storage.buckets (id, name, public, file_size_limit)
values ('brand-media', 'brand-media', false, 52428800)
on conflict (id) do update
set public = false, file_size_limit = excluded.file_size_limit;

create policy "brand_media_select_member" on storage.objects
for select to authenticated using (
  bucket_id = 'brand-media'
  and public.is_workspace_member(((storage.foldername(name))[1])::uuid)
);
create policy "brand_media_insert_member" on storage.objects
for insert to authenticated with check (
  bucket_id = 'brand-media'
  and public.is_workspace_member(((storage.foldername(name))[1])::uuid)
  and owner_id = (select auth.uid()::text)
);
create policy "brand_media_update_owner" on storage.objects
for update to authenticated using (
  bucket_id = 'brand-media'
  and owner_id = (select auth.uid()::text)
);
create policy "brand_media_delete_owner" on storage.objects
for delete to authenticated using (
  bucket_id = 'brand-media'
  and owner_id = (select auth.uid()::text)
);

commit;
