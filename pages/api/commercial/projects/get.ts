import type { NextApiRequest, NextApiResponse } from "next";
import { requireUser } from "@/lib/serverAuth";
import { ensureWorkspaceForUser } from "@/lib/commercialWorkspace";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const authed = await requireUser(req, res);
  if (!authed) return;

  const id = typeof req.query.id === "string" ? req.query.id : "";
  if (!id) return res.status(400).json({ ok: false, error: "id is required" });

  try {
    const workspace = await ensureWorkspaceForUser(authed.supabaseAdmin, authed.user);
    const { data, error } = await authed.supabaseAdmin
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
      .eq("workspace_id", workspace.workspace_id)
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ ok: false, error: "Проект не найден" });

    return res.status(200).json({
      ok: true,
      workspace,
      project: {
        id: (data as any).id,
        title: (data as any).title,
        goal: (data as any).goal,
        package_mode: (data as any).package_mode,
        unlocked_package_mode: (data as any).unlocked_package_mode || null,
        unlocked_package_paid_at: (data as any).unlocked_package_paid_at || null,
        unlocked_package_price_kopeks: Number((data as any).unlocked_package_price_kopeks || 0),
        target_role: (data as any).target_role,
        status: (data as any).status,
        summary: (data as any).summary,
        created_at: (data as any).created_at,
        invite_token: (data as any).invite_token || null,
        person: (data as any).commercial_people || null,
        tests: ((data as any).commercial_project_tests || []).sort((a: any, b: any) => a.sort_order - b.sort_order),
        attempts: (data as any).commercial_project_attempts || [],
      },
    });
  } catch (error: any) {
    return res.status(400).json({ ok: false, error: error?.message || "Не удалось загрузить проект" });
  }
}
