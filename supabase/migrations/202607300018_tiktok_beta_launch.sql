begin;

alter table public.tiktok_connections
  add column if not exists tiktok_open_id text,
  add column if not exists display_name text,
  add column if not exists avatar_url text,
  add column if not exists encrypted_access_token text,
  add column if not exists encrypted_refresh_token text,
  add column if not exists granted_scopes text[] not null default '{}',
  add column if not exists access_token_expires_at timestamptz,
  add column if not exists refresh_token_expires_at timestamptz,
  add column if not exists refreshed_at timestamptz,
  add column if not exists revoked_at timestamptz,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

update public.tiktok_connections
set
  tiktok_open_id = coalesce(tiktok_open_id, open_id),
  display_name = coalesce(display_name, creator_nickname, creator_username),
  avatar_url = coalesce(avatar_url, creator_avatar_url),
  encrypted_access_token = coalesce(encrypted_access_token, access_token_ciphertext),
  encrypted_refresh_token = coalesce(encrypted_refresh_token, refresh_token_ciphertext),
  granted_scopes = coalesce(granted_scopes, scopes, '{}'::text[]),
  access_token_expires_at = coalesce(access_token_expires_at, access_expires_at),
  refresh_token_expires_at = coalesce(refresh_token_expires_at, refresh_expires_at)
where true;

alter table public.tiktok_connections
  alter column tiktok_open_id set not null,
  alter column display_name set default '',
  alter column avatar_url set default '',
  alter column encrypted_access_token set not null,
  alter column encrypted_refresh_token set not null,
  alter column access_token_expires_at set not null,
  alter column refresh_token_expires_at set not null;

alter table public.tiktok_connections
  drop constraint if exists tiktok_connections_status_check;
alter table public.tiktok_connections
  add constraint tiktok_connections_status_check
  check (status in ('CONNECTING', 'CONNECTED', 'EXPIRED', 'ERROR', 'RECONNECT_REQUIRED'));

create unique index if not exists tiktok_connections_workspace_open_id_active_idx
  on public.tiktok_connections(workspace_id, tiktok_open_id)
  where revoked_at is null;

create index if not exists tiktok_connections_status_idx
  on public.tiktok_connections(status, updated_at desc);
create index if not exists tiktok_connections_refresh_idx
  on public.tiktok_connections(refresh_token_expires_at, access_token_expires_at);

create table if not exists public.tiktok_publish_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  connection_id uuid not null references public.tiktok_connections(id) on delete cascade,
  media_asset_id uuid references public.media_assets(id) on delete set null,
  scheduled_post_id uuid references public.scheduled_posts(id) on delete set null,
  publish_mode text not null check (publish_mode in ('beta_upload', 'direct_post')),
  publish_id text,
  status text not null default 'draft' check (
    status in (
      'draft',
      'validating',
      'initializing',
      'uploading',
      'processing',
      'inbox_delivered',
      'published',
      'failed',
      'cancelled',
      'reconnect_required'
    )
  ),
  caption text,
  privacy_level text,
  disable_comment boolean not null default false,
  disable_duet boolean not null default false,
  disable_stitch boolean not null default false,
  commercial_content_disclosure boolean not null default false,
  branded_content_toggle boolean not null default false,
  source_type text not null default 'PULL_FROM_URL',
  source_url text,
  error_code text,
  error_message text,
  uploaded_bytes bigint,
  publicly_available_post_ids jsonb not null default '[]'::jsonb,
  consented_at timestamptz,
  submitted_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tiktok_publish_jobs_workspace_status_idx
  on public.tiktok_publish_jobs(workspace_id, status, created_at desc);
create index if not exists tiktok_publish_jobs_connection_idx
  on public.tiktok_publish_jobs(connection_id, created_at desc);
create index if not exists tiktok_publish_jobs_publish_id_idx
  on public.tiktok_publish_jobs(publish_id);

