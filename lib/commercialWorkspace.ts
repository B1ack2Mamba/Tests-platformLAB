import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthedUser } from "@/lib/serverAuth";

export async function ensureWorkspaceForUser(supabaseAdmin: SupabaseClient, user: AuthedUser) {
  const { data: existingMember, error: memberError } = await supabaseAdmin
    .from("commercial_workspace_members")
    .select("workspace_id, role, commercial_workspaces(id, name)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (memberError) throw memberError;

  const memberWorkspace = (existingMember as any)?.commercial_workspaces;
  if (existingMember?.workspace_id && memberWorkspace?.id) {
    return {
      workspace_id: existingMember.workspace_id as string,
      role: (existingMember as any)?.role || "owner",
      name: memberWorkspace.name as string,
    };
  }

  const defaultName =
    ((user.user_metadata as any)?.company_name || (user.user_metadata as any)?.full_name || user.email || "Моя организация").toString().trim() ||
    "Моя организация";

  const { data: workspace, error: workspaceError } = await supabaseAdmin
    .from("commercial_workspaces")
    .insert({ owner_user_id: user.id, name: defaultName })
    .select("id, name")
    .single();

  if (workspaceError) throw workspaceError;

  const { error: linkError } = await supabaseAdmin.from("commercial_workspace_members").insert({
    workspace_id: (workspace as any).id,
    user_id: user.id,
    role: "owner",
  });

  if (linkError) throw linkError;

  return {
    workspace_id: (workspace as any).id as string,
    role: "owner",
    name: (workspace as any).name as string,
  };
}
