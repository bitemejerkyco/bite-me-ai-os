begin;

alter table public.profiles
  drop constraint if exists profiles_system_role_check;

alter table public.profiles
  add constraint profiles_system_role_check
  check (system_role in ('SUPER_ADMIN', 'INTERNAL_ADMIN', 'SUPPORT_ADMIN', 'CUSTOMER'));

alter table public.pricing_plans
  add column if not exists lifecycle_state text not null default 'draft'
    check (lifecycle_state in ('draft', 'public', 'active', 'archived'));

create table if not exists public.feature_flags (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (char_length(trim(key)) between 2 and 80),
  display_name text not null check (char_length(trim(display_name)) between 2 and 120),
  description text,
  enabled boolean not null default false,
  rollout_percentage integer not null default 100
    check (rollout_percentage between 0 and 100),
  allowed_account_types jsonb not null default '[]'::jsonb,
  allowed_plan_keys jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.account_feature_flag_overrides (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.workspaces(id) on delete cascade,
  feature_flag_id uuid not null references public.feature_flags(id) on delete cascade,
  enabled boolean not null,
  reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, feature_flag_id)
);

create table if not exists public.system_settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (char_length(trim(key)) between 2 and 80),
  value jsonb not null default 'null'::jsonb,
  category text not null check (char_length(trim(category)) between 2 and 80),
  description text,
  is_secret boolean not null default false,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  provider text not null,
  model text not null,
  feature text not null,
  operation text not null,
  status text not null check (status in ('SUCCEEDED', 'FAILED', 'REFUNDED', 'PENDING')),
  input_units numeric(18, 4) not null default 0,
  output_units numeric(18, 4) not null default 0,
  credits_charged integer not null default 0,
  estimated_cost_cents integer not null default 0,
  actual_cost_cents integer,
  revenue_allocated_cents integer,
  duration_ms integer,
  external_request_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.provider_cost_rates (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  model text not null,
  operation text not null,
  input_cost numeric(18, 8),
  output_cost numeric(18, 8),
  fixed_cost_cents integer not null default 0,
  effective_from timestamptz not null default now(),
  effective_to timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pricing_plans_lifecycle_state_idx
  on public.pricing_plans(lifecycle_state, sort_order asc, created_at asc);
create index if not exists feature_flags_key_idx
  on public.feature_flags(key);
create index if not exists account_feature_flag_overrides_account_idx
  on public.account_feature_flag_overrides(account_id, feature_flag_id);
create index if not exists system_settings_category_idx
  on public.system_settings(category, key);
create index if not exists ai_usage_events_account_created_idx
  on public.ai_usage_events(account_id, created_at desc);
create index if not exists ai_usage_events_provider_created_idx
  on public.ai_usage_events(provider, created_at desc);
create index if not exists ai_usage_events_status_created_idx
  on public.ai_usage_events(status, created_at desc);
create index if not exists provider_cost_rates_lookup_idx
  on public.provider_cost_rates(provider, model, operation, effective_from desc);

drop trigger if exists feature_flags_set_updated_at on public.feature_flags;
create trigger feature_flags_set_updated_at
before update on public.feature_flags
for each row execute function public.set_updated_at();

drop trigger if exists account_feature_flag_overrides_set_updated_at on public.account_feature_flag_overrides;
create trigger account_feature_flag_overrides_set_updated_at
before update on public.account_feature_flag_overrides
for each row execute function public.set_updated_at();

drop trigger if exists system_settings_set_updated_at on public.system_settings;
create trigger system_settings_set_updated_at
before update on public.system_settings
for each row execute function public.set_updated_at();

drop trigger if exists provider_cost_rates_set_updated_at on public.provider_cost_rates;
create trigger provider_cost_rates_set_updated_at
before update on public.provider_cost_rates
for each row execute function public.set_updated_at();

alter table public.feature_flags enable row level security;
alter table public.account_feature_flag_overrides enable row level security;
alter table public.system_settings enable row level security;
alter table public.ai_usage_events enable row level security;
alter table public.provider_cost_rates enable row level security;

drop policy if exists "feature_flags_select_super_admin" on public.feature_flags;
create policy "feature_flags_select_super_admin" on public.feature_flags
for select to authenticated using (public.is_super_admin());

drop policy if exists "feature_flags_insert_super_admin" on public.feature_flags;
create policy "feature_flags_insert_super_admin" on public.feature_flags
for insert to authenticated with check (public.is_super_admin());

drop policy if exists "feature_flags_update_super_admin" on public.feature_flags;
create policy "feature_flags_update_super_admin" on public.feature_flags
for update to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists "feature_flags_delete_super_admin" on public.feature_flags;
create policy "feature_flags_delete_super_admin" on public.feature_flags
for delete to authenticated using (public.is_super_admin());

drop policy if exists "account_feature_flag_overrides_select_super_admin" on public.account_feature_flag_overrides;
create policy "account_feature_flag_overrides_select_super_admin" on public.account_feature_flag_overrides
for select to authenticated using (public.is_super_admin());

drop policy if exists "account_feature_flag_overrides_insert_super_admin" on public.account_feature_flag_overrides;
create policy "account_feature_flag_overrides_insert_super_admin" on public.account_feature_flag_overrides
for insert to authenticated with check (
  public.is_super_admin() and created_by = (select auth.uid())
);

drop policy if exists "account_feature_flag_overrides_update_super_admin" on public.account_feature_flag_overrides;
create policy "account_feature_flag_overrides_update_super_admin" on public.account_feature_flag_overrides
for update to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists "account_feature_flag_overrides_delete_super_admin" on public.account_feature_flag_overrides;
create policy "account_feature_flag_overrides_delete_super_admin" on public.account_feature_flag_overrides
for delete to authenticated using (public.is_super_admin());

drop policy if exists "system_settings_select_super_admin" on public.system_settings;
create policy "system_settings_select_super_admin" on public.system_settings
for select to authenticated using (public.is_super_admin());

drop policy if exists "system_settings_insert_super_admin" on public.system_settings;
create policy "system_settings_insert_super_admin" on public.system_settings
for insert to authenticated with check (public.is_super_admin());

drop policy if exists "system_settings_update_super_admin" on public.system_settings;
create policy "system_settings_update_super_admin" on public.system_settings
for update to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists "system_settings_delete_super_admin" on public.system_settings;
create policy "system_settings_delete_super_admin" on public.system_settings
for delete to authenticated using (public.is_super_admin());

drop policy if exists "ai_usage_events_select_account_or_super_admin" on public.ai_usage_events;
create policy "ai_usage_events_select_account_or_super_admin" on public.ai_usage_events
for select to authenticated using (
  public.is_super_admin() or public.current_user_belongs_to_account(account_id)
);

drop policy if exists "ai_usage_events_insert_actor" on public.ai_usage_events;
create policy "ai_usage_events_insert_actor" on public.ai_usage_events
for insert to authenticated with check (
  user_id = (select auth.uid())
  and public.current_user_belongs_to_account(account_id)
);

drop policy if exists "provider_cost_rates_select_super_admin" on public.provider_cost_rates;
create policy "provider_cost_rates_select_super_admin" on public.provider_cost_rates
for select to authenticated using (public.is_super_admin());

drop policy if exists "provider_cost_rates_insert_super_admin" on public.provider_cost_rates;
create policy "provider_cost_rates_insert_super_admin" on public.provider_cost_rates
for insert to authenticated with check (public.is_super_admin());

drop policy if exists "provider_cost_rates_update_super_admin" on public.provider_cost_rates;
create policy "provider_cost_rates_update_super_admin" on public.provider_cost_rates
for update to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists "provider_cost_rates_delete_super_admin" on public.provider_cost_rates;
create policy "provider_cost_rates_delete_super_admin" on public.provider_cost_rates
for delete to authenticated using (public.is_super_admin());

grant select, insert, update, delete on public.feature_flags to authenticated;
grant select, insert, update, delete on public.account_feature_flag_overrides to authenticated;
grant select, insert, update, delete on public.system_settings to authenticated;
grant select, insert on public.ai_usage_events to authenticated;
grant select, insert, update, delete on public.provider_cost_rates to authenticated;

grant all on public.feature_flags to service_role;
grant all on public.account_feature_flag_overrides to service_role;
grant all on public.system_settings to service_role;
grant all on public.ai_usage_events to service_role;
grant all on public.provider_cost_rates to service_role;

update public.pricing_plans
set lifecycle_state = case
  when lifecycle_state is null then 'draft'
  else lifecycle_state
end;

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
values
  ('ai_studio', 'AI Studio', 'Controls access to AI Studio workflows.', true, 100, '["trial","paid_customer","enterprise","agency"]'::jsonb, '["starter","growth","pro","agency","enterprise"]'::jsonb, '{}'::jsonb),
  ('video_generation', 'Video Generation', 'Controls access to video generation workflows.', true, 100, '["trial","paid_customer","enterprise","agency"]'::jsonb, '["starter","growth","pro","agency","enterprise"]'::jsonb, '{}'::jsonb),
  ('premium_video', 'Premium Video', 'Controls premium video features.', false, 0, '["paid_customer","enterprise","agency"]'::jsonb, '["pro","agency","enterprise"]'::jsonb, '{}'::jsonb),
  ('calendar', 'Calendar', 'Controls scheduled-post calendar access.', true, 100, '["trial","paid_customer","enterprise","agency"]'::jsonb, '["starter","growth","pro","agency","enterprise"]'::jsonb, '{}'::jsonb),
  ('advanced_analytics', 'Advanced Analytics', 'Controls advanced analytics features.', false, 0, '["paid_customer","enterprise","agency"]'::jsonb, '["growth","pro","agency","enterprise"]'::jsonb, '{}'::jsonb),
  ('tiktok', 'TikTok', 'Controls TikTok integration access.', true, 100, '["trial","paid_customer","enterprise","agency"]'::jsonb, '["starter","growth","pro","agency","enterprise"]'::jsonb, '{}'::jsonb),
  ('meta', 'Meta', 'Controls Meta integration access.', false, 0, '["paid_customer","enterprise","agency"]'::jsonb, '["growth","pro","agency","enterprise"]'::jsonb, '{}'::jsonb),
  ('linkedin', 'LinkedIn', 'Controls LinkedIn integration access.', false, 0, '["paid_customer","enterprise","agency"]'::jsonb, '["growth","pro","agency","enterprise"]'::jsonb, '{}'::jsonb),
  ('amazon_ads', 'Amazon Ads', 'Controls Amazon Ads integration access.', true, 100, '["paid_customer","enterprise","agency","internal_admin","support_admin","super_admin"]'::jsonb, '["growth","pro","agency","enterprise"]'::jsonb, '{}'::jsonb),
  ('shopify', 'Shopify', 'Controls Shopify integration access.', false, 0, '["paid_customer","enterprise","agency"]'::jsonb, '["growth","pro","agency","enterprise"]'::jsonb, '{}'::jsonb),
  ('media_library', 'Media Library', 'Controls media library access.', true, 100, '["trial","paid_customer","enterprise","agency"]'::jsonb, '["starter","growth","pro","agency","enterprise"]'::jsonb, '{}'::jsonb),
  ('content_library', 'Content Library', 'Controls content library access.', true, 100, '["trial","paid_customer","enterprise","agency"]'::jsonb, '["starter","growth","pro","agency","enterprise"]'::jsonb, '{}'::jsonb),
  ('client_workspaces', 'Client Workspaces', 'Controls agency client workspace capabilities.', false, 0, '["agency","enterprise"]'::jsonb, '["agency","enterprise"]'::jsonb, '{}'::jsonb)
on conflict (key) do nothing;

insert into public.system_settings (
  key,
  value,
  category,
  description,
  is_secret
)
values
  ('default_trial_days', '14'::jsonb, 'billing', 'Default customer trial length in days.', false),
  ('default_ai_credits', '500'::jsonb, 'billing', 'Default monthly AI credits for new trial accounts.', false),
  ('default_video_credits', '30'::jsonb, 'billing', 'Default monthly video credits for new trial accounts.', false),
  ('maximum_upload_size_bytes', '52428800'::jsonb, 'storage', 'Maximum upload size allowed by the application.', false),
  ('maintenance_mode', 'false'::jsonb, 'platform', 'Enables maintenance mode for non-admin users.', false),
  ('announcement_banner', jsonb_build_object('enabled', false, 'message', ''), 'platform', 'Optional announcement banner shown to users.', false),
  ('support_email', '"calikingdistro@gmail.com"'::jsonb, 'support', 'Support contact email shown in the product.', false),
  ('default_onboarding_flow', '"standard"'::jsonb, 'product', 'Default onboarding flow key.', false),
  ('ai_daily_spend_limit_cents', '0'::jsonb, 'billing', 'Daily AI provider spend limit. Zero disables the limit.', false),
  ('video_daily_spend_limit_cents', '0'::jsonb, 'billing', 'Daily video provider spend limit. Zero disables the limit.', false),
  ('storage_warning_percentage', '80'::jsonb, 'storage', 'Storage usage threshold that triggers warnings.', false),
  ('storage_critical_percentage', '95'::jsonb, 'storage', 'Storage usage threshold that triggers critical alerts.', false)
on conflict (key) do nothing;

commit;