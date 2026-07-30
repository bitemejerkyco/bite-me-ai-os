begin;

create table if not exists public.library_folders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  library_type text not null check (library_type in ('CONTENT', 'MEDIA')),
  name text not null check (
    char_length(trim(name)) between 1 and 80
  ),
  parent_id uuid references public.library_folders(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.content_drafts
  add column if not exists folder_id uuid
  references public.library_folders(id) on delete set null;

alter table public.media_assets
  add column if not exists folder_id uuid
  references public.library_folders(id) on delete set null;

create index if not exists library_folders_workspace_type_name_idx
  on public.library_folders(workspace_id, library_type, name);
create index if not exists content_drafts_workspace_folder_idx
  on public.content_drafts(workspace_id, folder_id, created_at desc);
create index if not exists media_assets_workspace_folder_idx
  on public.media_assets(workspace_id, folder_id, created_at desc);

drop trigger if exists library_folders_set_updated_at
  on public.library_folders;
create trigger library_folders_set_updated_at
before update on public.library_folders
for each row execute function public.set_updated_at();

alter table public.library_folders enable row level security;

drop policy if exists "library_folders_member_all"
  on public.library_folders;
create policy "library_folders_member_all"
on public.library_folders
for all to authenticated
using (public.is_workspace_member(workspace_id))
with check (
  public.is_workspace_member(workspace_id)
  and created_by = (select auth.uid())
);

grant select, insert, update, delete
  on public.library_folders to authenticated;

commit;
