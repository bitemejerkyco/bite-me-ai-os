begin;

create table if not exists public.content_knowledge (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  scheduled_post_id uuid not null references public.scheduled_posts(id) on delete cascade,
  performance_snapshot_id uuid references public.content_performance_snapshots(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete cascade,
  entry_type text not null check (entry_type in ('POST', 'AD')),
  channel text not null,
  title text not null,
  content text not null,
  score integer not null check (score between 0 and 100),
  grade text not null check (grade in ('A', 'B', 'C', 'D')),
  confidence text not null check (confidence in ('LOW', 'MEDIUM', 'HIGH')),
  strengths text[] not null default '{}',
  score_version text not null default 'postmotive-score-v1',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (scheduled_post_id)
);

create index if not exists content_knowledge_workspace_score_idx
  on public.content_knowledge(workspace_id, active, score desc);

drop trigger if exists content_knowledge_set_updated_at on public.content_knowledge;
create trigger content_knowledge_set_updated_at
before update on public.content_knowledge
for each row execute function public.set_updated_at();

alter table public.content_knowledge enable row level security;

create policy "content_knowledge_select_member" on public.content_knowledge
for select to authenticated using (public.is_workspace_member(workspace_id));

create policy "content_knowledge_insert_actor" on public.content_knowledge
for insert to authenticated with check (
  public.is_workspace_member(workspace_id)
  and created_by = (select auth.uid())
);

create policy "content_knowledge_update_member" on public.content_knowledge
for update to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

create policy "content_knowledge_delete_member" on public.content_knowledge
for delete to authenticated using (public.is_workspace_member(workspace_id));

grant select, insert, update, delete on public.content_knowledge to authenticated;
grant all on public.content_knowledge to service_role;

commit;
