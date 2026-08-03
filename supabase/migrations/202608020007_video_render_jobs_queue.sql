begin;

create table if not exists public.video_render_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.video_projects(id) on delete cascade,
  workflow_key text not null,
  provider text not null check (provider in ('OPENAI', 'REPLICATE', 'INTERNAL')),
  status text not null check (status in ('queued', 'claimed', 'in_progress', 'retrying', 'completed', 'failed', 'cancelled')),
  attempt integer not null default 1 check (attempt >= 1),
  progress_percent integer not null default 0 check (progress_percent between 0 and 100),
  provider_job_id text,
  output_url text,
  failure_code text,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists video_render_jobs_workspace_workflow_unique
  on public.video_render_jobs(workspace_id, workflow_key);

create index if not exists video_render_jobs_workspace_status_created_idx
  on public.video_render_jobs(workspace_id, status, created_at asc);

drop trigger if exists video_render_jobs_set_updated_at on public.video_render_jobs;
create trigger video_render_jobs_set_updated_at
before update on public.video_render_jobs
for each row execute function public.set_updated_at();

alter table public.video_render_jobs enable row level security;

create policy "video_render_jobs_select_member" on public.video_render_jobs
for select to authenticated using (public.is_workspace_member(workspace_id));

create policy "video_render_jobs_insert_member" on public.video_render_jobs
for insert to authenticated with check (public.is_workspace_member(workspace_id));

create policy "video_render_jobs_update_member" on public.video_render_jobs
for update to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

create policy "video_render_jobs_delete_member" on public.video_render_jobs
for delete to authenticated using (public.is_workspace_member(workspace_id));

grant select, insert, update, delete on public.video_render_jobs to authenticated;
grant all on public.video_render_jobs to service_role;

commit;
