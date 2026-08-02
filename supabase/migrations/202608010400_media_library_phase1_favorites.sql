begin;

alter table public.media_assets
  add column if not exists is_favorite boolean not null default false;

create index if not exists media_assets_workspace_favorite_idx
  on public.media_assets(workspace_id, is_favorite, created_at desc)
  where archived_at is null;

commit;
