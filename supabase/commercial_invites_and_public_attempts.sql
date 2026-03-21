create extension if not exists pgcrypto;

alter table public.commercial_projects
  add column if not exists invite_token text;

update public.commercial_projects
set invite_token = encode(gen_random_bytes(16), 'hex')
where invite_token is null or invite_token = '';

alter table public.commercial_projects
  alter column invite_token set default encode(gen_random_bytes(16), 'hex');

create unique index if not exists idx_commercial_projects_invite_token
  on public.commercial_projects(invite_token);

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

create index if not exists idx_commercial_project_attempts_project_id
  on public.commercial_project_attempts(project_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_commercial_project_attempts_updated_at on public.commercial_project_attempts;
create trigger trg_commercial_project_attempts_updated_at
before update on public.commercial_project_attempts
for each row execute function public.set_updated_at();

alter table public.commercial_project_attempts enable row level security;

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

grant usage on schema public to service_role;
grant all privileges on table public.commercial_projects to service_role;
grant all privileges on table public.commercial_project_attempts to service_role;
grant all privileges on table public.commercial_project_tests to service_role;
grant all privileges on table public.commercial_people to service_role;
grant all privileges on all sequences in schema public to service_role;
