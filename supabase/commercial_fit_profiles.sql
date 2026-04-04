begin;

create table if not exists public.commercial_fit_profiles (
  id text primary key,
  kind text not null check (kind in ('role', 'expectation')),
  label text not null,
  short_label text,
  description text,
  keywords text[] not null default '{}',
  weights jsonb not null default '{}'::jsonb,
  critical text[] not null default '{}',
  sort_order integer not null default 100,
  is_active boolean not null default true,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists commercial_fit_profiles_kind_sort_idx
  on public.commercial_fit_profiles(kind, sort_order, label);

create or replace function public.touch_commercial_fit_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_commercial_fit_profiles_updated_at on public.commercial_fit_profiles;
create trigger trg_touch_commercial_fit_profiles_updated_at
before update on public.commercial_fit_profiles
for each row
execute function public.touch_commercial_fit_profiles_updated_at();

alter table public.commercial_fit_profiles enable row level security;

drop policy if exists commercial_fit_profiles_read_authenticated on public.commercial_fit_profiles;
create policy commercial_fit_profiles_read_authenticated
  on public.commercial_fit_profiles
  for select
  to authenticated
  using (true);

commit;
