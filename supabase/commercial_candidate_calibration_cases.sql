-- Candidate analysis calibration cases
-- Apply after commercial_registry_candidate_analysis.sql.
-- This table stores human/expert benchmark scores so the deterministic scoring engine can be compared against manual review.

create table if not exists public.commercial_candidate_calibration_cases (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.commercial_workspaces(id) on delete cascade,
  project_id uuid not null references public.commercial_projects(id) on delete cascade,
  benchmark_key text not null,
  benchmark_label text,
  fit_profile_id text,
  fit_request text,
  manual_baseline_index integer check (manual_baseline_index is null or (manual_baseline_index >= 0 and manual_baseline_index <= 100)),
  manual_calibrated_index integer check (manual_calibrated_index is null or (manual_calibrated_index >= 0 and manual_calibrated_index <= 100)),
  manual_domains jsonb not null default '{}'::jsonb,
  manual_competencies jsonb not null default '{}'::jsonb,
  expected_profile_type text,
  manual_rank integer,
  expert_notes text,
  correction_notes text,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commercial_candidate_calibration_cases_unique unique (workspace_id, benchmark_key)
);

comment on table public.commercial_candidate_calibration_cases is
  'Human/expert benchmark scores for candidate-analysis calibration. Used to compare project scoring with manual expert review.';
comment on column public.commercial_candidate_calibration_cases.manual_baseline_index is
  'Manual expert index before Registry calibration, 0-100.';
comment on column public.commercial_candidate_calibration_cases.manual_calibrated_index is
  'Manual expert index after Registry calibration, 0-100.';
comment on column public.commercial_candidate_calibration_cases.manual_domains is
  'Optional manual domain scores: thinking, management, communication, selfOrganization, emotional, motivation.';
comment on column public.commercial_candidate_calibration_cases.manual_competencies is
  'Optional manual competency scores by C01..C31 id.';

create index if not exists idx_commercial_candidate_calibration_cases_workspace
  on public.commercial_candidate_calibration_cases(workspace_id, updated_at desc);

create index if not exists idx_commercial_candidate_calibration_cases_project
  on public.commercial_candidate_calibration_cases(project_id, updated_at desc);

create index if not exists idx_commercial_candidate_calibration_cases_active
  on public.commercial_candidate_calibration_cases(workspace_id, is_active, updated_at desc);

alter table public.commercial_candidate_calibration_cases enable row level security;

drop policy if exists "Workspace members can view candidate calibration cases" on public.commercial_candidate_calibration_cases;
create policy "Workspace members can view candidate calibration cases"
  on public.commercial_candidate_calibration_cases
  for select
  using (
    exists (
      select 1
      from public.commercial_workspace_members m
      where m.workspace_id = commercial_candidate_calibration_cases.workspace_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists "Workspace members can insert candidate calibration cases" on public.commercial_candidate_calibration_cases;
create policy "Workspace members can insert candidate calibration cases"
  on public.commercial_candidate_calibration_cases
  for insert
  with check (
    exists (
      select 1
      from public.commercial_workspace_members m
      where m.workspace_id = commercial_candidate_calibration_cases.workspace_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists "Workspace members can update candidate calibration cases" on public.commercial_candidate_calibration_cases;
create policy "Workspace members can update candidate calibration cases"
  on public.commercial_candidate_calibration_cases
  for update
  using (
    exists (
      select 1
      from public.commercial_workspace_members m
      where m.workspace_id = commercial_candidate_calibration_cases.workspace_id
        and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.commercial_workspace_members m
      where m.workspace_id = commercial_candidate_calibration_cases.workspace_id
        and m.user_id = auth.uid()
    )
  );

grant all privileges on table public.commercial_candidate_calibration_cases to authenticated;
grant all privileges on table public.commercial_candidate_calibration_cases to service_role;

drop trigger if exists trg_commercial_candidate_calibration_cases_updated_at on public.commercial_candidate_calibration_cases;
create trigger trg_commercial_candidate_calibration_cases_updated_at
before update on public.commercial_candidate_calibration_cases
for each row execute function public.set_updated_at();
