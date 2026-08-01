begin;

create table if not exists public.marketing_director_memory_signals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  signal_key text not null
    check (signal_key in (
      'content_style_preference',
      'approval_pattern',
      'best_product_line',
      'best_creative_format',
      'email_subject_preference',
      'engagement_peak_day',
      'cross_channel_reuse_bias'
    )),
  insight text not null check (char_length(trim(insight)) between 3 and 600),
  confidence numeric(4, 3) not null default 0.5 check (confidence >= 0 and confidence <= 1),
  source text not null default 'system',
  last_observed_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, signal_key)
);

create index if not exists marketing_director_memory_workspace_updated_idx
  on public.marketing_director_memory_signals(workspace_id, updated_at desc);

alter table public.marketing_director_memory_signals enable row level security;

drop policy if exists "marketing_director_memory_select_member_or_super_admin" on public.marketing_director_memory_signals;
create policy "marketing_director_memory_select_member_or_super_admin"
on public.marketing_director_memory_signals
for select to authenticated
using (
  public.is_super_admin() or public.current_user_belongs_to_account(workspace_id)
);

drop policy if exists "marketing_director_memory_insert_member_or_super_admin" on public.marketing_director_memory_signals;
create policy "marketing_director_memory_insert_member_or_super_admin"
on public.marketing_director_memory_signals
for insert to authenticated
with check (
  public.is_super_admin() or public.current_user_belongs_to_account(workspace_id)
);

drop policy if exists "marketing_director_memory_update_member_or_super_admin" on public.marketing_director_memory_signals;
create policy "marketing_director_memory_update_member_or_super_admin"
on public.marketing_director_memory_signals
for update to authenticated
using (
  public.is_super_admin() or public.current_user_belongs_to_account(workspace_id)
)
with check (
  public.is_super_admin() or public.current_user_belongs_to_account(workspace_id)
);

grant select, insert, update on public.marketing_director_memory_signals to authenticated;
grant all on public.marketing_director_memory_signals to service_role;

drop trigger if exists marketing_director_memory_set_updated_at on public.marketing_director_memory_signals;
create trigger marketing_director_memory_set_updated_at
before update on public.marketing_director_memory_signals
for each row execute function public.set_updated_at();

commit;
