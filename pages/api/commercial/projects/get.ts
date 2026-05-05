import type { NextApiRequest, NextApiResponse } from "next";
import { ensureRequestId, logApiError } from "@/lib/apiObservability";
import { requireUser } from "@/lib/serverAuth";
import { canAccessCommercialProject } from "@/lib/commercialProjectAccess";
import { parseProjectSummary } from "@/lib/projectRoutingMeta";
import { getTestDisplayTitle } from "@/lib/testTitles";
import { getActiveWorkspaceSubscription } from "@/lib/serverWorkspaceSubscription";
import { isRegistrySchemaMissing } from "@/lib/registrySchema";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const requestId = ensureRequestId(req, res);
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const authed = await requireUser(req, res);
  if (!authed) return;

  const id = typeof req.query.id === "string" ? req.query.id : "";
  if (!id) return res.status(400).json({ ok: false, error: "id is required" });

  try {
    const access = await canAccessCommercialProject(authed.supabaseAdmin, authed.user, id);
    if (!access.found) return res.status(404).json({ ok: false, request_id: requestId, error: "Проект не найден" });
    if (!access.allowed) return res.status(403).json({ ok: false, request_id: requestId, error: "Нет доступа к проекту" });
    const workspace = access.workspace!;
    const [{ data, error }, { data: subscriptionCoverage, error: subscriptionError }, activeSubscription] = await Promise.all([
      authed.supabaseAdmin
      .from("commercial_projects")
      .select(`
        id,
        title,
        goal,
        package_mode,
        unlocked_package_mode,
        unlocked_package_paid_at,
        unlocked_package_price_kopeks,
        target_role,
        registry_comment,
        registry_comment_updated_at,
        status,
        summary,
        invite_token,
        created_at,
        commercial_people(id, full_name, email, current_position, notes),
        commercial_project_tests(test_slug, test_title, sort_order),
        commercial_project_attempts(test_slug, test_title, result, created_at)
      `)
      .eq("id", id)
      .maybeSingle(),
      authed.supabaseAdmin
        .from("commercial_workspace_subscription_projects")
        .select("subscription_id")
        .eq("project_id", id)
        .maybeSingle(),
      getActiveWorkspaceSubscription(authed.supabaseAdmin, workspace.workspace_id),
    ]);

    let projectData: any = data;
    let projectError: any = error;
    if (isRegistrySchemaMissing(projectError)) {
      const fallback = await authed.supabaseAdmin
        .from("commercial_projects")
        .select(`
          id,
          title,
          goal,
          package_mode,
          unlocked_package_mode,
          unlocked_package_paid_at,
          unlocked_package_price_kopeks,
          target_role,
          status,
          summary,
          invite_token,
          created_at,
          commercial_people(id, full_name, email, current_position, notes),
          commercial_project_tests(test_slug, test_title, sort_order),
          commercial_project_attempts(test_slug, test_title, result, created_at)
        `)
        .eq("id", id)
        .maybeSingle();
      projectData = fallback.data;
      projectError = fallback.error;
    }

    if (projectError) throw projectError;
    if (subscriptionError) throw subscriptionError;
    if (!projectData) return res.status(404).json({ ok: false, error: "Проект не найден" });

    const parsedSummary = parseProjectSummary((projectData as any).summary);

    return res.status(200).json({
      ok: true,
      request_id: requestId,
      workspace,
      active_subscription: activeSubscription,
      project: {
        id: (projectData as any).id,
        title: (projectData as any).title,
        goal: (projectData as any).goal,
        package_mode: (projectData as any).package_mode,
        unlocked_package_mode: (projectData as any).unlocked_package_mode || null,
        unlocked_package_paid_at: (projectData as any).unlocked_package_paid_at || null,
        unlocked_package_price_kopeks: Number((projectData as any).unlocked_package_price_kopeks || 0),
        subscription_applied: Boolean((subscriptionCoverage as any)?.subscription_id),
        target_role: (projectData as any).target_role,
        registry_comment: (projectData as any).registry_comment || null,
        registry_comment_updated_at: (projectData as any).registry_comment_updated_at || null,
        status: (projectData as any).status,
        summary: parsedSummary.text || null,
        routing_meta: parsedSummary.meta,
        created_at: (projectData as any).created_at,
        invite_token: (projectData as any).invite_token || null,
        person: (projectData as any).commercial_people || null,
        tests: ((projectData as any).commercial_project_tests || [])
          .map((item: any) => ({
            ...item,
            test_title: getTestDisplayTitle(item?.test_slug, item?.test_title),
          }))
          .sort((a: any, b: any) => a.sort_order - b.sort_order),
        attempts: ((projectData as any).commercial_project_attempts || []).map((item: any) => ({
          ...item,
          test_title: getTestDisplayTitle(item?.test_slug, item?.test_title),
        })),
      },
    });
  } catch (error: any) {
    logApiError("commercial.projects.get", requestId, error, { project_id: id });
    return res.status(400).json({ ok: false, request_id: requestId, error: error?.message || "Не удалось загрузить проект" });
  }
}
