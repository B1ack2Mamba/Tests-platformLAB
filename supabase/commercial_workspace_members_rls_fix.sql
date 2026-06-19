-- Fix recursive RLS on commercial_workspace_members.
--
-- The previous membership policy checked membership by selecting from the same
-- table, which makes policies on workspace-owned tables fail with:
-- "infinite recursion detected in policy for relation commercial_workspace_members".

alter table public.commercial_workspace_members enable row level security;

drop policy if exists "Workspace members can view membership" on public.commercial_workspace_members;
create policy "Workspace members can view membership"
  on public.commercial_workspace_members
  for select
  using (user_id = auth.uid());

grant all privileges on table public.commercial_workspace_members to service_role;
