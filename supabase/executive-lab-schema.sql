create extension if not exists pgcrypto;

create table if not exists public.executive_lab_workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_name text not null default 'Алексей Иванов',
  owner_role text not null default 'Генеральный директор',
  balance_kopeks bigint not null default 0 check (balance_kopeks >= 0),
  ai_efficiency integer not null default 0 check (ai_efficiency between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.executive_lab_projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.executive_lab_workspaces(id) on delete cascade,
  title text not null,
  folder_title text not null,
  participant_count integer not null default 0 check (participant_count >= 0),
  progress integer not null default 0 check (progress between 0 and 100),
  status text not null default 'В процессе',
  disposition text not null default 'active' check (disposition in ('active', 'archived', 'trash')),
  start_date date not null default current_date,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.executive_lab_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.executive_lab_workspaces(id) on delete cascade,
  project_id uuid references public.executive_lab_projects(id) on delete cascade,
  event_type text not null,
  title text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.executive_lab_layouts (
  workspace_id uuid primary key references public.executive_lab_workspaces(id) on delete cascade,
  layout jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists executive_lab_projects_workspace_idx
  on public.executive_lab_projects(workspace_id, sort_order);

create index if not exists executive_lab_events_workspace_idx
  on public.executive_lab_events(workspace_id, created_at desc);

alter table public.executive_lab_workspaces enable row level security;
alter table public.executive_lab_projects enable row level security;
alter table public.executive_lab_events enable row level security;
alter table public.executive_lab_layouts enable row level security;

do $$
declare
  target_workspace_id uuid;
begin
  select id
    into target_workspace_id
    from public.executive_lab_workspaces
   order by created_at
   limit 1;

  if target_workspace_id is null then
    insert into public.executive_lab_workspaces (
      name,
      owner_name,
      owner_role,
      balance_kopeks,
      ai_efficiency
    )
    values (
      'Executive Space Lab',
      'Алексей Иванов',
      'Генеральный директор',
      125000000,
      94
    )
    returning id into target_workspace_id;
  end if;

  if not exists (
    select 1
      from public.executive_lab_projects
     where workspace_id = target_workspace_id
  ) then
    insert into public.executive_lab_projects (
      workspace_id,
      title,
      folder_title,
      participant_count,
      progress,
      status,
      disposition,
      start_date,
      sort_order
    )
    values
      (target_workspace_id, 'Оценка руководителей', 'Руководители', 24, 75, 'В процессе', 'active', current_date - 8, 10),
      (target_workspace_id, 'Потенциал сотрудников', 'Потенциал', 36, 60, 'В процессе', 'active', current_date - 10, 20),
      (target_workspace_id, 'Онбординг-оценка', 'Онбординг', 15, 30, 'В процессе', 'active', current_date - 13, 30),
      (target_workspace_id, 'Оценка soft skills', 'Soft skills', 22, 100, 'Завершён', 'archived', current_date - 18, 40),
      (target_workspace_id, 'Лидерский потенциал', 'Резерв', 18, 45, 'В процессе', 'active', current_date - 23, 50);
  end if;

  insert into public.executive_lab_layouts (workspace_id)
  values (target_workspace_id)
  on conflict (workspace_id) do nothing;
end
$$;
