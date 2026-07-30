begin;

create table if not exists public.scheduled_posts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  content_draft_id uuid references public.content_drafts(id) on delete set null,
  entry_type text not null default 'POST'
    check (entry_type in ('POST', 'AD')),
  channel text not null
    check (channel in ('TikTok', 'Instagram', 'Facebook', 'LinkedIn', 'Email', 'SMS')),
  title text not null,
  content text not null,
  scheduled_for timestamptz not null,
  timezone text not null default 'UTC',
  status text not null default 'SCHEDULED'
    check (status in (
      'DRAFT',
      'PENDING_APPROVAL',
      'SCHEDULED',
      'PUBLISHING',
      'PUBLISHED',
      'FAILED',
      'CANCELED'
    )),
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  provider_job_id text,
  failure_reason text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    entry_type <> 'AD'
    or status in ('DRAFT', 'PENDING_APPROVAL', 'CANCELED')
    or approved_at is not null
  )
);

create index if not exists scheduled_posts_workspace_time_idx
  on public.scheduled_posts(workspace_id, scheduled_for asc);
create index if not exists scheduled_posts_due_idx
  on public.scheduled_posts(status, scheduled_for asc)
  where status = 'SCHEDULED';

drop trigger if exists scheduled_posts_set_updated_at on public.scheduled_posts;
create trigger scheduled_posts_set_updated_at
before update on public.scheduled_posts
for each row execute function public.set_updated_at();

alter table public.scheduled_posts enable row level security;

create policy "scheduled_posts_select_member" on public.scheduled_posts
for select to authenticated using (public.is_workspace_member(workspace_id));

create policy "scheduled_posts_insert_member" on public.scheduled_posts
for insert to authenticated with check (
  public.is_workspace_member(workspace_id)
  and created_by = (select auth.uid())
);

create policy "scheduled_posts_update_member" on public.scheduled_posts
for update to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

create policy "scheduled_posts_delete_member" on public.scheduled_posts
for delete to authenticated using (public.is_workspace_member(workspace_id));

grant select, insert, update, delete on public.scheduled_posts to authenticated;
grant all on public.scheduled_posts to service_role;

commit;
