begin;

alter table public.content_drafts
  add column if not exists platform text,
  add column if not exists campaign_id uuid references public.campaigns(id) on delete set null,
  add column if not exists plan_id text,
  add column if not exists task_id text,
  add column if not exists generated_by_ai boolean not null default false,
  add column if not exists approval_status text not null default 'DRAFT'
    check (approval_status in ('DRAFT', 'REVIEW', 'APPROVED', 'SCHEDULED', 'PUBLISHED')),
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists content_drafts_plan_task_idx
  on public.content_drafts(workspace_id, plan_id, task_id, created_at desc);

create index if not exists content_drafts_approval_status_idx
  on public.content_drafts(workspace_id, approval_status, created_at desc);

commit;
