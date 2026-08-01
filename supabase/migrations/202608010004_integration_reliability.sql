begin;

create table if not exists public.integration_provider_settings (
  id uuid primary key default gen_random_uuid(),
  provider text not null unique,
  globally_enabled boolean not null default true,
  oauth_enabled boolean not null default true,
  publishing_enabled boolean not null default false,
  analytics_enabled boolean not null default false,
  webhooks_enabled boolean not null default false,
  background_sync_enabled boolean not null default false,
  maintenance_mode boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null,
  external_account_id text,
  external_account_key text not null default '',
  account_name text,
  scopes text[] not null default '{}'::text[],
  encrypted_access_token text,
  encrypted_refresh_token text,
  connected_at timestamptz,
  last_successful_sync_at timestamptz,
  last_health_check_at timestamptz,
  token_expires_at timestamptz,
  refresh_expires_at timestamptz,
  last_error_code text,
  last_error_message text,
  retry_after timestamptz,
  refresh_lock_owner text,
  refresh_lock_expires_at timestamptz,
  status text not null default 'NOT_CONFIGURED' check (status in (
    'NOT_CONFIGURED',
    'CONNECTING',
    'CONNECTED',
    'TOKEN_EXPIRING',
    'TOKEN_EXPIRED',
    'RECONNECT_REQUIRED',
    'DEGRADED',
    'RATE_LIMITED',
    'ERROR',
    'DISCONNECTED'
  )),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, provider, external_account_key)
);

create table if not exists public.integration_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null,
  job_type text not null check (job_type in (
    'TOKEN_REFRESH',
    'HEALTH_CHECK',
    'DATA_SYNC',
    'PUBLISH_CONTENT',
    'CHECK_PUBLISH_STATUS',
    'FETCH_ANALYTICS',
    'PROCESS_WEBHOOK',
    'RETRY_FAILED_OPERATION'
  )),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'QUEUED' check (status in (
    'QUEUED',
    'CLAIMED',
    'RUNNING',
    'RETRY_WAIT',
    'COMPLETED',
    'FAILED',
    'CANCELLED',
    'DEAD_LETTER'
  )),
  priority smallint not null default 50,
  attempt_count integer not null default 0,
  max_attempts integer not null default 5,
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  lock_expires_at timestamptz,
  locked_by text,
  started_at timestamptz,
  completed_at timestamptz,
  last_error_code text,
  last_error_message text,
  idempotency_key text not null,
  created_by uuid references auth.users(id) on delete set null,
  workflow_id uuid references public.marketing_workflows(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, idempotency_key)
);

create table if not exists public.integration_events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  provider text not null,
  operation text not null,
  job_id uuid references public.integration_jobs(id) on delete set null,
  workflow_id uuid references public.marketing_workflows(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  severity text not null default 'info' check (severity in ('debug', 'info', 'warning', 'error', 'critical')),
  status text not null,
  error_code text,
  sanitized_message text not null,
  duration_ms integer,
  attempt integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.integration_rate_limits (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null,
  external_account_id text,
  external_account_key text not null default '',
  operation text not null,
  remaining integer,
  reset_at timestamptz,
  retry_after_seconds integer,
  source text not null,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (workspace_id, provider, external_account_key, operation)
);

create table if not exists public.integration_webhook_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete set null,
  provider text not null,
  external_event_id text,
  webhook_signature text,
  status text not null default 'RECEIVED' check (status in (
    'RECEIVED',
    'VERIFIED',
    'PROCESSING',
    'PROCESSED',
    'FAILED',
    'REJECTED',
    'DUPLICATE'
  )),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  last_error_code text,
  last_error_message text,
  payload jsonb,
  payload_hash text,
  dedupe_key text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, dedupe_key)
);

