begin;

revoke update on public.profiles from authenticated;
grant update (full_name) on public.profiles to authenticated;

create or replace function public.handle_new_workspace()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  account_role text;
begin
  select case
    when p.system_role = 'SUPER_ADMIN' then 'SUPER_ADMIN'
    else 'ADMIN'
  end
  into account_role
  from public.profiles p
  where p.user_id = new.owner_user_id;

  insert into public.workspace_memberships (
    workspace_id,
    user_id,
    role,
    billing_exempt
  )
  values (
    new.id,
    new.owner_user_id,
    coalesce(account_role, 'ADMIN'),
    coalesce(account_role = 'SUPER_ADMIN', false)
  )
  on conflict (workspace_id, user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_workspace_created on public.workspaces;
create trigger on_workspace_created
after insert on public.workspaces
for each row execute function public.handle_new_workspace();

update public.profiles
set system_role = 'SUPER_ADMIN'
where user_id = (
  select id
  from auth.users
  order by created_at asc
  limit 1
);

insert into public.workspace_memberships (
  workspace_id,
  user_id,
  role,
  billing_exempt
)
select
  w.id,
  w.owner_user_id,
  case when p.system_role = 'SUPER_ADMIN' then 'SUPER_ADMIN' else 'ADMIN' end,
  p.system_role = 'SUPER_ADMIN'
from public.workspaces w
join public.profiles p on p.user_id = w.owner_user_id
on conflict (workspace_id, user_id) do update
set
  role = excluded.role,
  billing_exempt = excluded.billing_exempt;

commit;
