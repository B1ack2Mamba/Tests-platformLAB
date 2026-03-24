create extension if not exists pgcrypto;

create table if not exists public.commercial_workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.commercial_workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.commercial_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create table if not exists public.commercial_people (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.commercial_workspaces(id) on delete cascade,
  full_name text not null,
  email text,
  current_position text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.commercial_projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.commercial_workspaces(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  person_id uuid references public.commercial_people(id) on delete set null,
  goal text not null,
  package_mode text not null default 'premium',
  title text not null,
  target_role text,
  summary text,
  invite_token text not null default encode(gen_random_bytes(16), 'hex'),
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.commercial_project_tests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.commercial_projects(id) on delete cascade,
  test_slug text not null,
  test_title text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique(project_id, test_slug)
);


create table if not exists public.commercial_project_attempts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.commercial_projects(id) on delete cascade,
  test_slug text not null,
  test_title text not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, test_slug)
);

create index if not exists idx_commercial_workspace_members_user_id on public.commercial_workspace_members(user_id);
create index if not exists idx_commercial_people_workspace_id on public.commercial_people(workspace_id, created_at desc);
create index if not exists idx_commercial_projects_workspace_id on public.commercial_projects(workspace_id, created_at desc);
create index if not exists idx_commercial_project_tests_project_id on public.commercial_project_tests(project_id, sort_order asc);
create unique index if not exists idx_commercial_projects_invite_token on public.commercial_projects(invite_token);
create index if not exists idx_commercial_project_attempts_project_id on public.commercial_project_attempts(project_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_commercial_workspaces_updated_at on public.commercial_workspaces;
create trigger trg_commercial_workspaces_updated_at
before update on public.commercial_workspaces
for each row execute function public.set_updated_at();

drop trigger if exists trg_commercial_workspace_members_updated_at on public.commercial_workspace_members;
create trigger trg_commercial_workspace_members_updated_at
before update on public.commercial_workspace_members
for each row execute function public.set_updated_at();

drop trigger if exists trg_commercial_people_updated_at on public.commercial_people;
create trigger trg_commercial_people_updated_at
before update on public.commercial_people
for each row execute function public.set_updated_at();

drop trigger if exists trg_commercial_projects_updated_at on public.commercial_projects;
create trigger trg_commercial_projects_updated_at
before update on public.commercial_projects
for each row execute function public.set_updated_at();

alter table public.commercial_workspaces enable row level security;
alter table public.commercial_workspace_members enable row level security;
alter table public.commercial_people enable row level security;
alter table public.commercial_projects enable row level security;
alter table public.commercial_project_tests enable row level security;
alter table public.commercial_project_attempts enable row level security;

drop policy if exists "Workspace members can view workspaces" on public.commercial_workspaces;
create policy "Workspace members can view workspaces"
  on public.commercial_workspaces
  for select
  using (
    exists (
      select 1
      from public.commercial_workspace_members m
      where m.workspace_id = commercial_workspaces.id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists "Workspace members can view membership" on public.commercial_workspace_members;
create policy "Workspace members can view membership"
  on public.commercial_workspace_members
  for select
  using (
    exists (
      select 1
      from public.commercial_workspace_members m
      where m.workspace_id = commercial_workspace_members.workspace_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists "Workspace members can view people" on public.commercial_people;
create policy "Workspace members can view people"
  on public.commercial_people
  for select
  using (
    exists (
      select 1
      from public.commercial_workspace_members m
      where m.workspace_id = commercial_people.workspace_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists "Workspace members can view projects" on public.commercial_projects;
create policy "Workspace members can view projects"
  on public.commercial_projects
  for select
  using (
    exists (
      select 1
      from public.commercial_workspace_members m
      where m.workspace_id = commercial_projects.workspace_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists "Workspace members can view project tests" on public.commercial_project_tests;
create policy "Workspace members can view project tests"
  on public.commercial_project_tests
  for select
  using (
    exists (
      select 1
      from public.commercial_projects p
      join public.commercial_workspace_members m on m.workspace_id = p.workspace_id
      where p.id = commercial_project_tests.project_id
        and m.user_id = auth.uid()
    )
  );


drop policy if exists "Workspace members can view project attempts" on public.commercial_project_attempts;
create policy "Workspace members can view project attempts"
  on public.commercial_project_attempts
  for select
  using (
    exists (
      select 1
      from public.commercial_projects p
      join public.commercial_workspace_members m on m.workspace_id = p.workspace_id
      where p.id = commercial_project_attempts.project_id
        and m.user_id = auth.uid()
    )
  );
