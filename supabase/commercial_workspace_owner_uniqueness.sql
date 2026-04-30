with ranked as (
  select
    id,
    owner_user_id,
    row_number() over (partition by owner_user_id order by created_at asc, id asc) as rn,
    first_value(id) over (partition by owner_user_id order by created_at asc, id asc) as canonical_id
  from public.commercial_workspaces
),
duplicates as (
  select id as duplicate_id, canonical_id
  from ranked
  where rn > 1
),
move_members as (
  insert into public.commercial_workspace_members (workspace_id, user_id, role)
  select d.canonical_id, m.user_id, m.role
  from duplicates d
  join public.commercial_workspace_members m on m.workspace_id = d.duplicate_id
  on conflict (workspace_id, user_id) do update
  set role = excluded.role
  returning 1
)
update public.commercial_people p
set workspace_id = d.canonical_id
from duplicates d
where p.workspace_id = d.duplicate_id;

with ranked as (
  select
    id,
    owner_user_id,
    row_number() over (partition by owner_user_id order by created_at asc, id asc) as rn,
    first_value(id) over (partition by owner_user_id order by created_at asc, id asc) as canonical_id
  from public.commercial_workspaces
),
duplicates as (
  select id as duplicate_id, canonical_id
  from ranked
  where rn > 1
)
update public.commercial_project_folders f
set workspace_id = d.canonical_id
from duplicates d
where f.workspace_id = d.duplicate_id;

with ranked as (
  select
    id,
    owner_user_id,
    row_number() over (partition by owner_user_id order by created_at asc, id asc) as rn,
    first_value(id) over (partition by owner_user_id order by created_at asc, id asc) as canonical_id
  from public.commercial_workspaces
),
duplicates as (
  select id as duplicate_id, canonical_id
  from ranked
  where rn > 1
)
update public.commercial_projects p
set workspace_id = d.canonical_id
from duplicates d
where p.workspace_id = d.duplicate_id;

with ranked as (
  select
    id,
    owner_user_id,
    row_number() over (partition by owner_user_id order by created_at asc, id asc) as rn,
    first_value(id) over (partition by owner_user_id order by created_at asc, id asc) as canonical_id
  from public.commercial_workspaces
),
duplicates as (
  select id as duplicate_id, canonical_id
  from ranked
  where rn > 1
)
update public.commercial_support_messages m
set workspace_id = d.canonical_id
from duplicates d
where m.workspace_id = d.duplicate_id;

with ranked as (
  select
    id,
    owner_user_id,
    row_number() over (partition by owner_user_id order by created_at asc, id asc) as rn,
    first_value(id) over (partition by owner_user_id order by created_at asc, id asc) as canonical_id
  from public.commercial_workspaces
),
duplicates as (
  select id as duplicate_id, canonical_id
  from ranked
  where rn > 1
)
update public.commercial_support_threads t
set workspace_id = d.canonical_id
from duplicates d
where t.workspace_id = d.duplicate_id;

with ranked as (
  select
    id,
    owner_user_id,
    row_number() over (partition by owner_user_id order by created_at asc, id asc) as rn,
    first_value(id) over (partition by owner_user_id order by created_at asc, id asc) as canonical_id
  from public.commercial_workspaces
),
duplicates as (
  select id as duplicate_id, canonical_id
  from ranked
  where rn > 1
)
update public.commercial_workspace_subscription_projects sp
set workspace_id = d.canonical_id
from duplicates d
where sp.workspace_id = d.duplicate_id;

with ranked as (
  select
    id,
    owner_user_id,
    row_number() over (partition by owner_user_id order by created_at asc, id asc) as rn,
    first_value(id) over (partition by owner_user_id order by created_at asc, id asc) as canonical_id
  from public.commercial_workspaces
),
duplicates as (
  select id as duplicate_id, canonical_id
  from ranked
  where rn > 1
)
update public.commercial_workspace_subscriptions s
set workspace_id = d.canonical_id
from duplicates d
where s.workspace_id = d.duplicate_id;

with ranked as (
  select
    id,
    owner_user_id,
    row_number() over (partition by owner_user_id order by created_at asc, id asc) as rn
  from public.commercial_workspaces
),
duplicates as (
  select id as duplicate_id
  from ranked
  where rn > 1
)
delete from public.commercial_workspace_members m
using duplicates d
where m.workspace_id = d.duplicate_id;

with ranked as (
  select
    id,
    owner_user_id,
    row_number() over (partition by owner_user_id order by created_at asc, id asc) as rn
  from public.commercial_workspaces
),
duplicates as (
  select id as duplicate_id
  from ranked
  where rn > 1
)
delete from public.commercial_workspaces w
using duplicates d
where w.id = d.duplicate_id;

create unique index if not exists commercial_workspaces_owner_user_id_key
  on public.commercial_workspaces (owner_user_id);