create table if not exists public.integration_metric_snapshots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null,
  external_account_id text,
  metric_period_start timestamptz not null,
  metric_period_end timestamptz not null,
  fetched_at timestamptz not null default now(),
  attribution_window text,
  currency text,
  timezone text,
  source text not null,
  metric_source_id text,
  metrics jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists integration_connections_workspace_provider_idx
  on public.integration_connections(workspace_id, provider, status);
create index if not exists integration_connections_refresh_idx
  on public.integration_connections(provider, token_expires_at, refresh_lock_expires_at);
create index if not exists integration_jobs_claim_idx
  on public.integration_jobs(status, next_attempt_at, priority desc, created_at asc);
create index if not exists integration_jobs_workspace_provider_idx
  on public.integration_jobs(workspace_id, provider, status, updated_at desc);
create index if not exists integration_events_workspace_created_idx
  on public.integration_events(workspace_id, created_at desc);
create index if not exists integration_rate_limits_lookup_idx
  on public.integration_rate_limits(workspace_id, provider, operation);
create index if not exists integration_webhook_events_provider_received_idx
  on public.integration_webhook_events(provider, received_at desc);
create index if not exists integration_metric_snapshots_lookup_idx
  on public.integration_metric_snapshots(workspace_id, provider, metric_period_end desc);

create or replace function public.claim_integration_jobs(
  worker_name text,
  claim_limit integer default 10,
  lock_seconds integer default 120
)
returns setof public.integration_jobs
language plpgsql
security definer
as $$
begin
  return query
  with candidate as (
    select id
    from public.integration_jobs
    where status in ('QUEUED', 'RETRY_WAIT', 'CLAIMED')
      and next_attempt_at <= now()
      and (
        locked_at is null
        or lock_expires_at is null
        or lock_expires_at <= now()
      )
    order by priority desc, created_at asc
    limit greatest(1, claim_limit)
    for update skip locked
  ), updated as (
    update public.integration_jobs j
    set
      status = 'CLAIMED',
      locked_by = worker_name,
      locked_at = now(),
      lock_expires_at = now() + make_interval(secs => greatest(30, lock_seconds)),
      updated_at = now()
    from candidate c
    where j.id = c.id
    returning j.*
  )
  select * from updated;
end;
$$;

alter table public.integration_provider_settings enable row level security;
alter table public.integration_connections enable row level security;
alter table public.integration_jobs enable row level security;
alter table public.integration_events enable row level security;
alter table public.integration_rate_limits enable row level security;
alter table public.integration_webhook_events enable row level security;
alter table public.integration_metric_snapshots enable row level security;

drop policy if exists "integration_provider_settings_select_super_admin" on public.integration_provider_settings;
create policy "integration_provider_settings_select_super_admin"
on public.integration_provider_settings
for select to authenticated
using (public.is_super_admin());

drop policy if exists "integration_provider_settings_mutate_super_admin" on public.integration_provider_settings;
create policy "integration_provider_settings_mutate_super_admin"
on public.integration_provider_settings
for all to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

drop policy if exists "integration_connections_select_member_or_super_admin" on public.integration_connections;
create policy "integration_connections_select_member_or_super_admin"
on public.integration_connections
for select to authenticated
using (public.is_super_admin() or public.current_user_belongs_to_account(workspace_id));

drop policy if exists "integration_connections_insert_member_or_super_admin" on public.integration_connections;
create policy "integration_connections_insert_member_or_super_admin"
on public.integration_connections
for insert to authenticated
with check (public.is_super_admin() or public.current_user_belongs_to_account(workspace_id));

drop policy if exists "integration_connections_update_member_or_super_admin" on public.integration_connections;
create policy "integration_connections_update_member_or_super_admin"
on public.integration_connections
for update to authenticated
using (public.is_super_admin() or public.current_user_belongs_to_account(workspace_id))
with check (public.is_super_admin() or public.current_user_belongs_to_account(workspace_id));

drop policy if exists "integration_jobs_select_member_or_super_admin" on public.integration_jobs;
create policy "integration_jobs_select_member_or_super_admin"
on public.integration_jobs
for select to authenticated
using (public.is_super_admin() or public.current_user_belongs_to_account(workspace_id));

