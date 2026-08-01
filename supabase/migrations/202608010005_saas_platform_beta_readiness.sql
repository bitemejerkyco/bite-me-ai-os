begin;

alter table public.workspace_memberships
  drop constraint if exists workspace_memberships_role_check;

alter table public.workspace_memberships
  add constraint workspace_memberships_role_check
  check (
    role in (
      'SUPER_ADMIN',
      'ADMIN',
      'MEMBER',
      'DEMO',
      'OWNER',
      'MANAGER',
      'EDITOR',
      'APPROVER',
      'VIEWER',
      'GUEST'
    )
  );

create or replace function public.workspace_role_rank(role_value text)
returns integer
language sql
immutable
as $$
  select case upper(coalesce(role_value, ''))
    when 'SUPER_ADMIN' then 100
    when 'OWNER' then 90
    when 'ADMIN' then 80
    when 'MANAGER' then 70
    when 'EDITOR' then 60
    when 'APPROVER' then 50
    when 'VIEWER' then 40
    when 'GUEST' then 10
    when 'MEMBER' then 60
    when 'DEMO' then 20
    else 0
  end;
$$;

create or replace function public.has_workspace_role(
  target_workspace_id uuid,
  minimum_role text
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_memberships m
    where m.workspace_id = target_workspace_id
      and m.user_id = (select auth.uid())
      and m.status = 'ACTIVE'
      and public.workspace_role_rank(m.role) >= public.workspace_role_rank(minimum_role)
  )
  or public.is_super_admin();
$$;

revoke all on function public.workspace_role_rank(text) from public, anon;
revoke all on function public.has_workspace_role(uuid, text) from public, anon;
grant execute on function public.workspace_role_rank(text) to authenticated, service_role;
grant execute on function public.has_workspace_role(uuid, text) to authenticated, service_role;

alter table public.plan_entitlements
  drop constraint if exists plan_entitlements_entitlement_key_check;

alter table public.plan_entitlements
  add constraint plan_entitlements_entitlement_key_check
  check (entitlement_key in (
    'max_users',
    'max_workspaces',
    'max_brands',
    'monthly_ai_credits',
    'monthly_video_credits',
    'storage_limit_bytes',
    'bandwidth_limit_bytes',
    'scheduled_posts_per_month',
    'social_connections',
    'can_use_video_generation',
    'can_use_premium_video',
    'can_use_advanced_analytics',
    'can_use_client_workspaces',
    'can_use_priority_support',
    'monthly_publish_credits',
    'monthly_analytics_credits',
    'max_team_members',
    'max_connected_accounts',
    'ai_memory_enabled',
    'api_access_enabled',
    'custom_branding_enabled',
    'enterprise_support_enabled'
  ));

alter table public.account_entitlement_overrides
  drop constraint if exists account_entitlement_overrides_entitlement_key_check;

alter table public.account_entitlement_overrides
  add constraint account_entitlement_overrides_entitlement_key_check
  check (entitlement_key in (
    'max_users',
    'max_workspaces',
    'max_brands',
    'monthly_ai_credits',
    'monthly_video_credits',
    'storage_limit_bytes',
    'bandwidth_limit_bytes',
    'scheduled_posts_per_month',
    'social_connections',
    'can_use_video_generation',
    'can_use_premium_video',
    'can_use_advanced_analytics',
    'can_use_client_workspaces',
    'can_use_priority_support',
    'monthly_publish_credits',
    'monthly_analytics_credits',
    'max_team_members',
    'max_connected_accounts',
    'ai_memory_enabled',
    'api_access_enabled',
    'custom_branding_enabled',
    'enterprise_support_enabled'
  ));

