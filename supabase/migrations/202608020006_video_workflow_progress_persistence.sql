begin;

alter table public.video_projects
  add column if not exists workflow_stage text,
  add column if not exists workflow_percentage integer,
  add column if not exists provider_job_status text,
  add column if not exists credit_status text,
  add column if not exists credit_refunded_at timestamptz,
  add column if not exists failure_reference_id text,
  add column if not exists media_asset_id uuid references public.media_assets(id) on delete set null,
  add column if not exists workflow_started_at timestamptz,
  add column if not exists workflow_completed_at timestamptz,
  add column if not exists last_provider_poll_at timestamptz;

update public.video_projects
set
  workflow_stage = coalesce(workflow_stage,
    case
      when status = 'READY' or status = 'APPROVED' then 'COMPLETE'
      when status = 'FAILED' then 'FAILED'
      when status = 'GENERATING' then 'GENERATING_SCENES'
      else 'PREPARING_VIDEO_PLAN'
    end
  ),
  workflow_percentage = coalesce(workflow_percentage,
    case
      when status = 'READY' or status = 'APPROVED' then 100
      when status = 'FAILED' then greatest(0, least(89, coalesce(provider_progress, 0)))
      when status = 'GENERATING' then greatest(0, least(89, coalesce(provider_progress, 0)))
      else 0
    end
  ),
  provider_job_status = coalesce(provider_job_status,
    case
      when status = 'READY' or status = 'APPROVED' then 'completed'
      when status = 'FAILED' then 'failed'
      when status = 'GENERATING' then 'in_progress'
      else null
    end
  ),
  credit_status = coalesce(credit_status,
    case
      when credit_request_id is not null and status = 'FAILED' then 'REFUNDED'
      when credit_request_id is not null then 'RESERVED'
      else 'NONE'
    end
  ),
  workflow_started_at = coalesce(workflow_started_at, created_at),
  workflow_completed_at = coalesce(workflow_completed_at,
    case when status = 'READY' or status = 'APPROVED' then updated_at else null end
  );

alter table public.video_projects
  alter column workflow_stage set default 'PREPARING_VIDEO_PLAN',
  alter column workflow_percentage set default 0,
  alter column credit_status set default 'NONE';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'video_projects_workflow_percentage_check'
  ) then
    alter table public.video_projects
      add constraint video_projects_workflow_percentage_check
      check (workflow_percentage is null or (workflow_percentage >= 0 and workflow_percentage <= 100));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'video_projects_provider_job_status_check'
  ) then
    alter table public.video_projects
      add constraint video_projects_provider_job_status_check
      check (provider_job_status is null or provider_job_status in ('queued', 'in_progress', 'completed', 'failed'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'video_projects_credit_status_check'
  ) then
    alter table public.video_projects
      add constraint video_projects_credit_status_check
      check (credit_status is null or credit_status in ('NONE', 'RESERVED', 'REFUNDED'));
  end if;
end;
$$;

create index if not exists video_projects_status_updated_idx
  on public.video_projects(workspace_id, status, updated_at desc);

commit;
