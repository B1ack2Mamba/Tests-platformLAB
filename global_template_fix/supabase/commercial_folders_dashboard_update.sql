create table if not exists public.commercial_project_folders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.commercial_workspaces(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  name text not null,
  icon_key text not null default 'folder',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.commercial_project_folders enable row level security;

alter table public.commercial_projects
  add column if not exists folder_id uuid references public.commercial_project_folders(id) on delete set null;

create index if not exists idx_commercial_project_folders_workspace_id
  on public.commercial_project_folders(workspace_id, sort_order asc, created_at asc);

create index if not exists idx_commercial_projects_folder_id
  on public.commercial_projects(folder_id);

drop trigger if exists trg_commercial_project_folders_updated_at on public.commercial_project_folders;
create trigger trg_commercial_project_folders_updated_at
before update on public.commercial_project_folders
for each row execute function public.set_updated_at();

drop policy if exists "Workspace members can view project folders" on public.commercial_project_folders;
create policy "Workspace members can view project folders"
  on public.commercial_project_folders
  for select
  using (
    exists (
      select 1
      from public.commercial_workspace_members m
      where m.workspace_id = commercial_project_folders.workspace_id
        and m.user_id = auth.uid()
    )
  );

-- normalize old projects into the uncategorized lane
update public.commercial_projects set folder_id = null where folder_id is not null and not exists (
  select 1 from public.commercial_project_folders f where f.id = commercial_projects.folder_id
);

grant all privileges on table public.commercial_project_folders to service_role;
grant all privileges on table public.commercial_projects to service_role;
