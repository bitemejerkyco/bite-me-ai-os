create extension if not exists pgcrypto;

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  brand_id uuid references public.brands(id) on delete set null,
  status text not null default 'draft' check (status in ('draft','complete','archived')),
  brief jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.brand_assets (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references public.brands(id) on delete set null,
  name text not null,
  asset_type text not null default 'other' check (asset_type in ('logo','product','photo','video','document','other')),
  file_url text not null,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists campaigns_updated_at_idx on public.campaigns(updated_at desc);
create index if not exists brand_assets_brand_id_idx on public.brand_assets(brand_id);
