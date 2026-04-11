import type { NextApiRequest, NextApiResponse } from "next";
import { requireUser } from "@/lib/serverAuth";
import { ensureWorkspaceForUser } from "@/lib/commercialWorkspace";
import { parseProjectSummary } from "@/lib/projectRoutingMeta";
import { buildProjectResultsBlueprint } from "@/lib/projectResultsBlueprint";

type ResponseBody =
  | {
      ok: true;
      fully_done: boolean;
      completed: number;
      total: number;
      project: {
        id: string;
        title: string;
        goal: string;
        status: string | null;
        target_role: string | null;
        routing_meta: ReturnType<typeof parseProjectSummary>["meta"];
        person: {
          full_name: string | null;
          email: string | null;
          current_position: string | null;
        } | null;
      };
      blueprint: ReturnType<typeof buildProjectResultsBlueprint> | null;
    }
  | { ok: false; error: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse<ResponseBody>) {
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
        status,
        target_role,
        summary,
        commercial_people(full_name, email, current_position),
        commercial_project_tests(test_slug, test_title, sort_order),
        commercial_project_attempts(test_slug, test_title, result, created_at)
      `)
      .eq("workspace_id", workspace.workspace_id)
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ ok: false, error: "Проект не найден" });

    const parsedSummary = parseProjectSummary((data as any).summary);
    const tests = (((data as any).commercial_project_tests || []) as Array<any>).map((item) => ({
      test_slug: String(item?.test_slug || ""),
      test_title: item?.test_title ? String(item.test_title) : null,
      sort_order: typeof item?.sort_order === "number" ? item.sort_order : null,
    }));
    const attempts = (((data as any).commercial_project_attempts || []) as Array<any>).map((item) => ({
      test_slug: String(item?.test_slug || ""),
      test_title: item?.test_title ? String(item.test_title) : null,
      result: item?.result ?? null,
    }));

    const completed = new Set(attempts.map((item) => item.test_slug).filter(Boolean)).size;
    const total = tests.length;
    const fully_done = total > 0 && completed >= total;

    let promptRows: Array<any> = [];
    const competencyIds = parsedSummary.meta?.mode === "competency" ? parsedSummary.meta.competencyIds || [] : [];
    if (competencyIds.length) {
      const promptResponse = await authed.supabaseAdmin
        .from("commercial_competency_prompts")
        .select("competency_id, system_prompt, prompt_template, notes, is_active")
        .in("competency_id", competencyIds);
      if (!promptResponse.error && Array.isArray(promptResponse.data)) {
        promptRows = promptResponse.data;
      }
    } else {
      const promptResponse = await authed.supabaseAdmin
        .from("commercial_competency_prompts")
        .select("competency_id, system_prompt, prompt_template, notes, is_active");
      if (!promptResponse.error && Array.isArray(promptResponse.data)) {
        promptRows = promptResponse.data;
      }
    }

    const blueprint = fully_done
      ? buildProjectResultsBlueprint({
          project: {
            title: String((data as any).title || ""),
            goal: String((data as any).goal || "general_assessment"),
            target_role: (data as any).target_role || null,
            current_position: (data as any).commercial_people?.current_position || null,
            routing_meta: parsedSummary.meta,
          },
          tests,
          attempts,
          promptRows,
        })
      : null;

    return res.status(200).json({
      ok: true,
      fully_done,
      completed,
      total,
      project: {
        id: String((data as any).id),
        title: String((data as any).title || ""),
        goal: String((data as any).goal || "general_assessment"),
        status: ((data as any).status as string | null) || null,
        target_role: ((data as any).target_role as string | null) || null,
        routing_meta: parsedSummary.meta,
        person: (data as any).commercial_people
          ? {
              full_name: (data as any).commercial_people.full_name || null,
              email: (data as any).commercial_people.email || null,
              current_position: (data as any).commercial_people.current_position || null,
            }
          : null,
      },
      blueprint,
    });
  } catch (error: any) {
    return res.status(400).json({ ok: false, error: error?.message || "Не удалось собрать страницу результатов" });
  }
}
