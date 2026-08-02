begin;

create table if not exists public.creators (
  id text primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  display_name text not null,
  handle text not null,
  bio text not null default '',
  profile_image_url text,
  location text not null default '',
  niches text[] not null default '{}',
  platforms jsonb not null default '[]'::jsonb,
  follower_count bigint not null default 0 check (follower_count >= 0),
  average_views bigint not null default 0 check (average_views >= 0),
  engagement_rate numeric(8, 5) not null default 0 check (engagement_rate >= 0),
  audience_summary text not null default '',
  estimated_rate_min numeric(12, 2) not null default 0 check (estimated_rate_min >= 0),
  estimated_rate_max numeric(12, 2) not null default 0 check (estimated_rate_max >= estimated_rate_min),
  currency text not null default 'USD',
  brand_safety_status text not null default 'SAFE' check (brand_safety_status in ('SAFE', 'REVIEW', 'RESTRICTED')),
  availability_status text not null default 'AVAILABLE' check (availability_status in ('AVAILABLE', 'LIMITED', 'UNAVAILABLE')),
  match_score integer not null default 0 check (match_score between 0 and 100),
  saved boolean not null default false,
  source text not null default 'DEMO' check (source in ('DEMO', 'MANUAL', 'IMPORT')),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, handle)
);

create table if not exists public.creator_platforms (
  id text primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  creator_id text not null references public.creators(id) on delete cascade,
  platform text not null,
  handle text not null,
  profile_url text,
  followers bigint not null default 0 check (followers >= 0),
  average_views bigint not null default 0 check (average_views >= 0),
  engagement_rate numeric(8, 5) not null default 0 check (engagement_rate >= 0),
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, creator_id, platform)
);

