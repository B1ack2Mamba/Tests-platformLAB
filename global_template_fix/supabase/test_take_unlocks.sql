create table if not exists public.test_take_unlocks (
  user_id uuid not null references auth.users(id) on delete cascade,
  test_slug text not null references public.tests(slug) on delete cascade,
  paid_kopeks bigint not null default 0,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, test_slug)
);

create index if not exists test_take_unlocks_test_slug_idx
  on public.test_take_unlocks(test_slug);

alter table public.test_take_unlocks enable row level security;

drop policy if exists "Test take unlocks: read own" on public.test_take_unlocks;
create policy "Test take unlocks: read own"
  on public.test_take_unlocks
  for select
  using (auth.uid() = user_id);

grant all privileges on table public.test_take_unlocks to service_role;
