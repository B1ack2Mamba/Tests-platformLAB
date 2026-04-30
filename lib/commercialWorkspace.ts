import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthedUser } from "@/lib/serverAuth";

async function findWorkspaceByMembership(supabaseAdmin: SupabaseClient, userId: string) {
  const { data: existingMember, error: memberError } = await supabaseAdmin
    .from("commercial_workspace_members")
    .select("workspace_id, role, commercial_workspaces(id, name)")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (memberError) throw memberError;

  const memberWorkspace = (existingMember as any)?.commercial_workspaces;
  if (!existingMember?.workspace_id || !memberWorkspace?.id) return null;

  return {
    workspace_id: existingMember.workspace_id as string,
    role: (existingMember as any)?.role || "owner",
    name: memberWorkspace.name as string,
  };
}

async function findWorkspaceByOwner(supabaseAdmin: SupabaseClient, userId: string) {
  const { data: workspace, error } = await supabaseAdmin
    .from("commercial_workspaces")
    .select("id, name")
    .eq("owner_user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!(workspace as any)?.id) return null;

  return {
    workspace_id: (workspace as any).id as string,
    role: "owner" as const,
    name: ((workspace as any).name || "").toString(),
  };
}

export async function ensureWorkspaceForUser(supabaseAdmin: SupabaseClient, user: AuthedUser) {
  const existingMembership = await findWorkspaceByMembership(supabaseAdmin, user.id);
  if (existingMembership) return existingMembership;

  const existingOwnedWorkspace = await findWorkspaceByOwner(supabaseAdmin, user.id);
  if (existingOwnedWorkspace) {
    const { error: linkError } = await supabaseAdmin.from("commercial_workspace_members").upsert(
      {
        workspace_id: existingOwnedWorkspace.workspace_id,
        user_id: user.id,
        role: "owner",
      },
      { onConflict: "workspace_id,user_id" }
    );

    if (linkError) throw linkError;
    return existingOwnedWorkspace;
  }

  const defaultName =
    ((user.user_metadata as any)?.company_name || (user.user_metadata as any)?.full_name || user.email || "Моя организация").toString().trim() ||
    "Моя организация";

  const { data: workspace, error: workspaceError } = await supabaseAdmin
    .from("commercial_workspaces")
    .insert({ owner_user_id: user.id, name: defaultName })
    .select("id, name")
    .single();

  if (workspaceError) {
    const fallbackWorkspace = await findWorkspaceByOwner(supabaseAdmin, user.id);
    if (!fallbackWorkspace) throw workspaceError;

    const { error: linkError } = await supabaseAdmin.from("commercial_workspace_members").upsert(
      {
        workspace_id: fallbackWorkspace.workspace_id,
        user_id: user.id,
        role: "owner",
      },
      { onConflict: "workspace_id,user_id" }
    );

    if (linkError) throw linkError;
    return fallbackWorkspace;
  }

  const { error: linkError } = await supabaseAdmin.from("commercial_workspace_members").upsert(
    {
      workspace_id: (workspace as any).id,
      user_id: user.id,
      role: "owner",
    },
    { onConflict: "workspace_id,user_id" }
  );

  if (linkError) throw linkError;

  return {
    workspace_id: (workspace as any).id as string,
    role: "owner",
    name: (workspace as any).name as string,
  };
}
