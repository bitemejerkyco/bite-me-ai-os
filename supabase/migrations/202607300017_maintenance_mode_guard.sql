begin;

create or replace function public.get_maintenance_mode()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select case
        when jsonb_typeof(s.value) = 'boolean' then (s.value #>> '{}')::boolean
        when jsonb_typeof(s.value) = 'string' then lower(s.value #>> '{}') = 'true'
        else false
      end
      from public.system_settings s
      where s.key = 'maintenance_mode'
      limit 1
    ),
    false
  );
$$;

revoke all on function public.get_maintenance_mode() from public;
grant execute on function public.get_maintenance_mode() to anon, authenticated, service_role;

commit;