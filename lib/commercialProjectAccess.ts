import type { SupabaseClient } from "@supabase/supabase-js";
import { isAdminEmail } from "@/lib/admin";
import type { AuthedUser } from "@/lib/serverAuth";

export type CommercialProjectAccess = {
  found: boolean;
  allowed: boolean;
  project: {
    id: string;
    workspace_id: string;
    created_by: string | null;
  } | null;
  workspace: {
    workspace_id: string;
    name: string;
    role: string | null;
  } | null;
  reason: "not_found" | "global_admin" | "project_creator" | "workspace_owner" | "workspace_member" | "forbidden";
};

export async function canAccessCommercialProject(
  supabaseAdmin: SupabaseClient,
  user: AuthedUser,
  projectId: string
): Promise<CommercialProjectAccess> {
  const { data: project, error: projectError } = await supabaseAdmin
    .from("commercial_projects")
    .select("id, workspace_id, created_by")
    .eq("id", projectId)
    .maybeSingle();

  if (projectError) throw projectError;
  if (!(project as any)?.id || !(project as any)?.workspace_id) {
    return {
      found: false,
      allowed: false,
      project: null,
      workspace: null,
      reason: "not_found",
    };
  }

  const workspaceId = String((project as any).workspace_id);
  const [workspaceResp, membershipResp] = await Promise.all([
    supabaseAdmin
      .from("commercial_workspaces")
      .select("id, name, owner_user_id")
      .eq("id", workspaceId)
      .maybeSingle(),
    supabaseAdmin
      .from("commercial_workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  if (workspaceResp.error) throw workspaceResp.error;
  if (membershipResp.error) throw membershipResp.error;

  const workspaceRow = workspaceResp.data as any;
  const membershipRow = membershipResp.data as any;
  const createdBy = (project as any).created_by ? String((project as any).created_by) : null;
  const workspaceName = String(workspaceRow?.name || "");
  const memberRole = membershipRow?.role ? String(membershipRow.role) : null;
  const isGlobalAdmin = isAdminEmail(user.email);
  const isProjectCreator = Boolean(createdBy) && createdBy === user.id;
  const isWorkspaceOwner = Boolean(workspaceRow?.owner_user_id) && String(workspaceRow.owner_user_id) === user.id;
  const isWorkspaceMember = Boolean(memberRole);

  const base = {
    found: true as const,
    project: {
      id: String((project as any).id),
      workspace_id: workspaceId,
      created_by: createdBy,
    },
    workspace: {
      workspace_id: workspaceId,
      name: workspaceName,
      role: memberRole,
    },
  };

  if (isGlobalAdmin) {
    return {
      ...base,
      allowed: true,
      workspace: { ...base.workspace, role: memberRole || "admin" },
      reason: "global_admin",
    };
  }

  if (isProjectCreator) {
    return {
      ...base,
      allowed: true,
      workspace: { ...base.workspace, role: memberRole || "owner" },
      reason: "project_creator",
    };
  }

  if (isWorkspaceOwner) {
    return {
      ...base,
      allowed: true,
      workspace: { ...base.workspace, role: memberRole || "owner" },
      reason: "workspace_owner",
    };
  }

  if (isWorkspaceMember) {
    return {
      ...base,
      allowed: true,
      reason: "workspace_member",
    };
  }

  return {
    ...base,
    allowed: false,
    workspace: { ...base.workspace, role: null },
    reason: "forbidden",
  };
}
