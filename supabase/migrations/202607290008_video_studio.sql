begin;

create table if not exists public.video_projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  content_draft_id uuid references public.content_drafts(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete cascade,
  title text not null,
  channel text not null check (channel in ('TikTok', 'Instagram Reels', 'YouTube Shorts')),
  objective text not null,
  prompt text not null,
  script text not null,
  caption text not null default '',
  scenes jsonb not null default '[]'::jsonb,
  duration_seconds integer not null check (duration_seconds in (8, 16, 20)),
  aspect_ratio text not null default '9:16' check (aspect_ratio = '9:16'),
  voice text not null check (voice in ('marin', 'cedar', 'coral', 'verse', 'alloy')),
  voice_disclosure boolean not null default true,
  music_mode text not null check (music_mode in ('GENERATED_AMBIENT', 'LICENSED_LIBRARY', 'NONE')),
  licensed_music_asset_id uuid references public.media_assets(id) on delete set null,
  provider text not null default 'OPENAI_SORA_TEMPORARY',
  provider_job_id text,
  provider_progress integer check (provider_progress between 0 and 100),
  video_storage_path text,
  voiceover_storage_path text,
  status text not null default 'DRAFT'
    check (status in ('DRAFT', 'GENERATING', 'READY', 'FAILED', 'APPROVED')),
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists video_projects_workspace_created_idx
  on public.video_projects(workspace_id, created_at desc);
create unique index if not exists video_projects_provider_job_idx
  on public.video_projects(provider_job_id) where provider_job_id is not null;

drop trigger if exists video_projects_set_updated_at on public.video_projects;
create trigger video_projects_set_updated_at
before update on public.video_projects
for each row execute function public.set_updated_at();

alter table public.video_projects enable row level security;

create policy "video_projects_select_member" on public.video_projects
for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "video_projects_insert_actor" on public.video_projects
for insert to authenticated with check (
  public.is_workspace_member(workspace_id)
  and created_by = (select auth.uid())
);
create policy "video_projects_update_member" on public.video_projects
for update to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));
create policy "video_projects_delete_member" on public.video_projects
for delete to authenticated using (public.is_workspace_member(workspace_id));

grant select, insert, update, delete on public.video_projects to authenticated;
grant all on public.video_projects to service_role;

alter table public.content_drafts
  add column if not exists content_format text not null default 'STATIC'
    check (content_format in ('STATIC', 'VERTICAL_VIDEO')),
  add column if not exists video_project_id uuid references public.video_projects(id) on delete set null,
  add column if not exists media_storage_path text;

alter table public.scheduled_posts
  add column if not exists video_project_id uuid references public.video_projects(id) on delete set null,
  add column if not exists media_storage_path text;

create index if not exists content_drafts_video_project_idx
  on public.content_drafts(video_project_id) where video_project_id is not null;
create index if not exists scheduled_posts_video_project_idx
  on public.scheduled_posts(video_project_id) where video_project_id is not null;

commit;