create table if not exists public.creator_pipeline_records (
  id text primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  creator_id text not null references public.creators(id) on delete cascade,
  stage text not null check (stage in (
    'DISCOVERED',
    'AI_RECOMMENDED',
    'SAVED',
    'CONTACTED',
    'INTERESTED',
    'NEGOTIATING',
    'AGREEMENT_PENDING',
    'CAMPAIGN_ACTIVE',
    'CONTENT_PRODUCTION',
    'CONTENT_REVIEW',
    'PUBLISHED',
    'COMPLETED',
    'AMBASSADOR',
    'DECLINED',
    'ARCHIVED'
  )),
  assigned_user_id uuid references auth.users(id) on delete set null,
  campaign_id text,
  next_action text,
  next_action_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.creator_campaigns (
  id text primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  goal text not null,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'RECRUITING', 'ACTIVE', 'CONTENT_REVIEW', 'SCHEDULED', 'LIVE', 'COMPLETED', 'PAUSED', 'CANCELLED')),
  description text not null default '',
  budget numeric(12, 2) not null default 0 check (budget >= 0),
  currency text not null default 'USD',
  start_date date,
  end_date date,
  product_ids text[] not null default '{}',
  creator_ids text[] not null default '{}',
  platforms text[] not null default '{}',
  deliverables text[] not null default '{}',
  approval_required boolean not null default true,
  tracking_method text not null default 'TRACKING_PLACEHOLDER',
  created_by uuid references auth.users(id) on delete set null,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.creator_campaign_members (
  id text primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id text not null references public.creator_campaigns(id) on delete cascade,
  creator_id text not null references public.creators(id) on delete cascade,
  role text not null default 'CREATOR',
  agreed_rate numeric(12, 2),
  currency text,
  status text not null default 'INVITED' check (status in ('INVITED', 'ACCEPTED', 'DECLINED', 'REMOVED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, campaign_id, creator_id)
);

create table if not exists public.creator_deliverables (
  id text primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id text not null references public.creator_campaigns(id) on delete cascade,
  creator_id text not null references public.creators(id) on delete cascade,
  title text not null,
  platform text not null,
  due_at timestamptz,
  status text not null default 'PLANNED' check (status in ('PLANNED', 'SUBMITTED', 'APPROVED', 'REJECTED', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.creator_submissions (
  id text primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  creator_id text not null references public.creators(id) on delete cascade,
  campaign_id text references public.creator_campaigns(id) on delete set null,
  status text not null default 'SUBMITTED' check (status in ('SUBMITTED', 'IN_REVIEW', 'REVISION_REQUESTED', 'APPROVED', 'REJECTED', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED')),
  asset_type text not null check (asset_type in ('IMAGE', 'VIDEO', 'CAPTION', 'STORY_CONCEPT', 'SCRIPT', 'THUMBNAIL')),
  title text not null,
  content_url text,
  text_body text,
  supporting_notes text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  approval_item_id uuid references public.marketing_approval_items(id) on delete set null,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.creator_submission_comments (
  id text primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  submission_id text not null references public.creator_submissions(id) on delete cascade,
  author_user_id uuid references auth.users(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.creator_ugc_assets (
  id text primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  creator_id text not null references public.creators(id) on delete cascade,
  campaign_id text references public.creator_campaigns(id) on delete set null,
  product_id text,
  platform text not null,
  asset_type text not null,
  title text not null,
  tags text[] not null default '{}',
  usage_rights_start date,
  usage_rights_end date,
  approval_status text not null default 'APPROVED' check (approval_status in ('APPROVED', 'ARCHIVED')),
  performance_metrics jsonb,
  media_library_asset_id uuid references public.media_assets(id) on delete set null,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.creator_activity_events (
  id text primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  entity_type text not null,
  entity_id text not null,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.creator_metric_snapshots (
  id text primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  measured jsonb not null default '{}'::jsonb,
  estimated jsonb not null default '{}'::jsonb,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists creators_workspace_idx on public.creators(workspace_id, created_at desc);
create index if not exists creator_platforms_workspace_idx on public.creator_platforms(workspace_id, creator_id);
create index if not exists creator_pipeline_workspace_stage_idx on public.creator_pipeline_records(workspace_id, stage, updated_at desc);
create index if not exists creator_campaigns_workspace_status_idx on public.creator_campaigns(workspace_id, status, created_at desc);
create index if not exists creator_submissions_workspace_status_idx on public.creator_submissions(workspace_id, status, created_at desc);
create index if not exists creator_ugc_workspace_platform_idx on public.creator_ugc_assets(workspace_id, platform, created_at desc);
create index if not exists creator_activity_workspace_created_idx on public.creator_activity_events(workspace_id, created_at desc);
create index if not exists creator_metrics_workspace_period_idx on public.creator_metric_snapshots(workspace_id, period_end desc);

alter table public.creators enable row level security;
alter table public.creator_platforms enable row level security;
alter table public.creator_pipeline_records enable row level security;
alter table public.creator_campaigns enable row level security;
alter table public.creator_campaign_members enable row level security;
alter table public.creator_deliverables enable row level security;
alter table public.creator_submissions enable row level security;
alter table public.creator_submission_comments enable row level security;
alter table public.creator_ugc_assets enable row level security;
alter table public.creator_activity_events enable row level security;
alter table public.creator_metric_snapshots enable row level security;

drop policy if exists "creator_member_select" on public.creators;
create policy "creator_member_select"
on public.creators
for select to authenticated
using (public.current_user_belongs_to_account(workspace_id) or public.is_super_admin());

drop policy if exists "creator_manager_manage" on public.creators;
create policy "creator_manager_manage"
on public.creators
for all to authenticated
using (public.has_workspace_role(workspace_id, 'MANAGER'))
with check (public.has_workspace_role(workspace_id, 'MANAGER'));

drop policy if exists "creator_platform_member_select" on public.creator_platforms;
create policy "creator_platform_member_select"
on public.creator_platforms
for select to authenticated
using (public.current_user_belongs_to_account(workspace_id) or public.is_super_admin());

drop policy if exists "creator_platform_manager_manage" on public.creator_platforms;
create policy "creator_platform_manager_manage"
on public.creator_platforms
for all to authenticated
using (public.has_workspace_role(workspace_id, 'MANAGER'))
with check (public.has_workspace_role(workspace_id, 'MANAGER'));

drop policy if exists "creator_pipeline_member_select" on public.creator_pipeline_records;
create policy "creator_pipeline_member_select"
on public.creator_pipeline_records
for select to authenticated
using (public.current_user_belongs_to_account(workspace_id) or public.is_super_admin());

drop policy if exists "creator_pipeline_manager_manage" on public.creator_pipeline_records;
create policy "creator_pipeline_manager_manage"
on public.creator_pipeline_records
for all to authenticated
using (public.has_workspace_role(workspace_id, 'MANAGER'))
with check (public.has_workspace_role(workspace_id, 'MANAGER'));

drop policy if exists "creator_campaigns_member_select" on public.creator_campaigns;
create policy "creator_campaigns_member_select"
on public.creator_campaigns
for select to authenticated
using (public.current_user_belongs_to_account(workspace_id) or public.is_super_admin());

drop policy if exists "creator_campaigns_manager_manage" on public.creator_campaigns;
create policy "creator_campaigns_manager_manage"
on public.creator_campaigns
for all to authenticated
using (public.has_workspace_role(workspace_id, 'MANAGER'))
with check (public.has_workspace_role(workspace_id, 'MANAGER'));

drop policy if exists "creator_campaign_members_member_select" on public.creator_campaign_members;
create policy "creator_campaign_members_member_select"
on public.creator_campaign_members
for select to authenticated
using (public.current_user_belongs_to_account(workspace_id) or public.is_super_admin());

drop policy if exists "creator_campaign_members_manager_manage" on public.creator_campaign_members;
create policy "creator_campaign_members_manager_manage"
on public.creator_campaign_members
for all to authenticated
using (public.has_workspace_role(workspace_id, 'MANAGER'))
with check (public.has_workspace_role(workspace_id, 'MANAGER'));

drop policy if exists "creator_deliverables_member_select" on public.creator_deliverables;
create policy "creator_deliverables_member_select"
on public.creator_deliverables
for select to authenticated
using (public.current_user_belongs_to_account(workspace_id) or public.is_super_admin());

drop policy if exists "creator_deliverables_manager_manage" on public.creator_deliverables;
create policy "creator_deliverables_manager_manage"
on public.creator_deliverables
for all to authenticated
using (public.has_workspace_role(workspace_id, 'MANAGER'))
with check (public.has_workspace_role(workspace_id, 'MANAGER'));

drop policy if exists "creator_submissions_member_select" on public.creator_submissions;
create policy "creator_submissions_member_select"
on public.creator_submissions
for select to authenticated
using (public.current_user_belongs_to_account(workspace_id) or public.is_super_admin());

drop policy if exists "creator_submissions_editor_manage" on public.creator_submissions;
create policy "creator_submissions_editor_manage"
on public.creator_submissions
for all to authenticated
using (public.has_workspace_role(workspace_id, 'EDITOR'))
with check (public.has_workspace_role(workspace_id, 'EDITOR'));

drop policy if exists "creator_comments_member_select" on public.creator_submission_comments;
create policy "creator_comments_member_select"
on public.creator_submission_comments
for select to authenticated
using (public.current_user_belongs_to_account(workspace_id) or public.is_super_admin());

drop policy if exists "creator_comments_editor_manage" on public.creator_submission_comments;
create policy "creator_comments_editor_manage"
on public.creator_submission_comments
for all to authenticated
using (public.has_workspace_role(workspace_id, 'EDITOR'))
with check (public.has_workspace_role(workspace_id, 'EDITOR'));

drop policy if exists "creator_ugc_member_select" on public.creator_ugc_assets;
create policy "creator_ugc_member_select"
on public.creator_ugc_assets
for select to authenticated
using (public.current_user_belongs_to_account(workspace_id) or public.is_super_admin());

drop policy if exists "creator_ugc_approver_manage" on public.creator_ugc_assets;
create policy "creator_ugc_approver_manage"
on public.creator_ugc_assets
for all to authenticated
using (public.has_workspace_role(workspace_id, 'APPROVER'))
with check (public.has_workspace_role(workspace_id, 'APPROVER'));

drop policy if exists "creator_activity_member_select" on public.creator_activity_events;
create policy "creator_activity_member_select"
on public.creator_activity_events
for select to authenticated
using (public.current_user_belongs_to_account(workspace_id) or public.is_super_admin());

drop policy if exists "creator_activity_manager_insert" on public.creator_activity_events;
create policy "creator_activity_manager_insert"
on public.creator_activity_events
for insert to authenticated
with check (public.has_workspace_role(workspace_id, 'MANAGER') or public.has_workspace_role(workspace_id, 'APPROVER'));

drop policy if exists "creator_metrics_member_select" on public.creator_metric_snapshots;
create policy "creator_metrics_member_select"
on public.creator_metric_snapshots
for select to authenticated
using (public.current_user_belongs_to_account(workspace_id) or public.is_super_admin());

drop policy if exists "creator_metrics_manager_manage" on public.creator_metric_snapshots;
create policy "creator_metrics_manager_manage"
on public.creator_metric_snapshots
for all to authenticated
using (public.has_workspace_role(workspace_id, 'MANAGER'))
with check (public.has_workspace_role(workspace_id, 'MANAGER'));

drop trigger if exists creators_set_updated_at on public.creators;
create trigger creators_set_updated_at
before update on public.creators
for each row execute function public.set_updated_at();

drop trigger if exists creator_platforms_set_updated_at on public.creator_platforms;
create trigger creator_platforms_set_updated_at
before update on public.creator_platforms
for each row execute function public.set_updated_at();

drop trigger if exists creator_pipeline_records_set_updated_at on public.creator_pipeline_records;
create trigger creator_pipeline_records_set_updated_at
before update on public.creator_pipeline_records
for each row execute function public.set_updated_at();

drop trigger if exists creator_campaigns_set_updated_at on public.creator_campaigns;
create trigger creator_campaigns_set_updated_at
before update on public.creator_campaigns
for each row execute function public.set_updated_at();

drop trigger if exists creator_campaign_members_set_updated_at on public.creator_campaign_members;
create trigger creator_campaign_members_set_updated_at
before update on public.creator_campaign_members
for each row execute function public.set_updated_at();

drop trigger if exists creator_deliverables_set_updated_at on public.creator_deliverables;
create trigger creator_deliverables_set_updated_at
before update on public.creator_deliverables
for each row execute function public.set_updated_at();

drop trigger if exists creator_submissions_set_updated_at on public.creator_submissions;
create trigger creator_submissions_set_updated_at
before update on public.creator_submissions
for each row execute function public.set_updated_at();

drop trigger if exists creator_ugc_assets_set_updated_at on public.creator_ugc_assets;
create trigger creator_ugc_assets_set_updated_at
before update on public.creator_ugc_assets
for each row execute function public.set_updated_at();

grant select, insert, update, delete on public.creators to authenticated;
grant select, insert, update, delete on public.creator_platforms to authenticated;
grant select, insert, update, delete on public.creator_pipeline_records to authenticated;
grant select, insert, update, delete on public.creator_campaigns to authenticated;
grant select, insert, update, delete on public.creator_campaign_members to authenticated;
grant select, insert, update, delete on public.creator_deliverables to authenticated;
grant select, insert, update, delete on public.creator_submissions to authenticated;
grant select, insert, update, delete on public.creator_submission_comments to authenticated;
grant select, insert, update, delete on public.creator_ugc_assets to authenticated;
grant select, insert on public.creator_activity_events to authenticated;
grant select, insert, update, delete on public.creator_metric_snapshots to authenticated;

grant all on public.creators to service_role;
grant all on public.creator_platforms to service_role;
grant all on public.creator_pipeline_records to service_role;
grant all on public.creator_campaigns to service_role;
grant all on public.creator_campaign_members to service_role;
grant all on public.creator_deliverables to service_role;
grant all on public.creator_submissions to service_role;
grant all on public.creator_submission_comments to service_role;
grant all on public.creator_ugc_assets to service_role;
grant all on public.creator_activity_events to service_role;
grant all on public.creator_metric_snapshots to service_role;

with demo_workspace as (
  select id from public.workspaces where lower(name) like '%demo%' order by created_at asc limit 1
)
insert into public.creators (
  id, workspace_id, display_name, handle, bio, profile_image_url, location, niches, platforms,
  follower_count, average_views, engagement_rate, audience_summary, estimated_rate_min, estimated_rate_max,
  currency, brand_safety_status, availability_status, match_score, saved, source, is_demo
)
select * from (
  values
  ('cr_001', (select id from demo_workspace), 'Maya Food Lab', '@mayafoodlab', 'Demo creator profile', '/postmotive-mark.png', 'Austin, TX', '{Food,Beverage}', '[{"platform":"Instagram","handle":"@mayafoodlab","profileUrl":"https://example.com/mayafoodlab","followers":42000,"averageViews":22000,"engagementRate":0.064,"verified":false}]'::jsonb, 42000, 22000, 0.064, 'Food audience fit', 350, 700, 'USD', 'SAFE', 'AVAILABLE', 92, true, 'DEMO', true),
  ('cr_002', (select id from demo_workspace), 'Trail Fuel Josh', '@trailfueljosh', 'Demo creator profile', '/postmotive-mark.png', 'Boulder, CO', '{Outdoors,Fitness}', '[{"platform":"TikTok","handle":"@trailfueljosh","profileUrl":"https://example.com/trailfueljosh","followers":155000,"averageViews":74000,"engagementRate":0.052,"verified":false}]'::jsonb, 155000, 74000, 0.052, 'Outdoors audience fit', 1200, 2500, 'USD', 'SAFE', 'LIMITED', 87, false, 'DEMO', true),
  ('cr_003', (select id from demo_workspace), 'Glow Routine Co', '@glowroutineco', 'Demo creator profile', '/postmotive-mark.png', 'Los Angeles, CA', '{Beauty,Lifestyle}', '[{"platform":"Instagram","handle":"@glowroutineco","profileUrl":"https://example.com/glowroutineco","followers":98000,"averageViews":36000,"engagementRate":0.048,"verified":false}]'::jsonb, 98000, 36000, 0.048, 'Beauty audience fit', 900, 1700, 'USD', 'SAFE', 'AVAILABLE', 81, false, 'DEMO', true),
  ('cr_004', (select id from demo_workspace), 'Garage Rev Mike', '@garagerevmike', 'Demo creator profile', '/postmotive-mark.png', 'Phoenix, AZ', '{Automotive,Technology}', '[{"platform":"YouTube","handle":"@garagerevmike","profileUrl":"https://example.com/garagerevmike","followers":210000,"averageViews":86000,"engagementRate":0.039,"verified":true}]'::jsonb, 210000, 86000, 0.039, 'Automotive audience fit', 1700, 3200, 'USD', 'REVIEW', 'LIMITED', 74, false, 'DEMO', true),
  ('cr_005', (select id from demo_workspace), 'ScaleOps Sarah', '@scaleopssarah', 'Demo creator profile', '/postmotive-mark.png', 'Seattle, WA', '{Business,Technology}', '[{"platform":"LinkedIn","handle":"@scaleopssarah","profileUrl":"https://example.com/scaleopssarah","followers":31000,"averageViews":14000,"engagementRate":0.071,"verified":false}]'::jsonb, 31000, 14000, 0.071, 'Business audience fit', 400, 900, 'USD', 'SAFE', 'AVAILABLE', 79, false, 'DEMO', true),
  ('cr_006', (select id from demo_workspace), 'City Bites Crew', '@citybitescrew', 'Demo creator profile', '/postmotive-mark.png', 'Chicago, IL', '{Food,Lifestyle}', '[{"platform":"TikTok","handle":"@citybitescrew","profileUrl":"https://example.com/citybitescrew","followers":84000,"averageViews":42000,"engagementRate":0.062,"verified":false}]'::jsonb, 84000, 42000, 0.062, 'Food lifestyle fit', 700, 1500, 'USD', 'SAFE', 'AVAILABLE', 90, true, 'DEMO', true),
  ('cr_007', (select id from demo_workspace), 'HomeGym Devin', '@homegymdevin', 'Demo creator profile', '/postmotive-mark.png', 'Denver, CO', '{Fitness,Technology}', '[{"platform":"YouTube","handle":"@homegymdevin","profileUrl":"https://example.com/homegymdevin","followers":126000,"averageViews":51000,"engagementRate":0.055,"verified":false}]'::jsonb, 126000, 51000, 0.055, 'Fitness audience fit', 1000, 2100, 'USD', 'SAFE', 'LIMITED', 85, false, 'DEMO', true),
  ('cr_008', (select id from demo_workspace), 'Weekend Wheels', '@weekendwheels', 'Demo creator profile', '/postmotive-mark.png', 'Detroit, MI', '{Automotive,Lifestyle}', '[{"platform":"Instagram","handle":"@weekendwheels","profileUrl":"https://example.com/weekendwheels","followers":67000,"averageViews":25000,"engagementRate":0.044,"verified":false}]'::jsonb, 67000, 25000, 0.044, 'Lifestyle vehicle fit', 650, 1200, 'USD', 'REVIEW', 'AVAILABLE', 70, false, 'DEMO', true),
  ('cr_009', (select id from demo_workspace), 'CFO Quick Tips', '@cfoquicktips', 'Demo creator profile', '/postmotive-mark.png', 'New York, NY', '{Business}', '[{"platform":"LinkedIn","handle":"@cfoquicktips","profileUrl":"https://example.com/cfoquicktips","followers":54000,"averageViews":19000,"engagementRate":0.058,"verified":false}]'::jsonb, 54000, 19000, 0.058, 'Business audience fit', 800, 1600, 'USD', 'SAFE', 'AVAILABLE', 76, true, 'DEMO', true),
  ('cr_010', (select id from demo_workspace), 'Beauty Local Lena', '@beautylocallena', 'Demo creator profile', '/postmotive-mark.png', 'San Diego, CA', '{Beauty,"Local creators"}', '[{"platform":"TikTok","handle":"@beautylocallena","profileUrl":"https://example.com/beautylocallena","followers":29000,"averageViews":13000,"engagementRate":0.083,"verified":false}]'::jsonb, 29000, 13000, 0.083, 'Local beauty fit', 250, 600, 'USD', 'SAFE', 'AVAILABLE', 88, true, 'DEMO', true),
  ('cr_011', (select id from demo_workspace), 'Micro Meal Prep', '@micromealprep', 'Demo creator profile', '/postmotive-mark.png', 'Nashville, TN', '{Food,Fitness,"Micro creators"}', '[{"platform":"Instagram","handle":"@micromealprep","profileUrl":"https://example.com/micromealprep","followers":18000,"averageViews":9000,"engagementRate":0.095,"verified":false}]'::jsonb, 18000, 9000, 0.095, 'Micro food fit', 180, 420, 'USD', 'SAFE', 'AVAILABLE', 91, true, 'DEMO', true),
  ('cr_012', (select id from demo_workspace), 'MidTier Tech Mom', '@midtiertechmom', 'Demo creator profile', '/postmotive-mark.png', 'Portland, OR', '{Technology,Lifestyle,"Mid-tier creators"}', '[{"platform":"YouTube","handle":"@midtiertechmom","profileUrl":"https://example.com/midtiertechmom","followers":240000,"averageViews":102000,"engagementRate":0.037,"verified":true}]'::jsonb, 240000, 102000, 0.037, 'Mid-tier tech fit', 2200, 3800, 'USD', 'SAFE', 'LIMITED', 82, false, 'DEMO', true),
  ('cr_013', (select id from demo_workspace), 'Urban Runner Kai', '@urbanrunnerkai', 'Demo creator profile', '/postmotive-mark.png', 'Atlanta, GA', '{Fitness,Outdoors}', '[{"platform":"TikTok","handle":"@urbanrunnerkai","profileUrl":"https://example.com/urbanrunnerkai","followers":73000,"averageViews":31000,"engagementRate":0.061,"verified":false}]'::jsonb, 73000, 31000, 0.061, 'Urban fitness fit', 700, 1400, 'USD', 'SAFE', 'AVAILABLE', 86, true, 'DEMO', true),
  ('cr_014', (select id from demo_workspace), 'Family Road Labs', '@familyroadlabs', 'Demo creator profile', '/postmotive-mark.png', 'Boise, ID', '{Outdoors,Automotive,Lifestyle}', '[{"platform":"Instagram","handle":"@familyroadlabs","profileUrl":"https://example.com/familyroadlabs","followers":112000,"averageViews":44000,"engagementRate":0.046,"verified":false}]'::jsonb, 112000, 44000, 0.046, 'Outdoors lifestyle fit', 1000, 2000, 'USD', 'SAFE', 'LIMITED', 80, false, 'DEMO', true),
  ('cr_015', (select id from demo_workspace), 'Brew Science Mia', '@brewsciencemia', 'Demo creator profile', '/postmotive-mark.png', 'Milwaukee, WI', '{Beverage,Technology}', '[{"platform":"YouTube","handle":"@brewsciencemia","profileUrl":"https://example.com/brewsciencemia","followers":51000,"averageViews":21000,"engagementRate":0.054,"verified":false}]'::jsonb, 51000, 21000, 0.054, 'Beverage science fit', 550, 1300, 'USD', 'SAFE', 'AVAILABLE', 83, false, 'DEMO', true),
  ('cr_016', (select id from demo_workspace), 'Local Lift Club', '@localliftclub', 'Demo creator profile', '/postmotive-mark.png', 'Raleigh, NC', '{Fitness,"Local creators"}', '[{"platform":"Instagram","handle":"@localliftclub","profileUrl":"https://example.com/localliftclub","followers":24000,"averageViews":10200,"engagementRate":0.088,"verified":false}]'::jsonb, 24000, 10200, 0.088, 'Local fitness fit', 220, 520, 'USD', 'SAFE', 'AVAILABLE', 89, true, 'DEMO', true),
  ('cr_017', (select id from demo_workspace), 'Founders Field Notes', '@foundersfieldnotes', 'Demo creator profile', '/postmotive-mark.png', 'Miami, FL', '{Business,Lifestyle}', '[{"platform":"LinkedIn","handle":"@foundersfieldnotes","profileUrl":"https://example.com/foundersfieldnotes","followers":47000,"averageViews":17600,"engagementRate":0.049,"verified":false}]'::jsonb, 47000, 17600, 0.049, 'Founder audience fit', 600, 1250, 'USD', 'SAFE', 'AVAILABLE', 77, false, 'DEMO', true),
  ('cr_018', (select id from demo_workspace), 'Auto Care Annie', '@autocareannie', 'Demo creator profile', '/postmotive-mark.png', 'Dallas, TX', '{Automotive,Beauty}', '[{"platform":"TikTok","handle":"@autocareannie","profileUrl":"https://example.com/autocareannie","followers":132000,"averageViews":65000,"engagementRate":0.041,"verified":false}]'::jsonb, 132000, 65000, 0.041, 'Auto creator fit', 1300, 2400, 'USD', 'REVIEW', 'LIMITED', 69, false, 'DEMO', true),
  ('cr_019', (select id from demo_workspace), 'Kitchen Sprint', '@kitchensprint', 'Demo creator profile', '/postmotive-mark.png', 'San Jose, CA', '{Food,Technology}', '[{"platform":"YouTube","handle":"@kitchensprint","profileUrl":"https://example.com/kitchensprint","followers":88000,"averageViews":35000,"engagementRate":0.057,"verified":false}]'::jsonb, 88000, 35000, 0.057, 'Food technology fit', 900, 1600, 'USD', 'SAFE', 'AVAILABLE', 84, false, 'DEMO', true),
  ('cr_020', (select id from demo_workspace), 'Mindful Move Jen', '@mindfulmovejen', 'Demo creator profile', '/postmotive-mark.png', 'Salt Lake City, UT', '{Fitness,Lifestyle}', '[{"platform":"Instagram","handle":"@mindfulmovejen","profileUrl":"https://example.com/mindfulmovejen","followers":61000,"averageViews":26000,"engagementRate":0.067,"verified":false}]'::jsonb, 61000, 26000, 0.067, 'Mindful fitness fit', 650, 1400, 'USD', 'SAFE', 'AVAILABLE', 88, true, 'DEMO', true),
  ('cr_021', (select id from demo_workspace), 'Outdoor Grid Nate', '@outdoorgridnate', 'Demo creator profile', '/postmotive-mark.png', 'Bend, OR', '{Outdoors,Technology}', '[{"platform":"YouTube","handle":"@outdoorgridnate","profileUrl":"https://example.com/outdoorgridnate","followers":94000,"averageViews":39000,"engagementRate":0.045,"verified":false}]'::jsonb, 94000, 39000, 0.045, 'Outdoors tech fit', 950, 1900, 'USD', 'SAFE', 'LIMITED', 78, false, 'DEMO', true),
  ('cr_022', (select id from demo_workspace), 'Beauty Bench Rae', '@beautybenchrae', 'Demo creator profile', '/postmotive-mark.png', 'Orlando, FL', '{Beauty}', '[{"platform":"TikTok","handle":"@beautybenchrae","profileUrl":"https://example.com/beautybenchrae","followers":117000,"averageViews":53000,"engagementRate":0.059,"verified":false}]'::jsonb, 117000, 53000, 0.059, 'Beauty platform fit', 1100, 2100, 'USD', 'SAFE', 'AVAILABLE', 83, false, 'DEMO', true),
  ('cr_023', (select id from demo_workspace), 'Cafe Tech Weekly', '@cafetechweekly', 'Demo creator profile', '/postmotive-mark.png', 'Minneapolis, MN', '{Beverage,Business,Technology}', '[{"platform":"LinkedIn","handle":"@cafetechweekly","profileUrl":"https://example.com/cafetechweekly","followers":27000,"averageViews":11800,"engagementRate":0.064,"verified":false}]'::jsonb, 27000, 11800, 0.064, 'Beverage business fit', 320, 760, 'USD', 'SAFE', 'AVAILABLE', 81, true, 'DEMO', true),
  ('cr_024', (select id from demo_workspace), 'Motor Habit', '@motorhabit', 'Demo creator profile', '/postmotive-mark.png', 'Tampa, FL', '{Automotive,Outdoors}', '[{"platform":"Instagram","handle":"@motorhabit","profileUrl":"https://example.com/motorhabit","followers":79000,"averageViews":30000,"engagementRate":0.042,"verified":false}]'::jsonb, 79000, 30000, 0.042, 'Automotive risk fit', 800, 1500, 'USD', 'RESTRICTED', 'LIMITED', 63, false, 'DEMO', true),
  ('cr_025', (select id from demo_workspace), 'Local Spark Toni', '@localsparktoni', 'Demo creator profile', '/postmotive-mark.png', 'Kansas City, MO', '{Lifestyle,"Local creators","Micro creators"}', '[{"platform":"TikTok","handle":"@localsparktoni","profileUrl":"https://example.com/localsparktoni","followers":16000,"averageViews":8700,"engagementRate":0.099,"verified":false}]'::jsonb, 16000, 8700, 0.099, 'Local micro fit', 150, 360, 'USD', 'SAFE', 'AVAILABLE', 90, true, 'DEMO', true)
) as rows
where (select id from demo_workspace) is not null
on conflict (id) do update
set
  workspace_id = excluded.workspace_id,
  display_name = excluded.display_name,
  handle = excluded.handle,
  bio = excluded.bio,
  profile_image_url = excluded.profile_image_url,
  location = excluded.location,
  niches = excluded.niches,
  platforms = excluded.platforms,
  follower_count = excluded.follower_count,
  average_views = excluded.average_views,
  engagement_rate = excluded.engagement_rate,
  audience_summary = excluded.audience_summary,
  estimated_rate_min = excluded.estimated_rate_min,
  estimated_rate_max = excluded.estimated_rate_max,
  currency = excluded.currency,
  brand_safety_status = excluded.brand_safety_status,
  availability_status = excluded.availability_status,
  match_score = excluded.match_score,
  saved = excluded.saved,
  source = excluded.source,
  is_demo = excluded.is_demo,
  updated_at = now();

with demo_workspace as (
  select id from public.workspaces where lower(name) like '%demo%' order by created_at asc limit 1
)
insert into public.creator_campaigns (
  id, workspace_id, name, goal, status, description, budget, currency, start_date, end_date,
  product_ids, creator_ids, platforms, deliverables, approval_required, tracking_method, created_by, is_demo
)
select * from (
  values
  ('cc_001', (select id from demo_workspace), 'Jerky Summer Trail Challenge', 'Drive product trial', 'ACTIVE', 'Demo campaign', 18000, 'USD', '2026-07-20', '2026-09-10', '{prod_trail_pack}', '{cr_002,cr_013,cr_021}', '{TikTok,Instagram,YouTube}', '{3 Reels,4 TikTok videos,1 YouTube recap}', true, 'UTM_LINK_PLACEHOLDER', null, true),
  ('cc_002', (select id from demo_workspace), 'Fuel Your Workday', 'Increase B2B snack box awareness', 'RECRUITING', 'Demo campaign', 9500, 'USD', '2026-08-10', '2026-09-20', '{prod_office_box}', '{cr_005,cr_009,cr_017}', '{LinkedIn,Instagram}', '{2 LinkedIn posts,3 short videos}', true, 'PROMO_CODE_PLACEHOLDER', null, true),
  ('cc_003', (select id from demo_workspace), 'Local Retail Weekend', 'Increase foot traffic', 'CONTENT_REVIEW', 'Demo campaign', 6000, 'USD', '2026-07-29', '2026-08-22', '{prod_sampler}', '{cr_010,cr_016,cr_025}', '{TikTok,Instagram}', '{6 local short videos}', true, 'STORE_CODE_PLACEHOLDER', null, true),
  ('cc_004', (select id from demo_workspace), 'Protein Focus Month', 'Expand fitness vertical awareness', 'DRAFT', 'Demo campaign', 12000, 'USD', '2026-09-01', '2026-10-05', '{prod_protein}', '{cr_007,cr_011,cr_020}', '{Instagram,YouTube,TikTok}', '{4 recipe videos,2 routines,5 short clips}', true, 'LANDING_LINK_PLACEHOLDER', null, true),
  ('cc_005', (select id from demo_workspace), 'Flavor Drop Tech Launch', 'Promote flavor drop', 'SCHEDULED', 'Demo campaign', 14000, 'USD', '2026-08-05', '2026-09-01', '{prod_flavor_drop}', '{cr_012,cr_019,cr_023}', '{YouTube,LinkedIn,Instagram}', '{3 preview videos,2 thought-leadership posts}', true, 'TRACKING_CODE_PLACEHOLDER', null, true)
) as rows
where (select id from demo_workspace) is not null
on conflict (id) do update
set
  workspace_id = excluded.workspace_id,
  name = excluded.name,
  goal = excluded.goal,
  status = excluded.status,
  description = excluded.description,
  budget = excluded.budget,
  currency = excluded.currency,
  start_date = excluded.start_date,
  end_date = excluded.end_date,
  product_ids = excluded.product_ids,
  creator_ids = excluded.creator_ids,
  platforms = excluded.platforms,
  deliverables = excluded.deliverables,
  approval_required = excluded.approval_required,
  tracking_method = excluded.tracking_method,
  is_demo = excluded.is_demo,
  updated_at = now();

with demo_workspace as (
  select id from public.workspaces where lower(name) like '%demo%' order by created_at asc limit 1
)
insert into public.creator_pipeline_records (
  id, workspace_id, creator_id, stage, assigned_user_id, campaign_id, next_action, next_action_at, notes
)
select * from (
  values
  ('cp_001', (select id from demo_workspace), 'cr_001', 'SAVED', null, null, 'Send intro brief', '2026-08-02T16:00:00Z', 'Demo record'),
  ('cp_002', (select id from demo_workspace), 'cr_002', 'NEGOTIATING', null, 'cc_001', 'Counter deliverable package', '2026-08-03T18:00:00Z', 'Demo record'),
  ('cp_003', (select id from demo_workspace), 'cr_003', 'AI_RECOMMENDED', null, null, 'Review brand safety note', '2026-08-04T18:00:00Z', null),
  ('cp_004', (select id from demo_workspace), 'cr_005', 'CONTACTED', null, 'cc_002', 'Follow up with audience deck', '2026-08-02T14:30:00Z', null),
  ('cp_005', (select id from demo_workspace), 'cr_006', 'INTERESTED', null, 'cc_003', 'Share legal terms', '2026-08-03T12:00:00Z', null),
  ('cp_006', (select id from demo_workspace), 'cr_007', 'DISCOVERED', null, null, 'Assess product fit', '2026-08-05T11:00:00Z', null),
  ('cp_007', (select id from demo_workspace), 'cr_010', 'CONTENT_REVIEW', null, 'cc_003', 'Approve revision', '2026-08-01T22:00:00Z', null),
  ('cp_008', (select id from demo_workspace), 'cr_011', 'CAMPAIGN_ACTIVE', null, 'cc_004', 'Review week-1 metrics', '2026-08-07T16:00:00Z', null),
  ('cp_009', (select id from demo_workspace), 'cr_012', 'AGREEMENT_PENDING', null, 'cc_005', 'Confirm usage rights', '2026-08-02T19:00:00Z', null),
  ('cp_010', (select id from demo_workspace), 'cr_013', 'CAMPAIGN_ACTIVE', null, 'cc_001', 'Check first post draft', '2026-08-03T15:00:00Z', null),
  ('cp_011', (select id from demo_workspace), 'cr_016', 'PUBLISHED', null, 'cc_003', 'Evaluate local store lift', '2026-08-08T14:00:00Z', null),
  ('cp_012', (select id from demo_workspace), 'cr_020', 'CONTENT_PRODUCTION', null, 'cc_004', 'Collect raw footage', '2026-08-02T17:30:00Z', null),
  ('cp_013', (select id from demo_workspace), 'cr_021', 'SAVED', null, null, 'Invite to trail challenge', '2026-08-05T17:30:00Z', null),
  ('cp_014', (select id from demo_workspace), 'cr_023', 'COMPLETED', null, 'cc_005', 'Plan ambassador proposal', '2026-08-11T17:30:00Z', null),
  ('cp_015', (select id from demo_workspace), 'cr_024', 'DECLINED', null, null, null, null, 'Safety restricted')
) as rows
where (select id from demo_workspace) is not null
on conflict (id) do update
set
  workspace_id = excluded.workspace_id,
  creator_id = excluded.creator_id,
  stage = excluded.stage,
  assigned_user_id = excluded.assigned_user_id,
  campaign_id = excluded.campaign_id,
  next_action = excluded.next_action,
  next_action_at = excluded.next_action_at,
  notes = excluded.notes,
  updated_at = now();

with demo_workspace as (
  select id from public.workspaces where lower(name) like '%demo%' order by created_at asc limit 1
)
insert into public.creator_submissions (
  id, workspace_id, creator_id, campaign_id, status, asset_type, title, content_url, text_body, supporting_notes,
  submitted_at, reviewed_at, reviewed_by, is_demo
)
select * from (
  values
  ('cs_001', (select id from demo_workspace), 'cr_013', 'cc_001', 'SUBMITTED', 'VIDEO', 'Trail snack opener', 'https://example.com/demo/cs_001.mp4', null, 'Demo workspace data', now(), null, null, true),
  ('cs_002', (select id from demo_workspace), 'cr_002', 'cc_001', 'IN_REVIEW', 'SCRIPT', 'Day hike script', null, 'Script draft for TikTok post', 'Demo workspace data', now(), null, null, true),
  ('cs_003', (select id from demo_workspace), 'cr_010', 'cc_003', 'REVISION_REQUESTED', 'THUMBNAIL', 'Local promo thumbnail', 'https://example.com/demo/cs_003.jpg', null, 'Need product logo placement', now(), now(), null, true),
  ('cs_004', (select id from demo_workspace), 'cr_016', 'cc_003', 'APPROVED', 'VIDEO', 'Weekend store visit', 'https://example.com/demo/cs_004.mp4', null, 'Approved as demo', now(), now(), null, true),
  ('cs_005', (select id from demo_workspace), 'cr_011', 'cc_004', 'SCHEDULED', 'CAPTION', 'Protein prep caption', null, 'Caption for recipe post', 'Demo workspace data', now(), now(), null, true),
  ('cs_006', (select id from demo_workspace), 'cr_006', 'cc_003', 'PUBLISHED', 'VIDEO', 'City bites collab', 'https://example.com/demo/cs_006.mp4', null, 'Demo workspace data', now(), now(), null, true),
  ('cs_007', (select id from demo_workspace), 'cr_005', 'cc_002', 'SUBMITTED', 'STORY_CONCEPT', 'Desk snack stories', null, 'LinkedIn story concept', 'Demo workspace data', now(), null, null, true),
  ('cs_008', (select id from demo_workspace), 'cr_019', 'cc_005', 'IN_REVIEW', 'IMAGE', 'Flavor drop teaser', 'https://example.com/demo/cs_008.jpg', null, 'Demo workspace data', now(), null, null, true),
  ('cs_009', (select id from demo_workspace), 'cr_020', 'cc_004', 'APPROVED', 'VIDEO', 'Mindful fuel walkthrough', 'https://example.com/demo/cs_009.mp4', null, 'Demo workspace data', now(), now(), null, true),
  ('cs_010', (select id from demo_workspace), 'cr_023', 'cc_005', 'APPROVED', 'CAPTION', 'Founder post draft', null, 'Founder release post', 'Demo workspace data', now(), now(), null, true),
  ('cs_011', (select id from demo_workspace), 'cr_025', 'cc_003', 'REJECTED', 'THUMBNAIL', 'Local splash card', 'https://example.com/demo/cs_011.jpg', null, 'Brand mismatch', now(), now(), null, true),
  ('cs_012', (select id from demo_workspace), 'cr_001', 'cc_001', 'ARCHIVED', 'IMAGE', 'Archived prep shot', 'https://example.com/demo/cs_012.jpg', null, 'Archived demo sample', now(), now(), null, true)
) as rows
where (select id from demo_workspace) is not null
on conflict (id) do update
set
  workspace_id = excluded.workspace_id,
  creator_id = excluded.creator_id,
  campaign_id = excluded.campaign_id,
  status = excluded.status,
  asset_type = excluded.asset_type,
  title = excluded.title,
  content_url = excluded.content_url,
  text_body = excluded.text_body,
  supporting_notes = excluded.supporting_notes,
  submitted_at = excluded.submitted_at,
  reviewed_at = excluded.reviewed_at,
  reviewed_by = excluded.reviewed_by,
  is_demo = excluded.is_demo,
  updated_at = now();

with demo_workspace as (
  select id from public.workspaces where lower(name) like '%demo%' order by created_at asc limit 1
)
insert into public.creator_ugc_assets (
  id, workspace_id, creator_id, campaign_id, product_id, platform, asset_type, title, tags,
  usage_rights_start, usage_rights_end, approval_status, performance_metrics, media_library_asset_id, is_demo
)
select
  'cu_' || lpad(idx::text, 3, '0'),
  (select id from demo_workspace),
  ('cr_' || lpad((((idx - 1) % 25) + 1)::text, 3, '0')),
  ('cc_' || lpad((((idx - 1) % 5) + 1)::text, 3, '0')),
  case when idx % 2 = 0 then 'prod_trail_pack' else 'prod_sampler' end,
  case when idx % 3 = 0 then 'TikTok' when idx % 3 = 1 then 'Instagram' else 'YouTube' end,
  case when idx % 2 = 0 then 'VIDEO' else 'IMAGE' end,
  'Approved UGC Asset ' || idx,
  array['demo','creator', case when idx % 2 = 0 then 'video' else 'image' end],
  '2026-08-01'::date,
  case when idx % 5 = 0 then '2026-09-01'::date else '2026-12-31'::date end,
  'APPROVED',
  case when idx <= 8 then jsonb_build_object('reach', 3000 + idx * 420, 'impressions', 4200 + idx * 610, 'engagement', 240 + idx * 35, 'clicks', 90 + idx * 11, 'conversions', 7 + idx) else null end,
  null,
  true
from generate_series(1, 20) as idx
where (select id from demo_workspace) is not null
on conflict (id) do update
set
  workspace_id = excluded.workspace_id,
  creator_id = excluded.creator_id,
  campaign_id = excluded.campaign_id,
  product_id = excluded.product_id,
  platform = excluded.platform,
  asset_type = excluded.asset_type,
  title = excluded.title,
  tags = excluded.tags,
  usage_rights_start = excluded.usage_rights_start,
  usage_rights_end = excluded.usage_rights_end,
  approval_status = excluded.approval_status,
  performance_metrics = excluded.performance_metrics,
  media_library_asset_id = excluded.media_library_asset_id,
  is_demo = excluded.is_demo,
  updated_at = now();

with demo_workspace as (
  select id from public.workspaces where lower(name) like '%demo%' order by created_at asc limit 1
)
insert into public.creator_activity_events (
  id, workspace_id, actor_user_id, event_type, entity_type, entity_id, summary, metadata, is_demo
)
select * from (
  values
  ('ca_001', (select id from demo_workspace), null, 'CREATOR_SAVED', 'creator', 'cr_001', 'Creator saved from discover list.', '{"demo":true}'::jsonb, true),
  ('ca_002', (select id from demo_workspace), null, 'CAMPAIGN_CREATED', 'creator_campaign', 'cc_004', 'Creator campaign created.', '{"demo":true}'::jsonb, true),
  ('ca_003', (select id from demo_workspace), null, 'CONTENT_SUBMITTED', 'creator_submission', 'cs_001', 'Creator submitted content.', '{"demo":true}'::jsonb, true),
  ('ca_004', (select id from demo_workspace), null, 'CONTENT_APPROVED', 'creator_submission', 'cs_004', 'Creator content approved.', '{"demo":true}'::jsonb, true),
  ('ca_005', (select id from demo_workspace), null, 'CREATOR_STAGE_MOVED', 'creator_pipeline', 'cp_002', 'Creator moved to negotiating.', '{"demo":true,"from":"INTERESTED","to":"NEGOTIATING"}'::jsonb, true),
  ('ca_006', (select id from demo_workspace), null, 'UGC_ADDED', 'creator_ugc_asset', 'cu_001', 'Approved creator asset added to UGC library.', '{"demo":true}'::jsonb, true)
) as rows
where (select id from demo_workspace) is not null
on conflict (id) do update
set
  workspace_id = excluded.workspace_id,
  actor_user_id = excluded.actor_user_id,
  event_type = excluded.event_type,
  entity_type = excluded.entity_type,
  entity_id = excluded.entity_id,
  summary = excluded.summary,
  metadata = excluded.metadata,
  is_demo = excluded.is_demo;

with demo_workspace as (
  select id from public.workspaces where lower(name) like '%demo%' order by created_at asc limit 1
)
insert into public.creator_metric_snapshots (
  id, workspace_id, period_start, period_end, measured, estimated, is_demo
)
select
  'cm_001',
  (select id from demo_workspace),
  '2026-07-01'::date,
  '2026-07-31'::date,
  '{"activeCampaigns":4,"creatorsEngaged":14,"contentSubmitted":12,"contentApproved":6,"publishedAssets":1,"reach":148000,"impressions":251000,"engagement":13200,"clicks":4100,"conversions":390,"revenue":null,"campaignSpend":22450,"costPerEngagement":1.7,"costPerAcquisition":57.56,"creatorRoi":null}'::jsonb,
  '{"campaignSpend":24000}'::jsonb,
  true
where (select id from demo_workspace) is not null
on conflict (id) do update
set
  workspace_id = excluded.workspace_id,
  period_start = excluded.period_start,
  period_end = excluded.period_end,
  measured = excluded.measured,
  estimated = excluded.estimated,
  is_demo = excluded.is_demo,
  created_at = now();

commit;
