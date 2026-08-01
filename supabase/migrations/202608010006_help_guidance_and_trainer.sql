begin;

create table if not exists public.user_help_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  help_mode text not null default 'AUTO'
    check (help_mode in ('ON', 'OFF', 'AUTO')),
  compact_panels boolean not null default false,
  proactive_trainer_enabled boolean not null default true,
  dismissed_help_topics text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.help_walkthrough_progress (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  walkthrough_id text not null,
  walkthrough_version text not null default '1',
  status text not null default 'NOT_STARTED'
    check (status in ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED')),
  current_step_index integer not null default 0,
  last_route text,
  started_at timestamptz,
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id, walkthrough_id)
);

create table if not exists public.academy_lesson_progress (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id text not null,
  status text not null default 'NOT_STARTED'
    check (status in ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED')),
  completion_percentage integer not null default 0
    check (completion_percentage >= 0 and completion_percentage <= 100),
  last_step_index integer not null default 0,
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id, lesson_id)
);

create table if not exists public.help_trainer_prompt_dismissals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  prompt_key text not null,
  route text not null,
  dismissed_until timestamptz,
  dont_show_again boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id, prompt_key, route)
);

create table if not exists public.help_feedback_submissions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null
    check (category in ('BUG_REPORT', 'FEATURE_REQUEST', 'GENERAL_FEEDBACK', 'CONFUSING_INSTRUCTIONS', 'MISSING_HELP_TOPIC')),
  route text not null,
  browser_version text,
  app_version text,
  description text not null,
  screenshot_url text,
  status text not null default 'OPEN'
    check (status in ('OPEN', 'IN_REVIEW', 'CLOSED')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists help_walkthrough_progress_workspace_user_idx
  on public.help_walkthrough_progress(workspace_id, user_id, status, updated_at desc);
create index if not exists academy_lesson_progress_workspace_user_idx
  on public.academy_lesson_progress(workspace_id, user_id, status, updated_at desc);
create index if not exists help_trainer_prompt_dismissals_workspace_user_idx
  on public.help_trainer_prompt_dismissals(workspace_id, user_id, route, updated_at desc);
create index if not exists help_feedback_submissions_workspace_status_idx
  on public.help_feedback_submissions(workspace_id, status, created_at desc);
create index if not exists help_feedback_submissions_user_idx
  on public.help_feedback_submissions(user_id, created_at desc);

alter table public.user_help_preferences enable row level security;
alter table public.help_walkthrough_progress enable row level security;
alter table public.academy_lesson_progress enable row level security;
alter table public.help_trainer_prompt_dismissals enable row level security;
alter table public.help_feedback_submissions enable row level security;

drop policy if exists "user_help_preferences_self_access" on public.user_help_preferences;
create policy "user_help_preferences_self_access"
on public.user_help_preferences
for all to authenticated
using (user_id = auth.uid() or public.is_super_admin())
with check (user_id = auth.uid() or public.is_super_admin());

drop policy if exists "help_walkthrough_progress_self_access" on public.help_walkthrough_progress;
create policy "help_walkthrough_progress_self_access"
on public.help_walkthrough_progress
for all to authenticated
using (
  (
    user_id = auth.uid()
    and public.current_user_belongs_to_account(workspace_id)
  )
  or public.is_super_admin()
)
with check (
  (
    user_id = auth.uid()
    and public.current_user_belongs_to_account(workspace_id)
  )
  or public.is_super_admin()
);

drop policy if exists "academy_lesson_progress_self_access" on public.academy_lesson_progress;
create policy "academy_lesson_progress_self_access"
on public.academy_lesson_progress
for all to authenticated
using (
  (
    user_id = auth.uid()
    and public.current_user_belongs_to_account(workspace_id)
  )
  or public.is_super_admin()
)
with check (
  (
    user_id = auth.uid()
    and public.current_user_belongs_to_account(workspace_id)
  )
  or public.is_super_admin()
);

drop policy if exists "help_trainer_prompt_dismissals_self_access" on public.help_trainer_prompt_dismissals;
create policy "help_trainer_prompt_dismissals_self_access"
on public.help_trainer_prompt_dismissals
for all to authenticated
using (
  (
    user_id = auth.uid()
    and public.current_user_belongs_to_account(workspace_id)
  )
  or public.is_super_admin()
)
with check (
  (
    user_id = auth.uid()
    and public.current_user_belongs_to_account(workspace_id)
  )
  or public.is_super_admin()
);

drop policy if exists "help_feedback_submissions_self_access" on public.help_feedback_submissions;
create policy "help_feedback_submissions_self_access"
on public.help_feedback_submissions
for select to authenticated
using (
  user_id = auth.uid()
  or public.is_super_admin()
  or (
    workspace_id is not null
    and public.current_user_belongs_to_account(workspace_id)
    and user_id = auth.uid()
  )
);

drop policy if exists "help_feedback_submissions_insert" on public.help_feedback_submissions;
create policy "help_feedback_submissions_insert"
on public.help_feedback_submissions
for insert to authenticated
with check (
  user_id = auth.uid()
  and (
    workspace_id is null
    or public.current_user_belongs_to_account(workspace_id)
    or public.is_super_admin()
  )
);

drop policy if exists "help_feedback_submissions_super_admin_update" on public.help_feedback_submissions;
create policy "help_feedback_submissions_super_admin_update"
on public.help_feedback_submissions
for update to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

grant select, insert, update on public.user_help_preferences to authenticated;
grant select, insert, update on public.help_walkthrough_progress to authenticated;
grant select, insert, update on public.academy_lesson_progress to authenticated;
grant select, insert, update on public.help_trainer_prompt_dismissals to authenticated;
grant select, insert on public.help_feedback_submissions to authenticated;

grant all on public.user_help_preferences to service_role;
grant all on public.help_walkthrough_progress to service_role;
grant all on public.academy_lesson_progress to service_role;
grant all on public.help_trainer_prompt_dismissals to service_role;
grant all on public.help_feedback_submissions to service_role;

drop trigger if exists user_help_preferences_set_updated_at on public.user_help_preferences;
create trigger user_help_preferences_set_updated_at
before update on public.user_help_preferences
for each row execute function public.set_updated_at();

drop trigger if exists help_walkthrough_progress_set_updated_at on public.help_walkthrough_progress;
create trigger help_walkthrough_progress_set_updated_at
before update on public.help_walkthrough_progress
for each row execute function public.set_updated_at();

drop trigger if exists academy_lesson_progress_set_updated_at on public.academy_lesson_progress;
create trigger academy_lesson_progress_set_updated_at
before update on public.academy_lesson_progress
for each row execute function public.set_updated_at();

drop trigger if exists help_trainer_prompt_dismissals_set_updated_at on public.help_trainer_prompt_dismissals;
create trigger help_trainer_prompt_dismissals_set_updated_at
before update on public.help_trainer_prompt_dismissals
for each row execute function public.set_updated_at();

drop trigger if exists help_feedback_submissions_set_updated_at on public.help_feedback_submissions;
create trigger help_feedback_submissions_set_updated_at
before update on public.help_feedback_submissions
for each row execute function public.set_updated_at();

commit;
