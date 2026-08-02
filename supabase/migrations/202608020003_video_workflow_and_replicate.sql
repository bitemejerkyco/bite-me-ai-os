begin;

alter table public.video_projects
  add column if not exists workflow_key text,
  add column if not exists credit_request_id uuid,
  add column if not exists hashtags text not null default '',
  add column if not exists call_to_action text not null default '';

alter table public.video_projects
  drop constraint if exists video_projects_duration_seconds_check;

create unique index if not exists video_projects_workflow_key_unique
  on public.video_projects(workflow_key)
  where workflow_key is not null and workflow_key <> '';

create unique index if not exists video_projects_credit_request_unique
  on public.video_projects(credit_request_id)
  where credit_request_id is not null;

create unique index if not exists content_drafts_video_project_unique
  on public.content_drafts(video_project_id)
  where video_project_id is not null;

create unique index if not exists media_assets_generation_job_unique
  on public.media_assets(generation_job_id)
  where generation_job_id is not null and generation_job_id <> '';

insert into public.system_settings (
  key,
  value,
  category,
  description,
  is_secret
)
values
  ('video_router_economy_model', '"wan-2.2-fast"'::jsonb, 'video', 'Economy video model identifier kept server-side.', false)
on conflict (key) do update
set
  value = excluded.value,
  category = excluded.category,
  description = excluded.description,
  is_secret = excluded.is_secret,
  updated_at = now();

create or replace function public.reserve_my_video_credits(
  video_seconds integer,
  credit_request_id uuid
)
returns table (
  charged_credits integer,
  remaining_credits integer,
  monthly_used_credits integer,
  monthly_limit_credits integer,
  billing_exempt boolean,
  estimated_provider_cost_cents integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_workspace_id uuid;
  required_credits integer;
  provider_cost integer;
  exempt boolean;
  account public.video_credit_accounts%rowtype;
begin
  if video_seconds < 8 or video_seconds > 15 then
    raise exception 'VIDEO_DURATION_INVALID:Choose an 8 through 15 second video.';
  end if;
  if credit_request_id is null then
    raise exception 'CREDIT_REQUEST_INVALID:A request identifier is required.';
  end if;

  target_workspace_id := public.my_primary_workspace_id();
  if target_workspace_id is null then
    raise exception 'WORKSPACE_REQUIRED:Save Business Setup before generating video.';
  end if;
  if not public.is_workspace_member(target_workspace_id) then
    raise exception 'WORKSPACE_FORBIDDEN:Workspace access is required.';
  end if;
  if exists (
    select 1
    from public.video_credit_transactions transaction_row
    where transaction_row.workspace_id = target_workspace_id
      and transaction_row.request_id = credit_request_id
      and transaction_row.kind = 'VIDEO_RENDER'
  ) then
    raise exception 'CREDIT_REQUEST_DUPLICATE:This video request was already charged.';
  end if;

  insert into public.video_credit_accounts (workspace_id)
  values (target_workspace_id)
  on conflict (workspace_id) do nothing;
  perform public.reset_video_credit_period(target_workspace_id);

  select *
  into account
  from public.video_credit_accounts
  where video_credit_accounts.workspace_id = target_workspace_id
  for update;

  required_credits := video_seconds;
  provider_cost := video_seconds * 70;
  exempt := public.my_video_billing_exempt(target_workspace_id);

  if not exempt and account.balance_credits < required_credits then
    raise exception
      'VIDEO_CREDITS_INSUFFICIENT:This video needs % credits; your balance is %.',
      required_credits,
      account.balance_credits;
  end if;
  if not exempt
     and account.monthly_used_credits + required_credits >
       account.monthly_limit_credits then
    raise exception
      'VIDEO_MONTHLY_LIMIT:This video would exceed the workspace monthly limit of % credits.',
      account.monthly_limit_credits;
  end if;

  if not exempt then
    update public.video_credit_accounts
    set
      balance_credits = balance_credits - required_credits,
      monthly_used_credits = monthly_used_credits + required_credits,
      lifetime_used_credits = lifetime_used_credits + required_credits,
      updated_at = now()
    where video_credit_accounts.workspace_id = target_workspace_id
    returning * into account;
  end if;

  insert into public.video_credit_transactions (
    workspace_id,
    actor_user_id,
    request_id,
    kind,
    credits_delta,
    estimated_provider_cost_cents,
    metadata
  )
  values (
    target_workspace_id,
    (select auth.uid()),
    credit_request_id,
    'VIDEO_RENDER',
    case when exempt then 0 else -required_credits end,
    provider_cost,
    jsonb_build_object(
      'seconds', video_seconds,
      'billing_exempt', exempt,
      'model', 'wan-2.2-fast',
      'size', '1080x1920'
    )
  );

  return query
  select
    case when exempt then 0 else required_credits end,
    account.balance_credits,
    account.monthly_used_credits,
    account.monthly_limit_credits,
    exempt,
    provider_cost;
end;
$$;

-- Legacy rows may still include previously supported 16/20-second durations.
alter table public.video_projects
  add constraint video_projects_duration_seconds_check
  check (duration_seconds between 8 and 15)
  not valid;

commit;