drop policy if exists "integration_jobs_insert_member_or_super_admin" on public.integration_jobs;
create policy "integration_jobs_insert_member_or_super_admin"
on public.integration_jobs
for insert to authenticated
with check (public.is_super_admin() or public.current_user_belongs_to_account(workspace_id));

drop policy if exists "integration_jobs_update_member_or_super_admin" on public.integration_jobs;
create policy "integration_jobs_update_member_or_super_admin"
on public.integration_jobs
for update to authenticated
using (public.is_super_admin() or public.current_user_belongs_to_account(workspace_id))
with check (public.is_super_admin() or public.current_user_belongs_to_account(workspace_id));

drop policy if exists "integration_events_select_member_or_super_admin" on public.integration_events;
create policy "integration_events_select_member_or_super_admin"
on public.integration_events
for select to authenticated
using (workspace_id is null or public.is_super_admin() or public.current_user_belongs_to_account(workspace_id));

drop policy if exists "integration_events_insert_member_or_super_admin" on public.integration_events;
create policy "integration_events_insert_member_or_super_admin"
on public.integration_events
for insert to authenticated
with check (workspace_id is null or public.is_super_admin() or public.current_user_belongs_to_account(workspace_id));

drop policy if exists "integration_rate_limits_select_member_or_super_admin" on public.integration_rate_limits;
create policy "integration_rate_limits_select_member_or_super_admin"
on public.integration_rate_limits
for select to authenticated
using (public.is_super_admin() or public.current_user_belongs_to_account(workspace_id));

drop policy if exists "integration_rate_limits_mutate_member_or_super_admin" on public.integration_rate_limits;
create policy "integration_rate_limits_mutate_member_or_super_admin"
on public.integration_rate_limits
for all to authenticated
using (public.is_super_admin() or public.current_user_belongs_to_account(workspace_id))
with check (public.is_super_admin() or public.current_user_belongs_to_account(workspace_id));

drop policy if exists "integration_webhook_events_select_super_admin_or_member" on public.integration_webhook_events;
create policy "integration_webhook_events_select_super_admin_or_member"
on public.integration_webhook_events
for select to authenticated
using (workspace_id is null or public.is_super_admin() or public.current_user_belongs_to_account(workspace_id));

drop policy if exists "integration_webhook_events_insert_authenticated" on public.integration_webhook_events;
create policy "integration_webhook_events_insert_authenticated"
on public.integration_webhook_events
for insert to authenticated
with check (workspace_id is null or public.is_super_admin() or public.current_user_belongs_to_account(workspace_id));

drop policy if exists "integration_webhook_events_update_authenticated" on public.integration_webhook_events;
create policy "integration_webhook_events_update_authenticated"
on public.integration_webhook_events
for update to authenticated
using (workspace_id is null or public.is_super_admin() or public.current_user_belongs_to_account(workspace_id))
with check (workspace_id is null or public.is_super_admin() or public.current_user_belongs_to_account(workspace_id));

drop policy if exists "integration_metric_snapshots_select_member_or_super_admin" on public.integration_metric_snapshots;
create policy "integration_metric_snapshots_select_member_or_super_admin"
on public.integration_metric_snapshots
for select to authenticated
using (public.is_super_admin() or public.current_user_belongs_to_account(workspace_id));

drop policy if exists "integration_metric_snapshots_insert_member_or_super_admin" on public.integration_metric_snapshots;
create policy "integration_metric_snapshots_insert_member_or_super_admin"
on public.integration_metric_snapshots
for insert to authenticated
with check (public.is_super_admin() or public.current_user_belongs_to_account(workspace_id));

grant execute on function public.claim_integration_jobs(text, integer, integer) to authenticated;

