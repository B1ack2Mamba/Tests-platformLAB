import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { getTestDisplayTitle } from "@/lib/testTitles";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Server env missing: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const body = typeof req.body === "object" && req.body ? req.body : {};
  const token = String(body.token || "").trim();
  const testSlug = String(body.test_slug || "").trim();
  const testTitle = getTestDisplayTitle(testSlug, String(body.test_title || testSlug).trim());
  const result = body.result;

  if (!token || !testSlug || !result) {
    return res.status(400).json({ ok: false, error: "token, test_slug and result are required" });
  }

  try {
    const supabaseAdmin = getAdminClient();

    const { data: project, error: projectError } = await supabaseAdmin
      .from("commercial_projects")
      .select("id, status")
      .eq("invite_token", token)
      .maybeSingle();

    if (projectError) throw projectError;
    if (!project) return res.status(404).json({ ok: false, error: "Проект по ссылке не найден" });

    const { data: assignedTests, error: assignedTestsError } = await supabaseAdmin
      .from("commercial_project_tests")
      .select("test_slug")
      .eq("project_id", (project as any).id);

    if (assignedTestsError) throw assignedTestsError;

    const assignedSlugs = new Set((assignedTests || []).map((item: any) => String(item.test_slug || "").trim()).filter(Boolean));
    if (!assignedSlugs.has(testSlug)) {
      return res.status(400).json({ ok: false, error: "Этот тест не назначен для проекта" });
    }

    const { error: attemptError } = await supabaseAdmin
      .from("commercial_project_attempts")
      .upsert(
        {
          project_id: (project as any).id,
          test_slug: testSlug,
          test_title: testTitle,
          result,
        },
        { onConflict: "project_id,test_slug" }
      );

    if (attemptError) throw attemptError;

    const { data: attemptRows, error: attemptsError } = await supabaseAdmin
      .from("commercial_project_attempts")
      .select("test_slug")
      .eq("project_id", (project as any).id);

    if (attemptsError) throw attemptsError;

    const completedAssignedCount = new Set(
      (attemptRows || [])
        .map((item: any) => String(item.test_slug || "").trim())
        .filter((slug) => assignedSlugs.has(slug))
    ).size;
    const testsCount = assignedSlugs.size;
    const nextStatus = testsCount > 0 && completedAssignedCount >= testsCount ? "completed" : "in_progress";
    await supabaseAdmin.from("commercial_projects").update({ status: nextStatus }).eq("id", (project as any).id);

    return res.status(200).json({
      ok: true,
      status: nextStatus,
      progress: { completed: completedAssignedCount, total: testsCount },
    });
  } catch (error: any) {
    return res.status(400).json({ ok: false, error: error?.message || "Не удалось сохранить результат участника" });
  }
}
