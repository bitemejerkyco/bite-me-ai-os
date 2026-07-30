begin;

alter table public.scheduled_posts
  drop constraint if exists scheduled_posts_status_check;

alter table public.scheduled_posts
  add constraint scheduled_posts_status_check
  check (status in (
    'DRAFT',
    'PENDING_APPROVAL',
    'SCHEDULED',
    'PUBLISHING',
    'DELIVERED_TO_INBOX',
    'PUBLISHED',
    'FAILED',
    'CANCELED'
  ));

create index if not exists scheduled_posts_provider_job_idx
  on public.scheduled_posts(provider_job_id)
  where provider_job_id is not null;

commit;
