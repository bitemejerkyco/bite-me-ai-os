begin;

create or replace function public.save_my_workspace(
  workspace_name text,
  workspace_slug text,
  workspace_website text,
  workspace_industry text,
  workspace_primary_goal text,
  workspace_audience text,
  workspace_voice text
)
returns public.workspaces
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  saved_workspace public.workspaces;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  select *
  into saved_workspace
  from public.workspaces
  where owner_user_id = current_user_id
  order by created_at asc
  limit 1;

  if found then
    update public.workspaces
    set
      name = left(trim(workspace_name), 120),
      website = nullif(left(trim(workspace_website), 300), ''),
      industry = left(trim(workspace_industry), 50),
      primary_goal = nullif(left(trim(workspace_primary_goal), 300), ''),
      audience = nullif(left(trim(workspace_audience), 300), ''),
      voice = nullif(left(trim(workspace_voice), 200), '')
    where id = saved_workspace.id
    returning * into saved_workspace;
  else
    insert into public.workspaces (
      owner_user_id,
      name,
      slug,
      website,
      industry,
      primary_goal,
      audience,
      voice
    )
    values (
      current_user_id,
      left(trim(workspace_name), 120),
      left(trim(workspace_slug), 80),
      nullif(left(trim(workspace_website), 300), ''),
      left(trim(workspace_industry), 50),
      nullif(left(trim(workspace_primary_goal), 300), ''),
      nullif(left(trim(workspace_audience), 300), ''),
      nullif(left(trim(workspace_voice), 200), '')
    )
    returning * into saved_workspace;
  end if;

  return saved_workspace;
end;
$$;

revoke all on function public.save_my_workspace(
  text, text, text, text, text, text, text
) from public, anon;
grant execute on function public.save_my_workspace(
  text, text, text, text, text, text, text
) to authenticated, service_role;

commit;
