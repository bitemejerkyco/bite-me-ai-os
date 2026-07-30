begin;

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
#variable_conflict use_column
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

grant execute on function public.get_my_video_credit_status()
  to authenticated;

commit;