create table if not exists public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  invited_by uuid not null references auth.users(id) on delete cascade,
  email text not null,
  role text not null
    check (role in ('OWNER', 'ADMIN', 'MANAGER', 'EDITOR', 'APPROVER', 'VIEWER', 'GUEST')),
  token_hash text not null unique,
  status text not null default 'PENDING'
    check (status in ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED')),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_collaboration_comments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null,
  entity_id text not null,
  body text not null,
  mentions jsonb not null default '[]'::jsonb,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'RESOLVED', 'DELETED')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  assigned_to uuid references auth.users(id) on delete set null,
  title text not null,
  description text,
  priority text not null default 'MEDIUM' check (priority in ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  status text not null default 'OPEN' check (status in ('OPEN', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED')),
  due_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_activity_history (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  entity_type text,
  entity_id text,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_approval_routes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  route_key text not null,
  minimum_role text not null
    check (minimum_role in ('OWNER', 'ADMIN', 'MANAGER', 'EDITOR', 'APPROVER', 'VIEWER', 'GUEST')),
  fallback_role text not null
    check (fallback_role in ('OWNER', 'ADMIN', 'MANAGER', 'EDITOR', 'APPROVER', 'VIEWER', 'GUEST')),
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, route_key)
);

create table if not exists public.workspace_branding_settings (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  logo_url text,
  primary_color text,
  custom_domain text,
  email_branding_name text,
  login_headline text,
  favicon_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketplace_packages (
  id uuid primary key default gen_random_uuid(),
  package_key text not null unique,
  package_type text not null
    check (package_type in ('AI_AGENT', 'TEMPLATE', 'PROMPT_PACK', 'CAMPAIGN_PACK', 'INDUSTRY_PACK')),
  name text not null,
  summary text,
  version text not null,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_marketplace_installs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  package_id uuid not null references public.marketplace_packages(id) on delete cascade,
  installed_by uuid references auth.users(id) on delete set null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'DISABLED', 'REMOVED')),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, package_id)
);

