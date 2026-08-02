begin;

alter table public.media_assets
  add column if not exists source text not null default 'UPLOADED'
    check (source in ('UPLOADED', 'GENERATED', 'IMPORTED', 'LEGACY', 'CAMPAIGN', 'UGC')),
  add column if not exists generation_status text not null default 'READY'
    check (generation_status in ('PENDING', 'PROCESSING', 'READY', 'FAILED')),
  add column if not exists generation_job_id text,
  add column if not exists thumbnail_path text,
  add column if not exists poster_path text,
  add column if not exists width integer check (width is null or width >= 0),
  add column if not exists height integer check (height is null or height >= 0),
  add column if not exists duration_seconds numeric(10, 3) check (duration_seconds is null or duration_seconds >= 0),
  add column if not exists archived_at timestamptz,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists media_assets_workspace_active_idx
  on public.media_assets(workspace_id, archived_at, created_at desc);

create index if not exists media_assets_source_created_idx
  on public.media_assets(workspace_id, source, created_at desc);

create index if not exists media_assets_generation_status_idx
  on public.media_assets(workspace_id, generation_status, created_at desc);

commit;
