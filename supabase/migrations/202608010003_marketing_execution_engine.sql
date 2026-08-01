begin;

create table if not exists public.marketing_workflows (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  recommendation_id text,
  campaign_id uuid references public.campaigns(id) on delete set null,
  workflow_type text not null check (workflow_type in (
    'campaign',
    'content_execution',
    'approval_batch',
    'publishing_batch',
    'analytics_collection',
    'learning_cycle'
  )),
  state text not null default 'NOT_STARTED' check (state in (
    'NOT_STARTED',
    'IN_PROGRESS',
    'BLOCKED',
    'AWAITING_APPROVAL',
    'APPROVED',
    'SCHEDULED',
    'PUBLISHING',
    'PUBLISHED',
    'COLLECTING_RESULTS',
    'LEARNING',
    'COMPLETED',
    'FAILED',
    'CANCELLED'
  )),
  autonomy_level smallint not null default 3 check (autonomy_level between 1 and 5),
  retry_count integer not null default 0,
  max_retries integer not null default 3,
  blocked_reason text,
  failure_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketing_workflow_steps (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.marketing_workflows(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  step_key text not null,
  title text not null,
  state text not null default 'NOT_STARTED' check (state in (
    'NOT_STARTED',
    'IN_PROGRESS',
    'BLOCKED',
    'AWAITING_APPROVAL',
    'APPROVED',
    'SCHEDULED',
    'PUBLISHING',
    'PUBLISHED',
    'COLLECTING_RESULTS',
    'LEARNING',
    'COMPLETED',
    'FAILED',
    'CANCELLED'
  )),
  depends_on text[] not null default '{}'::text[],
  retry_count integer not null default 0,
  max_retries integer not null default 2,
  target_record_type text,
  target_record_id text,
  assigned_agent text,
  comment text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workflow_id, step_key)
);

create table if not exists public.marketing_approval_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  workflow_id uuid references public.marketing_workflows(id) on delete cascade,
  step_id uuid references public.marketing_workflow_steps(id) on delete set null,
  item_type text not null check (item_type in ('draft', 'campaign', 'schedule', 'publish', 'recommendation')),
  title text not null,
  status text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED', 'EDIT_REQUESTED', 'CANCELLED')),
  requires_comment boolean not null default false,
  comment text,
  target_record_type text,
  target_record_id text,
  requested_by uuid references auth.users(id) on delete set null,
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketing_execution_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  workflow_id uuid references public.marketing_workflows(id) on delete cascade,
  step_id uuid references public.marketing_workflow_steps(id) on delete set null,
  approval_item_id uuid references public.marketing_approval_items(id) on delete set null,
  event_type text not null,
  status text not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  agent text,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.marketing_forecasts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  workflow_id uuid references public.marketing_workflows(id) on delete set null,
  forecast_type text not null check (forecast_type in (
    'content_readiness',
    'publishing_capacity',
    'campaign_completion',
    'lead_generation',
    'marketing_workload',
    'approval_backlog',
    'confidence'
  )),
  measured_value numeric(18, 4),
  estimated_value numeric(18, 4),
  confidence numeric(4, 3) not null default 0.5 check (confidence >= 0 and confidence <= 1),
  note text not null,
  measured boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.marketing_notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  channel text not null check (channel in ('in_app', 'email', 'mobile_future')),
  trigger_type text not null check (trigger_type in (
    'approval_required',
    'publishing_failed',
    'campaign_completed',
    'analytics_available',
    'major_opportunity',
    'major_risk'
  )),
  title text not null,
  body text not null,
  status text not null default 'PENDING' check (status in ('PENDING', 'SENT', 'FAILED', 'DISMISSED')),
  preference_key text,
  sent_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketing_ai_health_metrics (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  metric_date date not null,
  recommendation_acceptance_rate numeric(6, 3) not null default 0,
  approval_rate numeric(6, 3) not null default 0,
  execution_success_rate numeric(6, 3) not null default 0,
  publishing_success_rate numeric(6, 3) not null default 0,
  forecast_accuracy_rate numeric(6, 3) not null default 0,
  user_edits_before_approval_rate numeric(6, 3) not null default 0,
  campaign_completion_rate numeric(6, 3) not null default 0,
  learning_improvement_rate numeric(6, 3) not null default 0,
  created_at timestamptz not null default now(),
  unique (workspace_id, metric_date)
);

alter table public.workspace_marketing_settings
  add column if not exists autonomy_level smallint not null default 3
    check (autonomy_level between 1 and 5);

create index if not exists marketing_workflows_workspace_state_idx
  on public.marketing_workflows(workspace_id, state, updated_at desc);
create index if not exists marketing_workflow_steps_workflow_state_idx
  on public.marketing_workflow_steps(workflow_id, state, updated_at desc);
create index if not exists marketing_approval_items_workspace_status_idx
  on public.marketing_approval_items(workspace_id, status, created_at desc);
create index if not exists marketing_execution_events_workspace_created_idx
  on public.marketing_execution_events(workspace_id, created_at desc);
create index if not exists marketing_notifications_workspace_status_idx
  on public.marketing_notifications(workspace_id, status, created_at desc);
create index if not exists marketing_forecasts_workspace_type_idx
  on public.marketing_forecasts(workspace_id, forecast_type, created_at desc);
create index if not exists marketing_ai_health_metrics_workspace_date_idx
  on public.marketing_ai_health_metrics(workspace_id, metric_date desc);

alter table public.marketing_workflows enable row level security;
alter table public.marketing_workflow_steps enable row level security;
alter table public.marketing_approval_items enable row level security;
alter table public.marketing_execution_events enable row level security;
alter table public.marketing_forecasts enable row level security;
alter table public.marketing_notifications enable row level security;
alter table public.marketing_ai_health_metrics enable row level security;

drop policy if exists "marketing_workflows_select_member_or_super_admin" on public.marketing_workflows;
create policy "marketing_workflows_select_member_or_super_admin"
on public.marketing_workflows
for select to authenticated
using (public.is_super_admin() or public.current_user_belongs_to_account(workspace_id));

drop policy if exists "marketing_workflows_insert_member_or_super_admin" on public.marketing_workflows;
create policy "marketing_workflows_insert_member_or_super_admin"
on public.marketing_workflows
for insert to authenticated
with check (public.is_super_admin() or public.current_user_belongs_to_account(workspace_id));

drop policy if exists "marketing_workflows_update_member_or_super_admin" on public.marketing_workflows;
create policy "marketing_workflows_update_member_or_super_admin"
on public.marketing_workflows
for update to authenticated
using (public.is_super_admin() or public.current_user_belongs_to_account(workspace_id))
with check (public.is_super_admin() or public.current_user_belongs_to_account(workspace_id));

drop policy if exists "marketing_workflow_steps_select_member_or_super_admin" on public.marketing_workflow_steps;
create policy "marketing_workflow_steps_select_member_or_super_admin"
on public.marketing_workflow_steps
for select to authenticated
using (public.is_super_admin() or public.current_user_belongs_to_account(workspace_id));

drop policy if exists "marketing_workflow_steps_insert_member_or_super_admin" on public.marketing_workflow_steps;
create policy "marketing_workflow_steps_insert_member_or_super_admin"
on public.marketing_workflow_steps
for insert to authenticated
with check (public.is_super_admin() or public.current_user_belongs_to_account(workspace_id));

drop policy if exists "marketing_workflow_steps_update_member_or_super_admin" on public.marketing_workflow_steps;
create policy "marketing_workflow_steps_update_member_or_super_admin"
on public.marketing_workflow_steps
for update to authenticated
using (public.is_super_admin() or public.current_user_belongs_to_account(workspace_id))
with check (public.is_super_admin() or public.current_user_belongs_to_account(workspace_id));

drop policy if exists "marketing_approval_items_select_member_or_super_admin" on public.marketing_approval_items;
create policy "marketing_approval_items_select_member_or_super_admin"
on public.marketing_approval_items
for select to authenticated
using (public.is_super_admin() or public.current_user_belongs_to_account(workspace_id));

drop policy if exists "marketing_approval_items_insert_member_or_super_admin" on public.marketing_approval_items;
create policy "marketing_approval_items_insert_member_or_super_admin"
on public.marketing_approval_items
for insert to authenticated
with check (public.is_super_admin() or public.current_user_belongs_to_account(workspace_id));

drop policy if exists "marketing_approval_items_update_member_or_super_admin" on public.marketing_approval_items;
create policy "marketing_approval_items_update_member_or_super_admin"
on public.marketing_approval_items
for update to authenticated
using (public.is_super_admin() or public.current_user_belongs_to_account(workspace_id))
with check (public.is_super_admin() or public.current_user_belongs_to_account(workspace_id));

drop policy if exists "marketing_execution_events_select_member_or_super_admin" on public.marketing_execution_events;
create policy "marketing_execution_events_select_member_or_super_admin"
on public.marketing_execution_events
for select to authenticated
using (public.is_super_admin() or public.current_user_belongs_to_account(workspace_id));

drop policy if exists "marketing_execution_events_insert_member_or_super_admin" on public.marketing_execution_events;
create policy "marketing_execution_events_insert_member_or_super_admin"
on public.marketing_execution_events
for insert to authenticated
with check (public.is_super_admin() or public.current_user_belongs_to_account(workspace_id));

drop policy if exists "marketing_forecasts_select_member_or_super_admin" on public.marketing_forecasts;
create policy "marketing_forecasts_select_member_or_super_admin"
on public.marketing_forecasts
for select to authenticated
using (public.is_super_admin() or public.current_user_belongs_to_account(workspace_id));

drop policy if exists "marketing_forecasts_insert_member_or_super_admin" on public.marketing_forecasts;
create policy "marketing_forecasts_insert_member_or_super_admin"
on public.marketing_forecasts
for insert to authenticated
with check (public.is_super_admin() or public.current_user_belongs_to_account(workspace_id));

drop policy if exists "marketing_notifications_select_member_or_super_admin" on public.marketing_notifications;
create policy "marketing_notifications_select_member_or_super_admin"
on public.marketing_notifications
for select to authenticated
using (public.is_super_admin() or public.current_user_belongs_to_account(workspace_id));

drop policy if exists "marketing_notifications_insert_member_or_super_admin" on public.marketing_notifications;
create policy "marketing_notifications_insert_member_or_super_admin"
on public.marketing_notifications
for insert to authenticated
with check (public.is_super_admin() or public.current_user_belongs_to_account(workspace_id));

drop policy if exists "marketing_notifications_update_member_or_super_admin" on public.marketing_notifications;
create policy "marketing_notifications_update_member_or_super_admin"
on public.marketing_notifications
for update to authenticated
using (public.is_super_admin() or public.current_user_belongs_to_account(workspace_id))
with check (public.is_super_admin() or public.current_user_belongs_to_account(workspace_id));

drop policy if exists "marketing_ai_health_metrics_select_member_or_super_admin" on public.marketing_ai_health_metrics;
create policy "marketing_ai_health_metrics_select_member_or_super_admin"
on public.marketing_ai_health_metrics
for select to authenticated
using (public.is_super_admin() or public.current_user_belongs_to_account(workspace_id));

drop policy if exists "marketing_ai_health_metrics_insert_member_or_super_admin" on public.marketing_ai_health_metrics;
create policy "marketing_ai_health_metrics_insert_member_or_super_admin"
on public.marketing_ai_health_metrics
for insert to authenticated
with check (public.is_super_admin() or public.current_user_belongs_to_account(workspace_id));

grant select, insert, update on public.marketing_workflows to authenticated;
grant select, insert, update on public.marketing_workflow_steps to authenticated;
grant select, insert, update on public.marketing_approval_items to authenticated;
grant select, insert on public.marketing_execution_events to authenticated;
grant select, insert on public.marketing_forecasts to authenticated;
grant select, insert, update on public.marketing_notifications to authenticated;
grant select, insert on public.marketing_ai_health_metrics to authenticated;

grant all on public.marketing_workflows to service_role;
grant all on public.marketing_workflow_steps to service_role;
grant all on public.marketing_approval_items to service_role;
grant all on public.marketing_execution_events to service_role;
grant all on public.marketing_forecasts to service_role;
grant all on public.marketing_notifications to service_role;
grant all on public.marketing_ai_health_metrics to service_role;

drop trigger if exists marketing_workflows_set_updated_at on public.marketing_workflows;
create trigger marketing_workflows_set_updated_at
before update on public.marketing_workflows
for each row execute function public.set_updated_at();

drop trigger if exists marketing_workflow_steps_set_updated_at on public.marketing_workflow_steps;
create trigger marketing_workflow_steps_set_updated_at
before update on public.marketing_workflow_steps
for each row execute function public.set_updated_at();

drop trigger if exists marketing_approval_items_set_updated_at on public.marketing_approval_items;
create trigger marketing_approval_items_set_updated_at
before update on public.marketing_approval_items
for each row execute function public.set_updated_at();

drop trigger if exists marketing_notifications_set_updated_at on public.marketing_notifications;
create trigger marketing_notifications_set_updated_at
before update on public.marketing_notifications
for each row execute function public.set_updated_at();

commit;
