begin;

create table if not exists public.video_project_versions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  video_project_id uuid not null references public.video_projects(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  asset_kind text not null check (asset_kind in ('VIDEO', 'VOICEOVER')),
  version_number integer not null check (version_number > 0),
  provider_job_id text,
  storage_path text not null,
  prompt text not null default '',
  voice text check (voice is null or voice in ('marin', 'cedar', 'coral', 'verse', 'alloy')),
  voice_instructions text,
  created_at timestamptz not null default now(),
  unique (video_project_id, asset_kind, version_number)
);

create index if not exists video_project_versions_project_idx
  on public.video_project_versions(video_project_id, asset_kind, version_number desc);

alter table public.video_project_versions enable row level security;

create policy "video_project_versions_select_member" on public.video_project_versions
for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "video_project_versions_insert_actor" on public.video_project_versions
for insert to authenticated with check (
  public.is_workspace_member(workspace_id)
  and created_by = (select auth.uid())
);
create policy "video_project_versions_update_member" on public.video_project_versions
for update to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));
create policy "video_project_versions_delete_member" on public.video_project_versions
for delete to authenticated using (public.is_workspace_member(workspace_id));

grant select, insert, update, delete on public.video_project_versions to authenticated;
grant all on public.video_project_versions to service_role;

commit;
