begin;

create table if not exists public.account_types (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (char_length(trim(key)) between 2 and 64),
  display_name text not null check (char_length(trim(display_name)) between 2 and 120),
  description text,
  is_internal boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pricing_plans (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (char_length(trim(key)) between 2 and 64),
  name text not null check (char_length(trim(name)) between 2 and 120),
  description text,
  monthly_price_cents integer not null default 0 check (monthly_price_cents >= 0),
  annual_price_cents integer not null default 0 check (annual_price_cents >= 0),
  currency text not null default 'USD' check (char_length(trim(currency)) between 3 and 8),
  stripe_monthly_price_id text,
  stripe_annual_price_id text,
  is_public boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.plan_entitlements (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.pricing_plans(id) on delete cascade,
  entitlement_key text not null check (entitlement_key in (
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
    'can_use_priority_support'
  )),
  value jsonb not null default 'null'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_id, entitlement_key)
);

alter table public.workspaces
  add column if not exists account_type_id uuid references public.account_types(id),
  add column if not exists pricing_plan_id uuid references public.pricing_plans(id),
  add column if not exists billing_status text not null default 'UNCONFIGURED'
    check (billing_status in ('UNCONFIGURED', 'TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'SUSPENDED')),
  add column if not exists billing_exempt boolean not null default false,
  add column if not exists trial_ends_at timestamptz,
  add column if not exists suspended_at timestamptz,
  add column if not exists suspension_reason text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.workspace_memberships
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists status text not null default 'ACTIVE'
    check (status in ('INVITED', 'ACTIVE', 'SUSPENDED', 'REMOVED')),
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists workspace_memberships_id_key
  on public.workspace_memberships(id);

create table if not exists public.account_entitlement_overrides (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.workspaces(id) on delete cascade,
  entitlement_key text not null check (entitlement_key in (
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
    'can_use_priority_support'
  )),
  override_mode text not null default 'use_plan'
    check (override_mode in ('use_plan', 'custom', 'unlimited', 'disabled')),
  value jsonb not null default 'null'::jsonb,
  reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, entitlement_key)
);

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  target_account_id uuid references public.workspaces(id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id text,
  previous_value jsonb,
  new_value jsonb,
  reason text,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists pricing_plans_public_sort_idx
  on public.pricing_plans(is_public, is_active, sort_order asc, created_at asc);
create index if not exists plan_entitlements_plan_idx
  on public.plan_entitlements(plan_id);
create index if not exists workspaces_pricing_plan_idx
  on public.workspaces(pricing_plan_id);
create index if not exists workspaces_account_type_idx
  on public.workspaces(account_type_id);
create index if not exists workspaces_billing_status_idx
  on public.workspaces(billing_status);
create index if not exists account_entitlement_overrides_account_idx
  on public.account_entitlement_overrides(account_id);
create index if not exists admin_audit_logs_created_idx
  on public.admin_audit_logs(created_at desc);
create index if not exists admin_audit_logs_target_account_idx
  on public.admin_audit_logs(target_account_id, created_at desc);

drop trigger if exists account_types_set_updated_at on public.account_types;
create trigger account_types_set_updated_at
before update on public.account_types
for each row execute function public.set_updated_at();

drop trigger if exists pricing_plans_set_updated_at on public.pricing_plans;
create trigger pricing_plans_set_updated_at
before update on public.pricing_plans
for each row execute function public.set_updated_at();

drop trigger if exists plan_entitlements_set_updated_at on public.plan_entitlements;
create trigger plan_entitlements_set_updated_at
before update on public.plan_entitlements
for each row execute function public.set_updated_at();

drop trigger if exists workspace_memberships_set_updated_at on public.workspace_memberships;
create trigger workspace_memberships_set_updated_at
before update on public.workspace_memberships
for each row execute function public.set_updated_at();

drop trigger if exists account_entitlement_overrides_set_updated_at on public.account_entitlement_overrides;
create trigger account_entitlement_overrides_set_updated_at
before update on public.account_entitlement_overrides
for each row execute function public.set_updated_at();

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.user_id = (select auth.uid())
      and p.system_role = 'SUPER_ADMIN'
  );
$$;

create or replace function public.current_user_belongs_to_account(target_account_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_workspace_member(target_account_id);
$$;

create or replace function public.my_video_billing_exempt(
  target_workspace_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_super_admin()
    or exists (
      select 1
      from public.workspaces w
      where w.id = target_workspace_id
        and w.billing_exempt = true
    )
    or exists (
      select 1
      from public.workspace_memberships m
      where m.workspace_id = target_workspace_id
        and m.user_id = (select auth.uid())
        and (m.billing_exempt or m.role = 'SUPER_ADMIN')
    );
$$;

revoke all on function public.is_super_admin() from public, anon;
revoke all on function public.current_user_belongs_to_account(uuid) from public, anon;
grant execute on function public.is_super_admin() to authenticated, service_role;
grant execute on function public.current_user_belongs_to_account(uuid) to authenticated, service_role;
grant execute on function public.my_video_billing_exempt(uuid) to authenticated, service_role;

alter table public.account_types enable row level security;
alter table public.pricing_plans enable row level security;
alter table public.plan_entitlements enable row level security;
alter table public.account_entitlement_overrides enable row level security;
alter table public.admin_audit_logs enable row level security;

drop policy if exists "account_types_select_super_admin" on public.account_types;
create policy "account_types_select_super_admin" on public.account_types
for select to authenticated using (public.is_super_admin());

drop policy if exists "pricing_plans_public_select" on public.pricing_plans;
create policy "pricing_plans_public_select" on public.pricing_plans
for select to anon, authenticated using (is_public and is_active);

drop policy if exists "pricing_plans_select_super_admin" on public.pricing_plans;
create policy "pricing_plans_select_super_admin" on public.pricing_plans
for select to authenticated using (public.is_super_admin());

drop policy if exists "plan_entitlements_public_select" on public.plan_entitlements;
create policy "plan_entitlements_public_select" on public.plan_entitlements
for select to anon, authenticated using (
  exists (
    select 1
    from public.pricing_plans p
    where p.id = plan_id
      and p.is_public = true
      and p.is_active = true
  )
);

drop policy if exists "plan_entitlements_select_super_admin" on public.plan_entitlements;
create policy "plan_entitlements_select_super_admin" on public.plan_entitlements
for select to authenticated using (public.is_super_admin());

drop policy if exists "workspaces_select_super_admin" on public.workspaces;
create policy "workspaces_select_super_admin" on public.workspaces
for select to authenticated using (public.is_super_admin());

drop policy if exists "workspaces_update_super_admin" on public.workspaces;
create policy "workspaces_update_super_admin" on public.workspaces
for update to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

drop policy if exists "workspace_memberships_select_super_admin" on public.workspace_memberships;
create policy "workspace_memberships_select_super_admin" on public.workspace_memberships
for select to authenticated using (public.is_super_admin());

drop policy if exists "workspace_memberships_insert_super_admin" on public.workspace_memberships;
create policy "workspace_memberships_insert_super_admin" on public.workspace_memberships
for insert to authenticated with check (public.is_super_admin());

drop policy if exists "workspace_memberships_update_super_admin" on public.workspace_memberships;
create policy "workspace_memberships_update_super_admin" on public.workspace_memberships
for update to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

drop policy if exists "workspace_memberships_delete_super_admin" on public.workspace_memberships;
create policy "workspace_memberships_delete_super_admin" on public.workspace_memberships
for delete to authenticated using (public.is_super_admin());

drop policy if exists "account_entitlement_overrides_select_account_or_super_admin" on public.account_entitlement_overrides;
create policy "account_entitlement_overrides_select_account_or_super_admin" on public.account_entitlement_overrides
for select to authenticated using (
  public.is_super_admin() or public.current_user_belongs_to_account(account_id)
);

drop policy if exists "account_entitlement_overrides_insert_super_admin" on public.account_entitlement_overrides;
create policy "account_entitlement_overrides_insert_super_admin" on public.account_entitlement_overrides
for insert to authenticated with check (
  public.is_super_admin()
  and created_by = (select auth.uid())
);

drop policy if exists "account_entitlement_overrides_update_super_admin" on public.account_entitlement_overrides;
create policy "account_entitlement_overrides_update_super_admin" on public.account_entitlement_overrides
for update to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

drop policy if exists "account_entitlement_overrides_delete_super_admin" on public.account_entitlement_overrides;
create policy "account_entitlement_overrides_delete_super_admin" on public.account_entitlement_overrides
for delete to authenticated using (public.is_super_admin());

drop policy if exists "admin_audit_logs_select_super_admin" on public.admin_audit_logs;
create policy "admin_audit_logs_select_super_admin" on public.admin_audit_logs
for select to authenticated using (public.is_super_admin());

drop policy if exists "admin_audit_logs_insert_super_admin" on public.admin_audit_logs;
create policy "admin_audit_logs_insert_super_admin" on public.admin_audit_logs
for insert to authenticated with check (
  public.is_super_admin()
  and actor_user_id = (select auth.uid())
);

revoke update on public.workspaces from authenticated;
grant update (name, website, industry, primary_goal, audience, voice)
  on public.workspaces to authenticated;

grant select on public.account_types to authenticated;
grant select on public.pricing_plans to anon, authenticated;
grant select on public.plan_entitlements to anon, authenticated;
grant select on public.account_entitlement_overrides to authenticated;
grant select, insert on public.admin_audit_logs to authenticated;

grant all on public.account_types to service_role;
grant all on public.pricing_plans to service_role;
grant all on public.plan_entitlements to service_role;
grant all on public.account_entitlement_overrides to service_role;
grant all on public.admin_audit_logs to service_role;

insert into public.account_types (key, display_name, description, is_internal, is_active)
values
  ('super_admin', 'Super Admin', 'Global platform operator account.', true, true),
  ('internal_admin', 'Internal Admin', 'Internal operational account for platform staff.', true, true),
  ('support_admin', 'Support Admin', 'Support-only account for customer assistance.', true, true),
  ('demo', 'Demo', 'Demo environment account for safe previews.', true, true),
  ('trial', 'Trial', 'Time-limited customer trial account.', false, true),
  ('paid_customer', 'Paid Customer', 'Standard paying customer account.', false, true),
  ('enterprise', 'Enterprise', 'Enterprise customer account with custom terms.', false, true),
  ('agency', 'Agency', 'Agency account managing multiple brands or clients.', false, true),
  ('suspended', 'Suspended', 'Suspended account pending review or reactivation.', true, true),
  ('legacy', 'Legacy', 'Legacy account awaiting manual migration.', false, true)
on conflict (key) do nothing;

insert into public.pricing_plans (
  key,
  name,
  description,
  monthly_price_cents,
  annual_price_cents,
  currency,
  is_public,
  is_active,
  sort_order,
  metadata
)
values
  ('starter', 'Starter', 'Draft starter plan for early-stage teams.', 4900, 47040, 'USD', true, true, 10, jsonb_build_object('status', 'draft', 'internal_note', 'Editable seeded pricing. Stripe hookup later.')),
  ('growth', 'Growth', 'Draft growth plan for expanding teams.', 9900, 95040, 'USD', true, true, 20, jsonb_build_object('status', 'draft', 'internal_note', 'Editable seeded pricing. Stripe hookup later.')),
  ('pro', 'Pro', 'Draft pro plan for advanced in-house teams.', 19900, 191040, 'USD', true, true, 30, jsonb_build_object('status', 'draft', 'internal_note', 'Editable seeded pricing. Stripe hookup later.')),
  ('agency', 'Agency', 'Draft agency plan for multi-client operators.', 34900, 335040, 'USD', true, true, 40, jsonb_build_object('status', 'draft', 'internal_note', 'Editable seeded pricing. Stripe hookup later.')),
  ('enterprise', 'Enterprise', 'Draft enterprise plan for custom deployments and controls.', 0, 0, 'USD', true, true, 50, jsonb_build_object('status', 'draft', 'contact_sales', true, 'internal_note', 'Editable seeded pricing. Stripe hookup later.'))
on conflict (key) do nothing;

with seeded_entitlements as (
  select *
  from (values
    ('starter', 'max_users', '1'::jsonb),
    ('starter', 'max_workspaces', '1'::jsonb),
    ('starter', 'max_brands', '1'::jsonb),
    ('starter', 'monthly_ai_credits', '1500'::jsonb),
    ('starter', 'monthly_video_credits', '60'::jsonb),
    ('starter', 'storage_limit_bytes', '5368709120'::jsonb),
    ('starter', 'bandwidth_limit_bytes', '21474836480'::jsonb),
    ('starter', 'scheduled_posts_per_month', '60'::jsonb),
    ('starter', 'social_connections', '3'::jsonb),
    ('starter', 'can_use_video_generation', 'true'::jsonb),
    ('starter', 'can_use_premium_video', 'false'::jsonb),
    ('starter', 'can_use_advanced_analytics', 'false'::jsonb),
    ('starter', 'can_use_client_workspaces', 'false'::jsonb),
    ('starter', 'can_use_priority_support', 'false'::jsonb),
    ('growth', 'max_users', '3'::jsonb),
    ('growth', 'max_workspaces', '1'::jsonb),
    ('growth', 'max_brands', '3'::jsonb),
    ('growth', 'monthly_ai_credits', '5000'::jsonb),
    ('growth', 'monthly_video_credits', '180'::jsonb),
    ('growth', 'storage_limit_bytes', '21474836480'::jsonb),
    ('growth', 'bandwidth_limit_bytes', '85899345920'::jsonb),
    ('growth', 'scheduled_posts_per_month', '200'::jsonb),
    ('growth', 'social_connections', '8'::jsonb),
    ('growth', 'can_use_video_generation', 'true'::jsonb),
    ('growth', 'can_use_premium_video', 'false'::jsonb),
    ('growth', 'can_use_advanced_analytics', 'true'::jsonb),
    ('growth', 'can_use_client_workspaces', 'false'::jsonb),
    ('growth', 'can_use_priority_support', 'false'::jsonb),
    ('pro', 'max_users', '10'::jsonb),
    ('pro', 'max_workspaces', '2'::jsonb),
    ('pro', 'max_brands', '10'::jsonb),
    ('pro', 'monthly_ai_credits', '15000'::jsonb),
    ('pro', 'monthly_video_credits', '500'::jsonb),
    ('pro', 'storage_limit_bytes', '107374182400'::jsonb),
    ('pro', 'bandwidth_limit_bytes', '322122547200'::jsonb),
    ('pro', 'scheduled_posts_per_month', '1000'::jsonb),
    ('pro', 'social_connections', '20'::jsonb),
    ('pro', 'can_use_video_generation', 'true'::jsonb),
    ('pro', 'can_use_premium_video', 'true'::jsonb),
    ('pro', 'can_use_advanced_analytics', 'true'::jsonb),
    ('pro', 'can_use_client_workspaces', 'false'::jsonb),
    ('pro', 'can_use_priority_support', 'true'::jsonb),
    ('agency', 'max_users', '25'::jsonb),
    ('agency', 'max_workspaces', '10'::jsonb),
    ('agency', 'max_brands', '50'::jsonb),
    ('agency', 'monthly_ai_credits', '40000'::jsonb),
    ('agency', 'monthly_video_credits', '1200'::jsonb),
    ('agency', 'storage_limit_bytes', '322122547200'::jsonb),
    ('agency', 'bandwidth_limit_bytes', '1099511627776'::jsonb),
    ('agency', 'scheduled_posts_per_month', '5000'::jsonb),
    ('agency', 'social_connections', '75'::jsonb),
    ('agency', 'can_use_video_generation', 'true'::jsonb),
    ('agency', 'can_use_premium_video', 'true'::jsonb),
    ('agency', 'can_use_advanced_analytics', 'true'::jsonb),
    ('agency', 'can_use_client_workspaces', 'true'::jsonb),
    ('agency', 'can_use_priority_support', 'true'::jsonb),
    ('enterprise', 'max_users', '250'::jsonb),
    ('enterprise', 'max_workspaces', '50'::jsonb),
    ('enterprise', 'max_brands', '250'::jsonb),
    ('enterprise', 'monthly_ai_credits', '150000'::jsonb),
    ('enterprise', 'monthly_video_credits', '5000'::jsonb),
    ('enterprise', 'storage_limit_bytes', '1099511627776'::jsonb),
    ('enterprise', 'bandwidth_limit_bytes', '5497558138880'::jsonb),
    ('enterprise', 'scheduled_posts_per_month', '20000'::jsonb),
    ('enterprise', 'social_connections', '250'::jsonb),
    ('enterprise', 'can_use_video_generation', 'true'::jsonb),
    ('enterprise', 'can_use_premium_video', 'true'::jsonb),
    ('enterprise', 'can_use_advanced_analytics', 'true'::jsonb),
    ('enterprise', 'can_use_client_workspaces', 'true'::jsonb),
    ('enterprise', 'can_use_priority_support', 'true'::jsonb)
  ) as seeded(plan_key, entitlement_key, value)
)
insert into public.plan_entitlements (plan_id, entitlement_key, value)
select p.id, seeded_entitlements.entitlement_key, seeded_entitlements.value
from seeded_entitlements
join public.pricing_plans p on p.key = seeded_entitlements.plan_key
on conflict (plan_id, entitlement_key) do nothing;

commit;