begin;

alter table public.video_projects
  add column if not exists routing_tier text not null default 'BALANCED',
  add column if not exists provider_model text not null default 'sora-2';

alter table public.video_projects
  alter column provider set default 'OPENAI';

alter table public.video_projects
  drop constraint if exists video_projects_duration_seconds_check;

-- Legacy rows may still include previously supported 16/20-second durations.
alter table public.video_projects
  add constraint video_projects_duration_seconds_check
  check (duration_seconds between 8 and 15)
  not valid;

alter table public.video_projects
  drop constraint if exists video_projects_channel_check;

alter table public.video_projects
  add constraint video_projects_channel_check
  check (channel in ('TikTok', 'Instagram Reels', 'Facebook Reels', 'YouTube Shorts'));

alter table public.video_projects
  drop constraint if exists video_projects_routing_tier_check;

alter table public.video_projects
  add constraint video_projects_routing_tier_check
  check (routing_tier in ('ECONOMY', 'BALANCED', 'PREMIUM'));

create index if not exists video_projects_routing_tier_idx
  on public.video_projects(routing_tier, created_at desc);
create index if not exists video_projects_provider_model_idx
  on public.video_projects(provider_model, created_at desc);

update public.video_projects
set
  routing_tier = coalesce(routing_tier, 'BALANCED'),
  provider_model = coalesce(provider_model, 'sora-2');

insert into public.system_settings (
  key,
  value,
  category,
  description,
  is_secret
)
values
  ('video_generation_mode', '"auto"'::jsonb, 'video', 'Controls whether video generation uses auto, economy, balanced, premium, or disabled routing.', false),
  ('video_router_default_tier', '"balanced"'::jsonb, 'video', 'Default tier used when the router runs in auto mode.', false),
  ('video_router_economy_model', '"sora-2"'::jsonb, 'video', 'Economy video model identifier kept server-side.', false),
  ('video_router_balanced_model', '"sora-2-pro"'::jsonb, 'video', 'Balanced video model identifier kept server-side.', false),
  ('video_router_premium_model', '"sora-2-pro"'::jsonb, 'video', 'Premium video model identifier kept server-side.', false),
  ('video_router_economy_cost_cents_per_second', '45'::jsonb, 'video', 'Estimated provider cost per second for the economy route.', false),
  ('video_router_balanced_cost_cents_per_second', '70'::jsonb, 'video', 'Estimated provider cost per second for the balanced route.', false),
  ('video_router_premium_cost_cents_per_second', '110'::jsonb, 'video', 'Estimated provider cost per second for the premium route.', false),
  ('video_router_max_retries', '2'::jsonb, 'video', 'Maximum provider retry attempts for a render job.', false),
  ('video_router_emergency_disabled', 'false'::jsonb, 'video', 'Global kill switch for the video router.', false)
on conflict (key) do update
set
  value = excluded.value,
  category = excluded.category,
  description = excluded.description,
  is_secret = excluded.is_secret,
  updated_at = now();

commit;