begin;

insert into public.system_settings (
  key,
  value,
  category,
  description,
  is_secret
)
values (
  'video_router_economy_model',
  '"wan-video/wan-2.2-t2v-fast"'::jsonb,
  'video',
  'Economy video model identifier kept server-side.',
  false
)
on conflict (key) do update
set
  value = excluded.value,
  category = excluded.category,
  description = excluded.description,
  is_secret = excluded.is_secret,
  updated_at = now();

commit;
