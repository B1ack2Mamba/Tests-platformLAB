create table if not exists public.commercial_project_evaluation_cache (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.commercial_projects(id) on delete cascade,
  package_mode text not null,
  cache_key text not null,
  evaluation jsonb not null,
  status text not null default 'ready',
  error_message text null,
  built_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, package_mode, cache_key)
);

create index if not exists idx_commercial_project_evaluation_cache_project_mode
  on public.commercial_project_evaluation_cache(project_id, package_mode, built_at desc);

alter table public.commercial_project_evaluation_cache enable row level security;

grant all privileges on table public.commercial_project_evaluation_cache to service_role;

drop trigger if exists trg_commercial_project_evaluation_cache_updated_at on public.commercial_project_evaluation_cache;
create trigger trg_commercial_project_evaluation_cache_updated_at
before update on public.commercial_project_evaluation_cache
for each row execute function public.set_updated_at();
