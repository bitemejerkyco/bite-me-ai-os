begin;

create table if not exists public.tiktok_oauth_states (
  state_hash text primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.tiktok_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references public.workspaces(id) on delete cascade,
  connected_by uuid not null references auth.users(id) on delete cascade,
  environment text not null default 'SANDBOX'
    check (environment in ('SANDBOX')),
  status text not null default 'CONNECTED'
    check (status in ('CONNECTING', 'CONNECTED', 'EXPIRED', 'ERROR')),
  open_id text not null,
  scopes text[] not null default '{}',
  access_token_ciphertext text not null,
  refresh_token_ciphertext text not null,
  access_expires_at timestamptz not null,
  refresh_expires_at timestamptz not null,
  creator_username text,
  creator_nickname text,
  creator_avatar_url text,
  privacy_level_options text[] not null default '{}',
  comment_disabled boolean not null default false,
  duet_disabled boolean not null default false,
  stitch_disabled boolean not null default false,
  max_video_duration_seconds integer
    check (max_video_duration_seconds is null or max_video_duration_seconds > 0),
  last_error text,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tiktok_oauth_states_user_expires_idx
  on public.tiktok_oauth_states(user_id, expires_at desc);
create index if not exists tiktok_connections_workspace_status_idx
  on public.tiktok_connections(workspace_id, status);

drop trigger if exists tiktok_connections_set_updated_at
  on public.tiktok_connections;
create trigger tiktok_connections_set_updated_at
before update on public.tiktok_connections
for each row execute function public.set_updated_at();

alter table public.tiktok_oauth_states enable row level security;
alter table public.tiktok_connections enable row level security;

create policy "tiktok_oauth_states_owner_all"
on public.tiktok_oauth_states
for all to authenticated
using (
  user_id = (select auth.uid())
  and public.is_workspace_member(workspace_id)
)
with check (
  user_id = (select auth.uid())
  and public.is_workspace_member(workspace_id)
);

create policy "tiktok_connections_member_select"
on public.tiktok_connections
for select to authenticated
using (public.is_workspace_member(workspace_id));

create policy "tiktok_connections_member_insert"
on public.tiktok_connections
for insert to authenticated
with check (
  public.is_workspace_member(workspace_id)
  and connected_by = (select auth.uid())
);

create policy "tiktok_connections_connector_update"
on public.tiktok_connections
for update to authenticated
using (
  public.is_workspace_member(workspace_id)
  and connected_by = (select auth.uid())
)
with check (
  public.is_workspace_member(workspace_id)
  and connected_by = (select auth.uid())
);

create policy "tiktok_connections_connector_delete"
on public.tiktok_connections
for delete to authenticated
using (
  public.is_workspace_member(workspace_id)
  and connected_by = (select auth.uid())
);

grant select, insert, update, delete
  on public.tiktok_oauth_states to authenticated;
grant select, insert, update, delete
  on public.tiktok_connections to authenticated;

commit;
