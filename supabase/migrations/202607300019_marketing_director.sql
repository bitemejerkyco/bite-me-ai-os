begin;

create table if not exists public.workspace_marketing_settings (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  operating_mode text not null default 'advisor'
    check (operating_mode in ('advisor', 'copilot', 'autopilot')),
  approval_required_for_content boolean not null default true,
  approval_required_for_scheduling boolean not null default true,
  approval_required_for_budget_changes boolean not null default true,
  approval_required_for_publishing boolean not null default true,
  daily_brief_enabled boolean not null default true,
  daily_brief_time time not null default '08:30'::time,
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketing_score_snapshots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  generated_by uuid references auth.users(id) on delete set null,
  score numeric(5, 2) not null check (score >= 0 and score <= 100),
  score_version text not null,
  category_scores jsonb not null default '[]'::jsonb,
  data_coverage jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.marketing_director_briefs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brief_date date not null,
  metrics jsonb not null default '[]'::jsonb,
  priority_actions jsonb not null default '[]'::jsonb,
  recommendations jsonb not null default '[]'::jsonb,
  confidence numeric(4, 3) not null default 0 check (confidence >= 0 and confidence <= 1),
  data_coverage jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, brief_date)
);

create table if not exists public.marketing_director_commands (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  prompt text not null check (char_length(trim(prompt)) between 1 and 500),
  mode text not null check (mode in ('advisor', 'copilot', 'autopilot')),
  detected_intent text not null,
  proposal jsonb not null default '{}'::jsonb,
  status text not null default 'PROPOSED'
    check (status in ('PROPOSED', 'APPROVED', 'REJECTED', 'EXECUTED', 'FAILED')),
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  executed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists marketing_score_snapshots_workspace_generated_idx
  on public.marketing_score_snapshots(workspace_id, generated_at desc);
create index if not exists marketing_director_briefs_workspace_date_idx
  on public.marketing_director_briefs(workspace_id, brief_date desc);
create index if not exists marketing_director_commands_workspace_created_idx
  on public.marketing_director_commands(workspace_id, created_at desc);
create index if not exists marketing_director_commands_actor_created_idx
  on public.marketing_director_commands(actor_user_id, created_at desc);

insert into public.feature_flags (
  key,
  display_name,
  description,
  enabled,
  rollout_percentage,
  allowed_account_types,
  allowed_plan_keys,
  metadata
)
values (
  'marketing_director_autopilot',
  'Marketing Director Autopilot',
  'Controls staged rollout for unattended Marketing Director automation.',
  false,
  0,
  '[]'::jsonb,
  '[]'::jsonb,
  '{"stage":"beta","owner":"platform"}'::jsonb
)
on conflict (key) do update
set
  display_name = excluded.display_name,
  description = excluded.description,
  metadata = excluded.metadata;

alter table public.workspace_marketing_settings enable row level security;
alter table public.marketing_score_snapshots enable row level security;
alter table public.marketing_director_briefs enable row level security;
alter table public.marketing_director_commands enable row level security;

drop policy if exists "workspace_marketing_settings_select_member_or_super_admin" on public.workspace_marketing_settings;
create policy "workspace_marketing_settings_select_member_or_super_admin"
on public.workspace_marketing_settings
for select to authenticated
using (
  public.is_super_admin() or public.current_user_belongs_to_account(workspace_id)
);

drop policy if exists "workspace_marketing_settings_insert_member_or_super_admin" on public.workspace_marketing_settings;
create policy "workspace_marketing_settings_insert_member_or_super_admin"
on public.workspace_marketing_settings
for insert to authenticated
with check (
  public.is_super_admin() or public.current_user_belongs_to_account(workspace_id)
);

drop policy if exists "workspace_marketing_settings_update_member_or_super_admin" on public.workspace_marketing_settings;
create policy "workspace_marketing_settings_update_member_or_super_admin"
on public.workspace_marketing_settings
for update to authenticated
using (
  public.is_super_admin() or public.current_user_belongs_to_account(workspace_id)
)
with check (
  public.is_super_admin() or public.current_user_belongs_to_account(workspace_id)
);

drop policy if exists "marketing_score_snapshots_select_member_or_super_admin" on public.marketing_score_snapshots;
create policy "marketing_score_snapshots_select_member_or_super_admin"
on public.marketing_score_snapshots
for select to authenticated
using (
  public.is_super_admin() or public.current_user_belongs_to_account(workspace_id)
);

drop policy if exists "marketing_score_snapshots_insert_member_or_super_admin" on public.marketing_score_snapshots;
create policy "marketing_score_snapshots_insert_member_or_super_admin"
on public.marketing_score_snapshots
for insert to authenticated
with check (
  public.is_super_admin() or public.current_user_belongs_to_account(workspace_id)
);

drop policy if exists "marketing_director_briefs_select_member_or_super_admin" on public.marketing_director_briefs;
create policy "marketing_director_briefs_select_member_or_super_admin"
on public.marketing_director_briefs
for select to authenticated
using (
  public.is_super_admin() or public.current_user_belongs_to_account(workspace_id)
);

drop policy if exists "marketing_director_briefs_insert_member_or_super_admin" on public.marketing_director_briefs;
create policy "marketing_director_briefs_insert_member_or_super_admin"
on public.marketing_director_briefs
for insert to authenticated
with check (
  public.is_super_admin() or public.current_user_belongs_to_account(workspace_id)
);

drop policy if exists "marketing_director_briefs_update_member_or_super_admin" on public.marketing_director_briefs;
create policy "marketing_director_briefs_update_member_or_super_admin"
on public.marketing_director_briefs
for update to authenticated
using (
  public.is_super_admin() or public.current_user_belongs_to_account(workspace_id)
)
with check (
  public.is_super_admin() or public.current_user_belongs_to_account(workspace_id)
);

drop policy if exists "marketing_director_commands_select_member_or_super_admin" on public.marketing_director_commands;
create policy "marketing_director_commands_select_member_or_super_admin"
on public.marketing_director_commands
for select to authenticated
using (
  public.is_super_admin() or public.current_user_belongs_to_account(workspace_id)
);

drop policy if exists "marketing_director_commands_insert_actor_member_or_super_admin" on public.marketing_director_commands;
create policy "marketing_director_commands_insert_actor_member_or_super_admin"
on public.marketing_director_commands
for insert to authenticated
with check (
  actor_user_id = (select auth.uid())
  and (public.is_super_admin() or public.current_user_belongs_to_account(workspace_id))
);

drop policy if exists "marketing_director_commands_update_actor_member_or_super_admin" on public.marketing_director_commands;
create policy "marketing_director_commands_update_actor_member_or_super_admin"
on public.marketing_director_commands
for update to authenticated
using (
  public.is_super_admin()
  or (
    actor_user_id = (select auth.uid())
    and public.current_user_belongs_to_account(workspace_id)
  )
)
with check (
  public.is_super_admin()
  or (
    actor_user_id = (select auth.uid())
    and public.current_user_belongs_to_account(workspace_id)
  )
);

drop trigger if exists workspace_marketing_settings_set_updated_at on public.workspace_marketing_settings;
create trigger workspace_marketing_settings_set_updated_at
before update on public.workspace_marketing_settings
for each row execute function public.set_updated_at();

drop trigger if exists marketing_director_briefs_set_updated_at on public.marketing_director_briefs;
create trigger marketing_director_briefs_set_updated_at
before update on public.marketing_director_briefs
for each row execute function public.set_updated_at();

drop trigger if exists marketing_director_commands_set_updated_at on public.marketing_director_commands;
create trigger marketing_director_commands_set_updated_at
before update on public.marketing_director_commands
for each row execute function public.set_updated_at();

grant select, insert, update on public.workspace_marketing_settings to authenticated;
grant select, insert on public.marketing_score_snapshots to authenticated;
grant select, insert, update on public.marketing_director_briefs to authenticated;
grant select, insert, update on public.marketing_director_commands to authenticated;

grant all on public.workspace_marketing_settings to service_role;
grant all on public.marketing_score_snapshots to service_role;
grant all on public.marketing_director_briefs to service_role;
grant all on public.marketing_director_commands to service_role;

commit;
