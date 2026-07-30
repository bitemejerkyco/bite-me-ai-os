begin;

create table if not exists public.ai_generation_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  entry_type text not null check (entry_type in ('POST', 'AD')),
  channel text not null,
  objective text not null,
  model text not null,
  prompt_version text not null,
  generated_copy text not null,
  compliance_note text,
  created_at timestamptz not null default now()
);

alter table public.content_drafts
add column if not exists generation_run_id uuid
references public.ai_generation_runs(id) on delete set null;

alter table public.content_drafts
add column if not exists original_copy text;

alter table public.content_drafts
add column if not exists model text;

alter table public.content_drafts
add column if not exists prompt_version text;

create table if not exists public.content_feedback (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  draft_id uuid references public.content_drafts(id) on delete set null,
  generation_run_id uuid references public.ai_generation_runs(id) on delete set null,
  scheduled_post_id uuid references public.scheduled_posts(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete cascade,
  signal text not null check (signal in (
    'POSITIVE',
    'NEGATIVE',
    'EDITED',
    'APPROVED',
    'REJECTED',
    'PUBLISH_SUCCEEDED',
    'PUBLISH_FAILED'
  )),
  reason text not null default '',
  notes text not null default '',
  original_copy text,
  final_copy text,
  entry_type text not null check (entry_type in ('POST', 'AD')),
  channel text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.content_performance_snapshots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  scheduled_post_id uuid not null references public.scheduled_posts(id) on delete cascade,
  source text not null check (source in ('PROVIDER', 'MANUAL')),
  impressions bigint not null default 0 check (impressions >= 0),
  reach bigint not null default 0 check (reach >= 0),
  engagements bigint not null default 0 check (engagements >= 0),
  clicks bigint not null default 0 check (clicks >= 0),
  conversions numeric(14, 4) not null default 0 check (conversions >= 0),
  revenue numeric(14, 2) not null default 0 check (revenue >= 0),
  spend numeric(14, 2) not null default 0 check (spend >= 0),
  currency text not null default 'USD',
  recorded_at timestamptz not null default now()
);

create index if not exists ai_generation_runs_workspace_created_idx
  on public.ai_generation_runs(workspace_id, created_at desc);
create index if not exists content_feedback_workspace_created_idx
  on public.content_feedback(workspace_id, created_at desc);
create index if not exists content_feedback_draft_idx
  on public.content_feedback(draft_id, created_at desc);
create index if not exists content_performance_post_recorded_idx
  on public.content_performance_snapshots(scheduled_post_id, recorded_at desc);

alter table public.ai_generation_runs enable row level security;
alter table public.content_feedback enable row level security;
alter table public.content_performance_snapshots enable row level security;

create policy "generation_runs_select_member" on public.ai_generation_runs
for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "generation_runs_insert_actor" on public.ai_generation_runs
for insert to authenticated with check (
  public.is_workspace_member(workspace_id)
  and created_by = (select auth.uid())
);

create policy "content_feedback_select_member" on public.content_feedback
for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "content_feedback_insert_actor" on public.content_feedback
for insert to authenticated with check (
  public.is_workspace_member(workspace_id)
  and created_by = (select auth.uid())
);

create policy "performance_select_member" on public.content_performance_snapshots
for select to authenticated using (public.is_workspace_member(workspace_id));

grant select, insert on public.ai_generation_runs to authenticated;
grant select, insert on public.content_feedback to authenticated;
grant select on public.content_performance_snapshots to authenticated;
grant all on public.ai_generation_runs to service_role;
grant all on public.content_feedback to service_role;
grant all on public.content_performance_snapshots to service_role;

commit;
