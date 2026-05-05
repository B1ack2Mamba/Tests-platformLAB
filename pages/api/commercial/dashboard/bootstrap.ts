import type { NextApiRequest, NextApiResponse } from "next";
import { ensureRequestId, logApiError } from "@/lib/apiObservability";
import { requireUser } from "@/lib/serverAuth";
import { ensureWorkspaceForUser } from "@/lib/commercialWorkspace";
import { getTestDisplayTitle } from "@/lib/testTitles";
import { getActiveWorkspaceSubscription } from "@/lib/serverWorkspaceSubscription";
import { pickSceneStandard } from "@/lib/globalDeskTemplate";

const SETTING_KEY = "desk_templates";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const requestId = ensureRequestId(req, res);
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const authed = await requireUser(req, res);
  if (!authed) return;

  try {
    const workspace = await ensureWorkspaceForUser(authed.supabaseAdmin, authed.user);

    const [
      { data: profile },
      { count },
      { data: uniqRows },
      { data: folders, error: foldersError },
      { data: projects, error: projectsError },
      { data: sceneSetting, error: sceneError },
      activeSubscription,
    ] = await Promise.all([
      authed.supabaseAdmin
        .from("commercial_profiles")
        .select("id, email, full_name, company_name")
        .eq("id", authed.user.id)
        .maybeSingle(),
      authed.supabaseAdmin
        .from("commercial_attempts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", authed.user.id),
      authed.supabaseAdmin
        .from("commercial_attempts")
        .select("test_slug")
        .eq("user_id", authed.user.id),
      authed.supabaseAdmin
        .from("commercial_project_folders")
        .select("id, name, icon_key, sort_order, created_at")
        .eq("workspace_id", workspace.workspace_id)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      authed.supabaseAdmin
        .from("commercial_projects")
        .select(`
          id,
          title,
          goal,
          package_mode,
          target_role,
          status,
          invite_token,
          folder_id,
          created_at,
          commercial_people(id, full_name, email, current_position),
          commercial_project_tests(test_slug, test_title, sort_order),
          commercial_project_attempts(test_slug)
        `)
        .eq("workspace_id", workspace.workspace_id)
        .order("created_at", { ascending: false }),
      authed.supabaseAdmin
        .from("commercial_global_settings")
        .select("setting_value")
        .eq("setting_key", SETTING_KEY)
        .maybeSingle(),
      getActiveWorkspaceSubscription(authed.supabaseAdmin, workspace.workspace_id),
    ]);

    if (foldersError) throw foldersError;
    if (projectsError) throw projectsError;
    if (sceneError && (sceneError as any)?.code !== "42P01") throw sceneError;

    const standard = pickSceneStandard((sceneSetting as any)?.setting_value?.standard || (sceneSetting as any)?.setting_value || {});

    return res.status(200).json({
      ok: true,
      request_id: requestId,
      profile: profile || {
        email: authed.user.email,
        full_name: (authed.user.user_metadata as any)?.full_name || null,
        company_name: (authed.user.user_metadata as any)?.company_name || null,
      },
      stats: {
        attempts_count: count || 0,
        unique_tests_count: new Set((uniqRows || []).map((x: any) => String(x.test_slug))).size,
      },
      workspace,
      folders: folders || [],
      projects: (projects || []).map((item: any) => ({
        id: item.id,
        title: item.title,
        goal: item.goal,
        package_mode: item.package_mode,
        target_role: item.target_role,
        status: item.status,
        created_at: item.created_at,
        invite_token: item.invite_token || null,
        folder_id: item.folder_id || null,
        person: item.commercial_people || null,
        tests: (item.commercial_project_tests || [])
          .map((test: any) => ({
            ...test,
            test_title: getTestDisplayTitle(test?.test_slug, test?.test_title),
          }))
          .sort((a: any, b: any) => a.sort_order - b.sort_order),
        attempts_count: (item.commercial_project_attempts || []).length,
      })),
      active_subscription: activeSubscription,
      shared_scene_standard: standard,
    });
  } catch (error: any) {
    logApiError("commercial.dashboard.bootstrap", requestId, error);
    return res.status(400).json({ ok: false, request_id: requestId, error: error?.message || "Не удалось загрузить кабинет" });
  }
}