create table if not exists public.tiktok_beta_allowed_workspaces (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references public.workspaces(id) on delete cascade,
  reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tiktok_beta_allowed_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tiktok_beta_allowed_workspaces_workspace_idx
  on public.tiktok_beta_allowed_workspaces(workspace_id);
create index if not exists tiktok_beta_allowed_users_user_idx
  on public.tiktok_beta_allowed_users(user_id);

insert into public.system_settings (
  key,
  value,
  category,
  description,
  is_secret
)
values
  ('tiktok_content_posting_mode', to_jsonb('beta_upload'::text), 'integrations', 'Platform-wide TikTok posting mode.', false),
  ('tiktok_webhooks_enabled', 'false'::jsonb, 'integrations', 'Enables TikTok webhook ingestion.', false),
  ('tiktok_media_base_url', to_jsonb(''::text), 'integrations', 'Public media base URL used for verified TikTok pulls.', false),
  ('tiktok_verified_url_prefix', to_jsonb(''::text), 'integrations', 'Verified HTTPS prefix TikTok is allowed to pull from.', false),
  ('tiktok_beta_emergency_disabled', 'false'::jsonb, 'integrations', 'Immediate emergency disable for TikTok publishing.', false),
  ('tiktok_daily_upload_limit_per_workspace', '5'::jsonb, 'integrations', 'Maximum TikTok uploads per workspace per day.', false),
  ('tiktok_max_pending_jobs_per_user', '5'::jsonb, 'integrations', 'Maximum pending TikTok jobs per user.', false),
  ('tiktok_beta_start_at', 'null'::jsonb, 'integrations', 'Optional TikTok beta start timestamp.', false),
  ('tiktok_beta_end_at', 'null'::jsonb, 'integrations', 'Optional TikTok beta end timestamp.', false)
on conflict (key) do nothing;

alter table public.tiktok_connections enable row level security;
alter table public.tiktok_publish_jobs enable row level security;
alter table public.tiktok_beta_allowed_workspaces enable row level security;
alter table public.tiktok_beta_allowed_users enable row level security;

create policy "tiktok_connections_select_workspace_member_or_admin"
on public.tiktok_connections
for select to authenticated
using (
  public.is_super_admin() or public.is_workspace_member(workspace_id)
);

create policy "tiktok_connections_insert_workspace_member_or_admin"
on public.tiktok_connections
for insert to authenticated
with check (
  public.is_super_admin() or public.is_workspace_member(workspace_id)
);

create policy "tiktok_connections_update_workspace_member_or_admin"
on public.tiktok_connections
for update to authenticated
using (
  public.is_super_admin() or public.is_workspace_member(workspace_id)
)
with check (
  public.is_super_admin() or public.is_workspace_member(workspace_id)
);

create policy "tiktok_connections_delete_workspace_member_or_admin"
on public.tiktok_connections
for delete to authenticated
using (
  public.is_super_admin() or public.is_workspace_member(workspace_id)
);

create policy "tiktok_publish_jobs_select_workspace_member_or_admin"
on public.tiktok_publish_jobs
for select to authenticated
using (
  public.is_super_admin() or public.is_workspace_member(workspace_id)
);

create policy "tiktok_publish_jobs_insert_workspace_member_or_admin"
on public.tiktok_publish_jobs
for insert to authenticated
with check (
  public.is_super_admin() or public.is_workspace_member(workspace_id)
);

create policy "tiktok_publish_jobs_update_workspace_member_or_admin"
on public.tiktok_publish_jobs
for update to authenticated
using (
  public.is_super_admin() or public.is_workspace_member(workspace_id)
)
with check (
  public.is_super_admin() or public.is_workspace_member(workspace_id)
);

create policy "tiktok_publish_jobs_delete_workspace_member_or_admin"
on public.tiktok_publish_jobs
for delete to authenticated
using (
  public.is_super_admin() or public.is_workspace_member(workspace_id)
);

create policy "tiktok_beta_allowed_workspaces_super_admin"
on public.tiktok_beta_allowed_workspaces
for all to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

create policy "tiktok_beta_allowed_users_super_admin"
on public.tiktok_beta_allowed_users
for all to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

grant select, insert, update, delete on public.tiktok_connections to authenticated;
grant select, insert, update, delete on public.tiktok_publish_jobs to authenticated;
grant select, insert, update, delete on public.tiktok_beta_allowed_workspaces to authenticated;
grant select, insert, update, delete on public.tiktok_beta_allowed_users to authenticated;

grant all on public.tiktok_connections to service_role;
grant all on public.tiktok_publish_jobs to service_role;
grant all on public.tiktok_beta_allowed_workspaces to service_role;
grant all on public.tiktok_beta_allowed_users to service_role;

create trigger tiktok_publish_jobs_set_updated_at
before update on public.tiktok_publish_jobs
for each row execute function public.set_updated_at();

create trigger tiktok_beta_allowed_workspaces_set_updated_at
before update on public.tiktok_beta_allowed_workspaces
for each row execute function public.set_updated_at();

create trigger tiktok_beta_allowed_users_set_updated_at
before update on public.tiktok_beta_allowed_users
for each row execute function public.set_updated_at();

commit;
