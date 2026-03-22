import type { NextApiRequest, NextApiResponse } from "next";
import { requireUser } from "@/lib/serverAuth";
import { ensureWorkspaceForUser } from "@/lib/commercialWorkspace";
import { getTestDisplayTitle } from "@/lib/testTitles";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const authed = await requireUser(req, res);
  if (!authed) return;

  try {
    const workspace = await ensureWorkspaceForUser(authed.supabaseAdmin, authed.user);
    const [{ data: folders, error: foldersError }, { data, error }] = await Promise.all([
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
    ]);

    if (foldersError) throw foldersError;
    if (error) throw error;

    return res.status(200).json({
      ok: true,
      workspace,
      folders: folders || [],
      projects: (data || []).map((item: any) => ({
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
    });
  } catch (error: any) {
    return res.status(400).json({ ok: false, error: error?.message || "Не удалось загрузить проекты" });
  }
}
