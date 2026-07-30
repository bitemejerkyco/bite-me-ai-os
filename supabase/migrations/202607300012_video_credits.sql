begin;

create table if not exists public.video_credit_accounts (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  balance_credits integer not null default 20 check (balance_credits >= 0),
  monthly_limit_credits integer not null default 100
    check (monthly_limit_credits >= 0),
  monthly_used_credits integer not null default 0
    check (monthly_used_credits >= 0),
  period_started_at date not null default date_trunc('month', now())::date,
  lifetime_used_credits bigint not null default 0
    check (lifetime_used_credits >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.video_credit_transactions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  kind text not null check (
    kind in ('VIDEO_RENDER', 'VIDEO_REFUND', 'PURCHASE', 'ADMIN_ADJUSTMENT')
  ),
  credits_delta integer not null,
  estimated_provider_cost_cents integer not null default 0
    check (estimated_provider_cost_cents >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (workspace_id, request_id, kind)
);

create index if not exists video_credit_transactions_workspace_created_idx
  on public.video_credit_transactions(workspace_id, created_at desc);

create or replace function public.ensure_video_credit_account()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.video_credit_accounts (workspace_id)
  values (new.id)
  on conflict (workspace_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_workspace_video_credit_account on public.workspaces;
create trigger on_workspace_video_credit_account
after insert on public.workspaces
for each row execute function public.ensure_video_credit_account();

insert into public.video_credit_accounts (workspace_id)
select id from public.workspaces
on conflict (workspace_id) do nothing;

create or replace function public.my_primary_workspace_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select w.id
  from public.workspaces w
  where w.owner_user_id = (select auth.uid())
     or exists (
       select 1
       from public.workspace_memberships m
       where m.workspace_id = w.id
         and m.user_id = (select auth.uid())
     )
  order by w.created_at asc
  limit 1;
$$;

create or replace function public.my_video_billing_exempt(
  target_workspace_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1
      from public.profiles p
      where p.user_id = (select auth.uid())
        and p.system_role = 'SUPER_ADMIN'
    )
    or exists (
      select 1
      from public.workspace_memberships m
      where m.workspace_id = target_workspace_id
        and m.user_id = (select auth.uid())
        and (m.billing_exempt or m.role = 'SUPER_ADMIN')
    );
$$;

create or replace function public.reset_video_credit_period(
  target_workspace_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.video_credit_accounts
  set
    monthly_used_credits = 0,
    period_started_at = date_trunc('month', now())::date,
    updated_at = now()
  where workspace_id = target_workspace_id
    and period_started_at < date_trunc('month', now())::date;
end;
$$;

create or replace function public.get_my_video_credit_status()
returns table (
  workspace_id uuid,
  balance_credits integer,
  monthly_limit_credits integer,
  monthly_used_credits integer,
  billing_exempt boolean,
  credits_per_second integer,
  provider_cost_cents_per_second integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_workspace_id uuid;
begin
  target_workspace_id := public.my_primary_workspace_id();
  if target_workspace_id is null then
    raise exception 'WORKSPACE_REQUIRED:Save Business Setup before generating video.';
  end if;

  insert into public.video_credit_accounts (workspace_id)
  values (target_workspace_id)
  on conflict (workspace_id) do nothing;
  perform public.reset_video_credit_period(target_workspace_id);

  return query
  select
    account.workspace_id,
    account.balance_credits,
    account.monthly_limit_credits,
    account.monthly_used_credits,
    public.my_video_billing_exempt(target_workspace_id),
    1,
    70
  from public.video_credit_accounts account
  where account.workspace_id = target_workspace_id;
end;
$$;

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
  if video_seconds not in (8, 16, 20) then
    raise exception 'VIDEO_DURATION_INVALID:Choose an 8, 16, or 20 second video.';
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
      'model', 'sora-2-pro',
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

create or replace function public.refund_my_video_credits(
  credit_request_id uuid,
  refund_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_workspace_id uuid;
  charge public.video_credit_transactions%rowtype;
  refund_credits integer;
begin
  target_workspace_id := public.my_primary_workspace_id();
  if target_workspace_id is null then
    return;
  end if;

  select *
  into charge
  from public.video_credit_transactions transaction_row
  where transaction_row.workspace_id = target_workspace_id
    and transaction_row.request_id = credit_request_id
    and transaction_row.kind = 'VIDEO_RENDER'
  for update;

  if charge.id is null or exists (
    select 1
    from public.video_credit_transactions transaction_row
    where transaction_row.workspace_id = target_workspace_id
      and transaction_row.request_id = credit_request_id
      and transaction_row.kind = 'VIDEO_REFUND'
  ) then
    return;
  end if;

  refund_credits := greatest(0, -charge.credits_delta);
  if refund_credits > 0 then
    update public.video_credit_accounts
    set
      balance_credits = balance_credits + refund_credits,
      monthly_used_credits = greatest(
        0,
        monthly_used_credits - refund_credits
      ),
      lifetime_used_credits = greatest(
        0,
        lifetime_used_credits - refund_credits
      ),
      updated_at = now()
    where video_credit_accounts.workspace_id = target_workspace_id;
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
    'VIDEO_REFUND',
    refund_credits,
    0,
    jsonb_build_object('reason', left(coalesce(refund_reason, ''), 500))
  );
end;
$$;

create or replace function public.admin_set_video_credit_account(
  target_workspace_id uuid,
  new_balance_credits integer,
  new_monthly_limit_credits integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.profiles p
    where p.user_id = (select auth.uid())
      and p.system_role = 'SUPER_ADMIN'
  ) then
    raise exception 'ADMIN_REQUIRED:Super Admin access is required.';
  end if;
  if new_balance_credits < 0 or new_monthly_limit_credits < 0 then
    raise exception 'CREDIT_VALUE_INVALID:Credits and limits cannot be negative.';
  end if;

  insert into public.video_credit_accounts (
    workspace_id,
    balance_credits,
    monthly_limit_credits
  )
  values (
    target_workspace_id,
    new_balance_credits,
    new_monthly_limit_credits
  )
  on conflict (workspace_id) do update
  set
    balance_credits = excluded.balance_credits,
    monthly_limit_credits = excluded.monthly_limit_credits,
    updated_at = now();

  insert into public.video_credit_transactions (
    workspace_id,
    actor_user_id,
    request_id,
    kind,
    credits_delta,
    metadata
  )
  values (
    target_workspace_id,
    (select auth.uid()),
    gen_random_uuid(),
    'ADMIN_ADJUSTMENT',
    0,
    jsonb_build_object(
      'new_balance_credits', new_balance_credits,
      'new_monthly_limit_credits', new_monthly_limit_credits
    )
  );
end;
$$;

alter table public.video_credit_accounts enable row level security;
alter table public.video_credit_transactions enable row level security;

drop policy if exists "video_credit_accounts_member_select"
  on public.video_credit_accounts;
create policy "video_credit_accounts_member_select"
on public.video_credit_accounts
for select to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "video_credit_transactions_member_select"
  on public.video_credit_transactions;
create policy "video_credit_transactions_member_select"
on public.video_credit_transactions
for select to authenticated
using (public.is_workspace_member(workspace_id));

grant select on public.video_credit_accounts to authenticated;
grant select on public.video_credit_transactions to authenticated;
grant execute on function public.get_my_video_credit_status()
  to authenticated;
grant execute on function public.reserve_my_video_credits(integer, uuid)
  to authenticated;
grant execute on function public.refund_my_video_credits(uuid, text)
  to authenticated;
grant execute on function public.admin_set_video_credit_account(
  uuid,
  integer,
  integer
) to authenticated;

commit;
