create extension if not exists pgcrypto;

create table if not exists public.commercial_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  company_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.commercial_attempts (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  test_slug text not null,
  test_title text not null,
  result jsonb not null,
  source text not null default 'local_runtime',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_commercial_attempts_user_created_at
  on public.commercial_attempts(user_id, created_at desc);

create index if not exists idx_commercial_attempts_test_slug
  on public.commercial_attempts(test_slug);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_commercial_profiles_updated_at on public.commercial_profiles;
create trigger trg_commercial_profiles_updated_at
before update on public.commercial_profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_commercial_attempts_updated_at on public.commercial_attempts;
create trigger trg_commercial_attempts_updated_at
before update on public.commercial_attempts
for each row execute function public.set_updated_at();

alter table public.commercial_profiles enable row level security;
alter table public.commercial_attempts enable row level security;

drop policy if exists "Users can view own commercial profile" on public.commercial_profiles;
create policy "Users can view own commercial profile"
  on public.commercial_profiles
  for select
  using (auth.uid() = id);

drop policy if exists "Users can insert own commercial profile" on public.commercial_profiles;
create policy "Users can insert own commercial profile"
  on public.commercial_profiles
  for insert
  with check (auth.uid() = id);

drop policy if exists "Users can update own commercial profile" on public.commercial_profiles;
create policy "Users can update own commercial profile"
  on public.commercial_profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Users can view own commercial attempts" on public.commercial_attempts;
create policy "Users can view own commercial attempts"
  on public.commercial_attempts
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own commercial attempts" on public.commercial_attempts;
create policy "Users can insert own commercial attempts"
  on public.commercial_attempts
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own commercial attempts" on public.commercial_attempts;
create policy "Users can update own commercial attempts"
  on public.commercial_attempts
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