create table if not exists public.industry_templates (
  id uuid primary key default gen_random_uuid(),
  industry_key text not null unique,
  display_name text not null,
  description text,
  seed_payload jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stripe_customers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references public.workspaces(id) on delete cascade,
  stripe_customer_id text not null unique,
  email text,
  livemode boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stripe_subscriptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  stripe_customer_id text not null,
  stripe_subscription_id text not null unique,
  stripe_price_id text,
  plan_key text,
  status text not null,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.billing_invoices (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  stripe_invoice_id text not null unique,
  stripe_subscription_id text,
  amount_due_cents integer not null default 0,
  amount_paid_cents integer not null default 0,
  currency text not null default 'USD',
  status text not null,
  hosted_invoice_url text,
  invoice_pdf_url text,
  due_at timestamptz,
  paid_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  operation_type text not null check (operation_type in (
    'TEXT', 'IMAGE', 'VIDEO', 'SCHEDULING', 'ANALYTICS', 'PUBLISHING', 'ADJUSTMENT', 'REFUND'
  )),
  direction text not null check (direction in ('DEBIT', 'CREDIT')),
  amount integer not null check (amount > 0),
  reference_type text,
  reference_id text,
  idempotency_key text not null,
  status text not null default 'APPLIED' check (status in ('PENDING', 'APPLIED', 'REFUNDED', 'VOIDED')),
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (workspace_id, idempotency_key)
);

create table if not exists public.workspace_credit_balances (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  ai_credits_remaining integer not null default 0,
  video_credits_remaining integer not null default 0,
  publish_credits_remaining integer not null default 0,
  analytics_credits_remaining integer not null default 0,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_api_keys (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  key_prefix text not null,
  key_hash text not null unique,
  scopes text[] not null default '{}'::text[],
  expires_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  last_used_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  target_url text not null,
  signing_secret_ciphertext text not null,
  subscribed_events text[] not null default '{}'::text[],
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'PAUSED', 'DISABLED')),
  last_delivery_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  endpoint_id uuid not null references public.workspace_webhook_endpoints(id) on delete cascade,
  event_type text not null,
  status text not null check (status in ('PENDING', 'SUCCEEDED', 'FAILED')),
  attempt_count integer not null default 0,
  response_status integer,
  response_body text,
  next_attempt_at timestamptz,
  delivered_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_sso_configs (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  provider text not null default 'SAML',
  entry_point text,
  issuer text,
  certificate text,
  enabled boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_scim_configs (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  enabled boolean not null default false,
  bearer_token_hash text,
  last_synced_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_data_exports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  requested_by uuid references auth.users(id) on delete set null,
  status text not null default 'REQUESTED' check (status in ('REQUESTED', 'PROCESSING', 'READY', 'FAILED', 'EXPIRED')),
  export_type text not null,
  storage_path text,
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_backup_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete set null,
  backup_scope text not null check (backup_scope in ('WORKSPACE', 'GLOBAL')),
  status text not null check (status in ('STARTED', 'SUCCEEDED', 'FAILED')),
  storage_path text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.workspace_restore_tests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete set null,
  backup_run_id uuid references public.workspace_backup_runs(id) on delete set null,
  status text not null check (status in ('STARTED', 'SUCCEEDED', 'FAILED')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  notes text,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.workspace_replay_operations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete set null,
  replay_type text not null check (replay_type in ('JOB', 'WEBHOOK', 'MIGRATION_ROLLBACK')),
  source_reference text,
  status text not null check (status in ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED')),
  started_at timestamptz,
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_monitoring_snapshots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete set null,
  scope text not null check (scope in ('GLOBAL', 'WORKSPACE')),
  server_health text,
  queue_depth integer,
  publishing_failures integer,
  oauth_failures integer,
  integration_health text,
  ai_latency_ms integer,
  worker_health text,
  db_latency_ms integer,
  storage_bytes bigint,
  bandwidth_bytes bigint,
  api_cost_cents integer,
  captured_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.workspace_support_threads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  opened_by uuid references auth.users(id) on delete set null,
  category text not null,
  status text not null default 'OPEN' check (status in ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED')),
  subject text not null,
  body text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_onboarding_steps (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  step_key text not null,
  completed boolean not null default false,
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, step_key)
);

create table if not exists public.platform_release_notes (
  id uuid primary key default gen_random_uuid(),
  version text not null,
  title text not null,
  body text not null,
  published_at timestamptz,
  is_published boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists workspace_invitations_workspace_status_idx
  on public.workspace_invitations(workspace_id, status, created_at desc);
create index if not exists workspace_comments_workspace_entity_idx
  on public.workspace_collaboration_comments(workspace_id, entity_type, entity_id, created_at desc);
create index if not exists workspace_tasks_workspace_status_idx
  on public.workspace_tasks(workspace_id, status, updated_at desc);
create index if not exists workspace_activity_workspace_created_idx
  on public.workspace_activity_history(workspace_id, created_at desc);
create index if not exists workspace_marketplace_installs_workspace_idx
  on public.workspace_marketplace_installs(workspace_id, status);
create index if not exists stripe_subscriptions_workspace_status_idx
  on public.stripe_subscriptions(workspace_id, status, updated_at desc);
create index if not exists billing_invoices_workspace_status_idx
  on public.billing_invoices(workspace_id, status, created_at desc);
create index if not exists credit_ledger_workspace_created_idx
  on public.credit_ledger(workspace_id, created_at desc);
create index if not exists workspace_api_keys_workspace_idx
  on public.workspace_api_keys(workspace_id, revoked_at, expires_at);
create index if not exists workspace_webhook_deliveries_status_idx
  on public.workspace_webhook_deliveries(workspace_id, status, updated_at desc);
create index if not exists workspace_data_exports_workspace_status_idx
  on public.workspace_data_exports(workspace_id, status, created_at desc);
create index if not exists workspace_monitoring_snapshots_scope_captured_idx
  on public.workspace_monitoring_snapshots(scope, captured_at desc);

alter table public.workspace_invitations enable row level security;
alter table public.workspace_collaboration_comments enable row level security;
alter table public.workspace_tasks enable row level security;
alter table public.workspace_activity_history enable row level security;
alter table public.workspace_approval_routes enable row level security;
alter table public.workspace_branding_settings enable row level security;
alter table public.workspace_marketplace_installs enable row level security;
alter table public.industry_templates enable row level security;
alter table public.stripe_customers enable row level security;
alter table public.stripe_subscriptions enable row level security;
alter table public.billing_invoices enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.workspace_credit_balances enable row level security;
alter table public.workspace_api_keys enable row level security;
alter table public.workspace_webhook_endpoints enable row level security;
alter table public.workspace_webhook_deliveries enable row level security;
alter table public.workspace_sso_configs enable row level security;
alter table public.workspace_scim_configs enable row level security;
alter table public.workspace_data_exports enable row level security;
alter table public.workspace_backup_runs enable row level security;
alter table public.workspace_restore_tests enable row level security;
alter table public.workspace_replay_operations enable row level security;
alter table public.workspace_monitoring_snapshots enable row level security;
alter table public.workspace_support_threads enable row level security;
alter table public.workspace_onboarding_steps enable row level security;
alter table public.marketplace_packages enable row level security;
alter table public.platform_release_notes enable row level security;

create policy "workspace_member_select_invitations"
on public.workspace_invitations
for select to authenticated
using (public.current_user_belongs_to_account(workspace_id) or public.is_super_admin());

create policy "workspace_admin_insert_invitations"
on public.workspace_invitations
for insert to authenticated
with check (public.has_workspace_role(workspace_id, 'ADMIN'));

create policy "workspace_member_manage_comments"
on public.workspace_collaboration_comments
for all to authenticated
using (public.current_user_belongs_to_account(workspace_id) or public.is_super_admin())
with check (public.current_user_belongs_to_account(workspace_id) or public.is_super_admin());

create policy "workspace_member_manage_tasks"
on public.workspace_tasks
for all to authenticated
using (public.current_user_belongs_to_account(workspace_id) or public.is_super_admin())
with check (public.current_user_belongs_to_account(workspace_id) or public.is_super_admin());

create policy "workspace_member_select_activity"
on public.workspace_activity_history
for select to authenticated
using (public.current_user_belongs_to_account(workspace_id) or public.is_super_admin());

create policy "workspace_admin_manage_routes"
on public.workspace_approval_routes
for all to authenticated
using (public.has_workspace_role(workspace_id, 'ADMIN'))
with check (public.has_workspace_role(workspace_id, 'ADMIN'));

create policy "workspace_member_manage_branding"
on public.workspace_branding_settings
for all to authenticated
using (public.current_user_belongs_to_account(workspace_id) or public.is_super_admin())
with check (public.current_user_belongs_to_account(workspace_id) or public.is_super_admin());

create policy "workspace_member_select_marketplace_packages"
on public.marketplace_packages
for select to authenticated
using (is_active or public.is_super_admin());

create policy "workspace_member_manage_marketplace_installs"
on public.workspace_marketplace_installs
for all to authenticated
using (public.current_user_belongs_to_account(workspace_id) or public.is_super_admin())
with check (public.current_user_belongs_to_account(workspace_id) or public.is_super_admin());

create policy "workspace_member_select_templates"
on public.industry_templates
for select to authenticated
using (is_active or public.is_super_admin());

create policy "workspace_member_select_billing"
on public.stripe_customers
for select to authenticated
using (public.current_user_belongs_to_account(workspace_id) or public.is_super_admin());

create policy "workspace_member_select_subscriptions"
on public.stripe_subscriptions
for select to authenticated
using (public.current_user_belongs_to_account(workspace_id) or public.is_super_admin());

create policy "workspace_member_select_invoices"
on public.billing_invoices
for select to authenticated
using (public.current_user_belongs_to_account(workspace_id) or public.is_super_admin());

create policy "workspace_member_select_credit_ledger"
on public.credit_ledger
for select to authenticated
using (public.current_user_belongs_to_account(workspace_id) or public.is_super_admin());

create policy "workspace_member_insert_credit_ledger"
on public.credit_ledger
for insert to authenticated
with check (public.current_user_belongs_to_account(workspace_id) or public.is_super_admin());

create policy "workspace_member_select_credit_balances"
on public.workspace_credit_balances
for select to authenticated
using (public.current_user_belongs_to_account(workspace_id) or public.is_super_admin());

create policy "workspace_admin_manage_api_keys"
on public.workspace_api_keys
for all to authenticated
using (public.has_workspace_role(workspace_id, 'ADMIN'))
with check (public.has_workspace_role(workspace_id, 'ADMIN'));

create policy "workspace_admin_manage_webhook_endpoints"
on public.workspace_webhook_endpoints
for all to authenticated
using (public.has_workspace_role(workspace_id, 'ADMIN'))
with check (public.has_workspace_role(workspace_id, 'ADMIN'));

create policy "workspace_member_select_webhook_deliveries"
on public.workspace_webhook_deliveries
for select to authenticated
using (public.current_user_belongs_to_account(workspace_id) or public.is_super_admin());

create policy "workspace_admin_manage_sso"
on public.workspace_sso_configs
for all to authenticated
using (public.has_workspace_role(workspace_id, 'ADMIN'))
with check (public.has_workspace_role(workspace_id, 'ADMIN'));

create policy "workspace_admin_manage_scim"
on public.workspace_scim_configs
for all to authenticated
using (public.has_workspace_role(workspace_id, 'ADMIN'))
with check (public.has_workspace_role(workspace_id, 'ADMIN'));

create policy "workspace_admin_manage_exports"
on public.workspace_data_exports
for all to authenticated
using (public.has_workspace_role(workspace_id, 'ADMIN'))
with check (public.has_workspace_role(workspace_id, 'ADMIN'));

create policy "workspace_admin_support_threads"
on public.workspace_support_threads
for all to authenticated
using (public.current_user_belongs_to_account(workspace_id) or public.is_super_admin())
with check (public.current_user_belongs_to_account(workspace_id) or public.is_super_admin());

create policy "workspace_member_manage_onboarding_steps"
on public.workspace_onboarding_steps
for all to authenticated
using (public.current_user_belongs_to_account(workspace_id) or public.is_super_admin())
with check (public.current_user_belongs_to_account(workspace_id) or public.is_super_admin());

create policy "super_admin_operational_tables"
on public.workspace_backup_runs
for all to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

create policy "super_admin_restore_tests"
on public.workspace_restore_tests
for all to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

create policy "super_admin_replay_operations"
on public.workspace_replay_operations
for all to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

create policy "super_admin_monitoring_snapshots"
on public.workspace_monitoring_snapshots
for all to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

create policy "release_notes_read"
on public.platform_release_notes
for select to authenticated
using (is_published = true or public.is_super_admin());

create policy "release_notes_admin_mutate"
on public.platform_release_notes
for all to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

grant select, insert, update, delete on public.workspace_invitations to authenticated;
grant select, insert, update, delete on public.workspace_collaboration_comments to authenticated;
grant select, insert, update, delete on public.workspace_tasks to authenticated;
grant select on public.workspace_activity_history to authenticated;
grant select, insert, update, delete on public.workspace_approval_routes to authenticated;
grant select, insert, update, delete on public.workspace_branding_settings to authenticated;
grant select on public.marketplace_packages to authenticated;
grant select, insert, update, delete on public.workspace_marketplace_installs to authenticated;
grant select on public.industry_templates to authenticated;
grant select on public.stripe_customers to authenticated;
grant select on public.stripe_subscriptions to authenticated;
grant select on public.billing_invoices to authenticated;
grant select, insert on public.credit_ledger to authenticated;
grant select on public.workspace_credit_balances to authenticated;
grant select, insert, update, delete on public.workspace_api_keys to authenticated;
grant select, insert, update, delete on public.workspace_webhook_endpoints to authenticated;
grant select on public.workspace_webhook_deliveries to authenticated;
grant select, insert, update, delete on public.workspace_sso_configs to authenticated;
grant select, insert, update, delete on public.workspace_scim_configs to authenticated;
grant select, insert, update, delete on public.workspace_data_exports to authenticated;
grant select, insert, update, delete on public.workspace_support_threads to authenticated;
grant select, insert, update, delete on public.workspace_onboarding_steps to authenticated;
grant select on public.platform_release_notes to authenticated;

grant all on public.workspace_invitations to service_role;
grant all on public.workspace_collaboration_comments to service_role;
grant all on public.workspace_tasks to service_role;
grant all on public.workspace_activity_history to service_role;
grant all on public.workspace_approval_routes to service_role;
grant all on public.workspace_branding_settings to service_role;
grant all on public.marketplace_packages to service_role;
grant all on public.workspace_marketplace_installs to service_role;
grant all on public.industry_templates to service_role;
grant all on public.stripe_customers to service_role;
grant all on public.stripe_subscriptions to service_role;
grant all on public.billing_invoices to service_role;
grant all on public.credit_ledger to service_role;
grant all on public.workspace_credit_balances to service_role;
grant all on public.workspace_api_keys to service_role;
grant all on public.workspace_webhook_endpoints to service_role;
grant all on public.workspace_webhook_deliveries to service_role;
grant all on public.workspace_sso_configs to service_role;
grant all on public.workspace_scim_configs to service_role;
grant all on public.workspace_data_exports to service_role;
grant all on public.workspace_backup_runs to service_role;
grant all on public.workspace_restore_tests to service_role;
grant all on public.workspace_replay_operations to service_role;
grant all on public.workspace_monitoring_snapshots to service_role;
grant all on public.workspace_support_threads to service_role;
grant all on public.workspace_onboarding_steps to service_role;
grant all on public.platform_release_notes to service_role;

drop trigger if exists workspace_invitations_set_updated_at on public.workspace_invitations;
create trigger workspace_invitations_set_updated_at
before update on public.workspace_invitations
for each row execute function public.set_updated_at();

drop trigger if exists workspace_comments_set_updated_at on public.workspace_collaboration_comments;
create trigger workspace_comments_set_updated_at
before update on public.workspace_collaboration_comments
for each row execute function public.set_updated_at();

drop trigger if exists workspace_tasks_set_updated_at on public.workspace_tasks;
create trigger workspace_tasks_set_updated_at
before update on public.workspace_tasks
for each row execute function public.set_updated_at();

drop trigger if exists workspace_approval_routes_set_updated_at on public.workspace_approval_routes;
create trigger workspace_approval_routes_set_updated_at
before update on public.workspace_approval_routes
for each row execute function public.set_updated_at();

drop trigger if exists workspace_branding_settings_set_updated_at on public.workspace_branding_settings;
create trigger workspace_branding_settings_set_updated_at
before update on public.workspace_branding_settings
for each row execute function public.set_updated_at();

drop trigger if exists marketplace_packages_set_updated_at on public.marketplace_packages;
create trigger marketplace_packages_set_updated_at
before update on public.marketplace_packages
for each row execute function public.set_updated_at();

drop trigger if exists workspace_marketplace_installs_set_updated_at on public.workspace_marketplace_installs;
create trigger workspace_marketplace_installs_set_updated_at
before update on public.workspace_marketplace_installs
for each row execute function public.set_updated_at();

drop trigger if exists industry_templates_set_updated_at on public.industry_templates;
create trigger industry_templates_set_updated_at
before update on public.industry_templates
for each row execute function public.set_updated_at();

drop trigger if exists stripe_customers_set_updated_at on public.stripe_customers;
create trigger stripe_customers_set_updated_at
before update on public.stripe_customers
for each row execute function public.set_updated_at();

drop trigger if exists stripe_subscriptions_set_updated_at on public.stripe_subscriptions;
create trigger stripe_subscriptions_set_updated_at
before update on public.stripe_subscriptions
for each row execute function public.set_updated_at();

drop trigger if exists billing_invoices_set_updated_at on public.billing_invoices;
create trigger billing_invoices_set_updated_at
before update on public.billing_invoices
for each row execute function public.set_updated_at();

drop trigger if exists workspace_credit_balances_set_updated_at on public.workspace_credit_balances;
create trigger workspace_credit_balances_set_updated_at
before update on public.workspace_credit_balances
for each row execute function public.set_updated_at();

drop trigger if exists workspace_api_keys_set_updated_at on public.workspace_api_keys;
create trigger workspace_api_keys_set_updated_at
before update on public.workspace_api_keys
for each row execute function public.set_updated_at();

drop trigger if exists workspace_webhook_endpoints_set_updated_at on public.workspace_webhook_endpoints;
create trigger workspace_webhook_endpoints_set_updated_at
before update on public.workspace_webhook_endpoints
for each row execute function public.set_updated_at();

drop trigger if exists workspace_webhook_deliveries_set_updated_at on public.workspace_webhook_deliveries;
create trigger workspace_webhook_deliveries_set_updated_at
before update on public.workspace_webhook_deliveries
for each row execute function public.set_updated_at();

drop trigger if exists workspace_sso_configs_set_updated_at on public.workspace_sso_configs;
create trigger workspace_sso_configs_set_updated_at
before update on public.workspace_sso_configs
for each row execute function public.set_updated_at();

drop trigger if exists workspace_scim_configs_set_updated_at on public.workspace_scim_configs;
create trigger workspace_scim_configs_set_updated_at
before update on public.workspace_scim_configs
for each row execute function public.set_updated_at();

drop trigger if exists workspace_data_exports_set_updated_at on public.workspace_data_exports;
create trigger workspace_data_exports_set_updated_at
before update on public.workspace_data_exports
for each row execute function public.set_updated_at();

drop trigger if exists workspace_replay_operations_set_updated_at on public.workspace_replay_operations;
create trigger workspace_replay_operations_set_updated_at
before update on public.workspace_replay_operations
for each row execute function public.set_updated_at();

drop trigger if exists workspace_support_threads_set_updated_at on public.workspace_support_threads;
create trigger workspace_support_threads_set_updated_at
before update on public.workspace_support_threads
for each row execute function public.set_updated_at();

drop trigger if exists workspace_onboarding_steps_set_updated_at on public.workspace_onboarding_steps;
create trigger workspace_onboarding_steps_set_updated_at
before update on public.workspace_onboarding_steps
for each row execute function public.set_updated_at();

drop trigger if exists platform_release_notes_set_updated_at on public.platform_release_notes;
create trigger platform_release_notes_set_updated_at
before update on public.platform_release_notes
for each row execute function public.set_updated_at();

insert into public.pricing_plans (
  key,
  name,
  description,
  monthly_price_cents,
  annual_price_cents,
  currency,
  is_public,
  is_active,
  lifecycle_state,
  sort_order,
  metadata
)
values
  ('free_trial', 'Free Trial', 'Limited trial workspace for launch onboarding.', 0, 0, 'USD', true, true, 'active', 10, '{}'::jsonb),
  ('starter', 'Starter', 'Entry plan for small teams.', 2900, 29000, 'USD', true, true, 'active', 20, '{}'::jsonb),
  ('professional', 'Professional', 'Growth plan for teams running campaigns.', 7900, 79000, 'USD', true, true, 'active', 30, '{}'::jsonb),
  ('business', 'Business', 'Scale plan with advanced automation controls.', 19900, 199000, 'USD', true, true, 'active', 40, '{}'::jsonb),
  ('enterprise', 'Enterprise', 'Enterprise governance, SSO, and support.', 49900, 499000, 'USD', true, true, 'active', 50, '{}'::jsonb)
on conflict (key) do update
set
  name = excluded.name,
  description = excluded.description,
  monthly_price_cents = excluded.monthly_price_cents,
  annual_price_cents = excluded.annual_price_cents,
  is_public = excluded.is_public,
  is_active = excluded.is_active,
  lifecycle_state = excluded.lifecycle_state,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.industry_templates (industry_key, display_name, description, seed_payload)
values
  ('restaurants', 'Restaurants', 'Daily specials, social promos, and loyalty cadence.', '{}'::jsonb),
  ('cannabis', 'Cannabis', 'Compliance-forward campaign templates for dispensaries and brands.', '{}'::jsonb),
  ('ecommerce', 'E-commerce', 'Product launch and retention template bundles.', '{}'::jsonb),
  ('amazon', 'Amazon', 'Amazon listing, ads, and conversion template bundles.', '{}'::jsonb),
  ('real_estate', 'Real Estate', 'Listing promotion and lead nurture workflows.', '{}'::jsonb),
  ('fitness', 'Fitness', 'Class promos and recurring member engagement packs.', '{}'::jsonb),
  ('healthcare', 'Healthcare', 'Educational and appointment-focused templates.', '{}'::jsonb),
  ('professional_services', 'Professional Services', 'Consulting and service-offer campaign templates.', '{}'::jsonb),
  ('automotive', 'Automotive', 'Dealer campaigns and maintenance engagement templates.', '{}'::jsonb),
  ('nonprofits', 'Nonprofits', 'Donor outreach and fundraising campaign templates.', '{}'::jsonb)
on conflict (industry_key) do update
set
  display_name = excluded.display_name,
  description = excluded.description,
  seed_payload = excluded.seed_payload,
  updated_at = now();

insert into public.marketplace_packages (package_key, package_type, name, summary, version, is_active, metadata)
values
  ('agent_growth_assistant', 'AI_AGENT', 'Growth Assistant', 'AI agent focused on campaign growth tasks.', '1.0.0', true, '{}'::jsonb),
  ('prompt_pack_launch', 'PROMPT_PACK', 'Launch Prompt Pack', 'Prompt bundle for launch readiness workflows.', '1.0.0', true, '{}'::jsonb),
  ('campaign_pack_retargeting', 'CAMPAIGN_PACK', 'Retargeting Campaign Pack', 'Retargeting playbook and campaign templates.', '1.0.0', true, '{}'::jsonb),
  ('template_pack_restaurants', 'INDUSTRY_PACK', 'Restaurant Pack', 'Restaurant-specific templates and campaign ideas.', '1.0.0', true, '{}'::jsonb)
on conflict (package_key) do update
set
  package_type = excluded.package_type,
  name = excluded.name,
  summary = excluded.summary,
  version = excluded.version,
  is_active = excluded.is_active,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.system_settings (key, value, category, description, is_secret)
values
  ('stripe_publishable_key', 'null'::jsonb, 'billing', 'Stripe publishable key for customer checkout and portal.', true),
  ('stripe_secret_key', 'null'::jsonb, 'billing', 'Stripe secret key for server-side subscription operations.', true),
  ('stripe_webhook_secret', 'null'::jsonb, 'billing', 'Stripe webhook signing secret.', true),
  ('saas_beta_launch_ready', 'false'::jsonb, 'platform', 'Set true only after launch checklist completion.', false),
  ('workspace_default_role', '"VIEWER"'::jsonb, 'workspace', 'Default role assigned to invited users.', false),
  ('support_chat_provider', '"none"'::jsonb, 'support', 'Support chat integration provider key.', false)
on conflict (key) do update
set
  description = excluded.description,
  is_secret = excluded.is_secret,
  category = excluded.category,
  updated_at = now();

commit;