grant select, insert, update on public.integration_provider_settings to authenticated;
grant select, insert, update on public.integration_connections to authenticated;
grant select, insert, update on public.integration_jobs to authenticated;
grant select, insert on public.integration_events to authenticated;
grant select, insert, update on public.integration_rate_limits to authenticated;
grant select, insert, update on public.integration_webhook_events to authenticated;
grant select, insert on public.integration_metric_snapshots to authenticated;

grant all on public.integration_provider_settings to service_role;
grant all on public.integration_connections to service_role;
grant all on public.integration_jobs to service_role;
grant all on public.integration_events to service_role;
grant all on public.integration_rate_limits to service_role;
grant all on public.integration_webhook_events to service_role;
grant all on public.integration_metric_snapshots to service_role;

drop trigger if exists integration_provider_settings_set_updated_at on public.integration_provider_settings;
create trigger integration_provider_settings_set_updated_at
before update on public.integration_provider_settings
for each row execute function public.set_updated_at();

drop trigger if exists integration_connections_set_updated_at on public.integration_connections;
create trigger integration_connections_set_updated_at
before update on public.integration_connections
for each row execute function public.set_updated_at();

drop trigger if exists integration_jobs_set_updated_at on public.integration_jobs;
create trigger integration_jobs_set_updated_at
before update on public.integration_jobs
for each row execute function public.set_updated_at();

drop trigger if exists integration_rate_limits_set_updated_at on public.integration_rate_limits;
create trigger integration_rate_limits_set_updated_at
before update on public.integration_rate_limits
for each row execute function public.set_updated_at();

drop trigger if exists integration_webhook_events_set_updated_at on public.integration_webhook_events;
create trigger integration_webhook_events_set_updated_at
before update on public.integration_webhook_events
for each row execute function public.set_updated_at();

insert into public.integration_provider_settings (
  provider,
  globally_enabled,
  oauth_enabled,
  publishing_enabled,
  analytics_enabled,
  webhooks_enabled,
  background_sync_enabled,
  maintenance_mode,
  metadata
)
values
  ('tiktok', true, true, true, false, false, true, false, jsonb_build_object('priority', 1)),
  ('amazon_ads', true, true, false, true, false, true, false, jsonb_build_object('priority', 2, 'mode', 'live_read_only')),
  ('shopify', false, true, false, false, false, false, false, jsonb_build_object('priority', 3, 'status', 'coming_soon')),
  ('woocommerce', false, false, false, false, false, false, false, jsonb_build_object('priority', 3, 'status', 'coming_soon')),
  ('klaviyo', false, false, false, false, false, false, false, jsonb_build_object('priority', 4, 'status', 'coming_soon')),
  ('meta', false, false, false, false, false, false, false, jsonb_build_object('status', 'coming_soon')),
  ('linkedin', false, false, false, false, false, false, false, jsonb_build_object('status', 'coming_soon')),
  ('x', false, false, false, false, false, false, false, jsonb_build_object('status', 'coming_soon')),
  ('youtube', false, false, false, false, false, false, false, jsonb_build_object('status', 'coming_soon')),
  ('pinterest', false, false, false, false, false, false, false, jsonb_build_object('status', 'coming_soon')),
  ('google_business_profile', false, false, false, false, false, false, false, jsonb_build_object('status', 'coming_soon')),
  ('amazon_seller_central', false, false, false, false, false, false, false, jsonb_build_object('status', 'coming_soon')),
  ('mailchimp', false, false, false, false, false, false, false, jsonb_build_object('status', 'coming_soon')),
  ('ga4', false, false, false, false, false, false, false, jsonb_build_object('status', 'coming_soon'))
on conflict (provider) do update
set
  globally_enabled = excluded.globally_enabled,
  oauth_enabled = excluded.oauth_enabled,
  publishing_enabled = excluded.publishing_enabled,
  analytics_enabled = excluded.analytics_enabled,
  webhooks_enabled = excluded.webhooks_enabled,
  background_sync_enabled = excluded.background_sync_enabled,
  maintenance_mode = excluded.maintenance_mode,
  metadata = excluded.metadata,
  updated_at = now();

commit;
