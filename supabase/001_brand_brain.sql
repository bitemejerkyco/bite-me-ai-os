create extension if not exists pgcrypto;

create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  website text not null default '',
  industry text not null default '',
  mission text not null default '',
  tagline text not null default '',
  brand_voice text not null default '',
  target_audience text not null default '',
  products text not null default '',
  competitors text not null default '',
  marketing_goals text not null default '',
  primary_color text not null default '#dc2626',
  secondary_color text not null default '#111318',
  logo_url text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.brands enable row level security;

-- Temporary development policy. Replace with user-owned policies when authentication is added.
create policy "development access to brands"
on public.brands for all
to anon, authenticated
using (true)
with check (true);
