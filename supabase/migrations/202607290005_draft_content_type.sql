begin;

alter table public.content_drafts
add column if not exists entry_type text not null default 'POST'
check (entry_type in ('POST', 'AD'));

alter table public.scheduled_posts
drop constraint if exists scheduled_posts_channel_check;

alter table public.scheduled_posts
add constraint scheduled_posts_channel_check
check (channel in (
  'TikTok',
  'Instagram',
  'Facebook',
  'LinkedIn',
  'Email',
  'SMS',
  'Blog'
));

commit;
