-- Registry-calibrated candidate analysis support
-- Apply after commercial_goals_workflow.sql and before deploying code that selects registry_comment.

alter table public.commercial_projects
  add column if not exists registry_comment text,
  add column if not exists registry_comment_updated_at timestamptz,
  add column if not exists registry_comment_updated_by uuid references auth.users(id) on delete set null;

comment on column public.commercial_projects.registry_comment is
  'HR / Registry calibration comment. Used to adjust role requirements in candidate analysis; not used as direct evidence of competence.';

create index if not exists idx_commercial_projects_registry_comment_updated_at
  on public.commercial_projects(workspace_id, registry_comment_updated_at desc)
  where registry_comment is not null;

create table if not exists public.commercial_project_registry_comments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.commercial_projects(id) on delete cascade,
  workspace_id uuid not null references public.commercial_workspaces(id) on delete cascade,
  comment text not null,
  comment_type text not null default 'hr_note',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.commercial_project_registry_comments is
  'Optional history of Registry/HR comments for calibrated candidate analysis.';

create index if not exists idx_commercial_project_registry_comments_project
  on public.commercial_project_registry_comments(project_id, created_at desc);

create index if not exists idx_commercial_project_registry_comments_workspace
  on public.commercial_project_registry_comments(workspace_id, created_at desc);

alter table public.commercial_project_registry_comments enable row level security;

-- Service role bypasses RLS; these policies keep direct client reads/writes workspace-scoped if needed.
drop policy if exists "Workspace members can view registry comments" on public.commercial_project_registry_comments;
create policy "Workspace members can view registry comments"
  on public.commercial_project_registry_comments
  for select
  using (
    exists (
      select 1
      from public.commercial_workspace_members m
      where m.workspace_id = commercial_project_registry_comments.workspace_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists "Workspace members can insert registry comments" on public.commercial_project_registry_comments;
create policy "Workspace members can insert registry comments"
  on public.commercial_project_registry_comments
  for insert
  with check (
    exists (
      select 1
      from public.commercial_workspace_members m
      where m.workspace_id = commercial_project_registry_comments.workspace_id
        and m.user_id = auth.uid()
    )
  );

grant all privileges on table public.commercial_project_registry_comments to authenticated;
grant all privileges on table public.commercial_project_registry_comments to service_role;
