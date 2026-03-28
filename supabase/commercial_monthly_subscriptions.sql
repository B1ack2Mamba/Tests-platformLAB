create table if not exists public.commercial_workspace_subscriptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.commercial_workspaces(id) on delete cascade,
  created_by_user_id uuid references auth.users(id) on delete set null,
  payment_id text unique,
  plan_key text not null,
  plan_title text not null,
  price_kopeks bigint not null,
  projects_limit integer not null,
  projects_used integer not null default 0,
  duration_days integer not null default 30,
  status text not null default 'active',
  started_at timestamptz not null default now(),
  activated_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.commercial_workspace_subscription_projects (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.commercial_workspace_subscriptions(id) on delete cascade,
  workspace_id uuid not null references public.commercial_workspaces(id) on delete cascade,
  project_id uuid not null unique references public.commercial_projects(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists commercial_workspace_subscriptions_workspace_status_idx
  on public.commercial_workspace_subscriptions(workspace_id, status, expires_at desc);

create index if not exists commercial_workspace_subscription_projects_subscription_idx
  on public.commercial_workspace_subscription_projects(subscription_id, created_at desc);

alter table public.commercial_workspace_subscriptions enable row level security;
alter table public.commercial_workspace_subscription_projects enable row level security;

drop policy if exists "Workspace subscriptions: read by members" on public.commercial_workspace_subscriptions;
create policy "Workspace subscriptions: read by members"
  on public.commercial_workspace_subscriptions
  for select
  using (
    exists (
      select 1
      from public.commercial_workspace_members m
      where m.workspace_id = commercial_workspace_subscriptions.workspace_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists "Workspace subscription projects: read by members" on public.commercial_workspace_subscription_projects;
create policy "Workspace subscription projects: read by members"
  on public.commercial_workspace_subscription_projects
  for select
  using (
    exists (
      select 1
      from public.commercial_workspace_members m
      where m.workspace_id = commercial_workspace_subscription_projects.workspace_id
        and m.user_id = auth.uid()
    )
  );

create or replace function public.consume_commercial_workspace_subscription(
  p_workspace_id uuid,
  p_project_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subscription public.commercial_workspace_subscriptions%rowtype;
  v_existing_subscription_id uuid;
  v_row_count integer := 0;
  v_new_used integer := 0;
begin
  if p_workspace_id is null or p_project_id is null then
    raise exception 'workspace_id and project_id are required';
  end if;

  select sp.subscription_id
    into v_existing_subscription_id
  from public.commercial_workspace_subscription_projects sp
  where sp.project_id = p_project_id
  limit 1;

  if v_existing_subscription_id is not null then
    return jsonb_build_object('ok', true, 'already', true, 'subscription_id', v_existing_subscription_id);
  end if;

  select *
    into v_subscription
  from public.commercial_workspace_subscriptions s
  where s.workspace_id = p_workspace_id
    and s.status = 'active'
    and s.expires_at > now()
  order by coalesce(s.activated_at, s.started_at) desc, s.created_at desc
  limit 1
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'active', false, 'error', 'NO_ACTIVE_SUBSCRIPTION');
  end if;

  if coalesce(v_subscription.projects_used, 0) >= coalesce(v_subscription.projects_limit, 0) then
    update public.commercial_workspace_subscriptions
      set status = 'exhausted', updated_at = now()
    where id = v_subscription.id
      and status = 'active';

    return jsonb_build_object(
      'ok', false,
      'active', true,
      'limit_reached', true,
      'remaining', 0,
      'subscription_id', v_subscription.id
    );
  end if;

  insert into public.commercial_workspace_subscription_projects(subscription_id, workspace_id, project_id)
  values (v_subscription.id, p_workspace_id, p_project_id)
  on conflict (project_id) do nothing;

  get diagnostics v_row_count = row_count;

  if v_row_count = 0 then
    return jsonb_build_object('ok', true, 'already', true, 'subscription_id', v_subscription.id);
  end if;

  update public.commercial_workspace_subscriptions
    set projects_used = projects_used + 1,
        status = case when projects_used + 1 >= projects_limit then 'exhausted' else status end,
        updated_at = now()
  where id = v_subscription.id
  returning projects_used into v_new_used;

  return jsonb_build_object(
    'ok', true,
    'applied', true,
    'subscription_id', v_subscription.id,
    'used', v_new_used,
    'limit', v_subscription.projects_limit,
    'remaining', greatest(0, v_subscription.projects_limit - v_new_used)
  );
end;
$$;

revoke all on function public.consume_commercial_workspace_subscription(uuid, uuid) from public;
grant execute on function public.consume_commercial_workspace_subscription(uuid, uuid) to service_role;
