import type { NextApiRequest, NextApiResponse } from "next";
import { ensureRequestId, logApiError } from "@/lib/apiObservability";
import { requireUser } from "@/lib/serverAuth";
import { canAccessCommercialProject } from "@/lib/commercialProjectAccess";
import { parseProjectSummary } from "@/lib/projectRoutingMeta";
import { buildProjectResultsBlueprint } from "@/lib/projectResultsBlueprint";
import { isRegistrySchemaMissing } from "@/lib/registrySchema";

type ResponseBody =
  | {
      ok: true;
      request_id: string;
      fully_done: boolean;
      completed: number;
      total: number;
      collected_at: string | null;
      collect_mode: "view" | "collect";
      project: {
        id: string;
        title: string;
        goal: string;
        status: string | null;
        package_mode: string | null;
        unlocked_package_mode: string | null;
        target_role: string | null;
        registry_comment: string | null;
        registry_comment_updated_at: string | null;
        routing_meta: ReturnType<typeof parseProjectSummary>["meta"];
        person: {
          full_name: string | null;
          email: string | null;
          current_position: string | null;
        } | null;
      };
      blueprint: ReturnType<typeof buildProjectResultsBlueprint> | null;
    }
  | { ok: false; request_id: string; error: string };

async function buildResponse(req: NextApiRequest, res: NextApiResponse<ResponseBody>, explicitCollect: boolean) {
  const requestId = ensureRequestId(req, res);
  const authed = await requireUser(req, res);
  if (!authed) return;

  const id = typeof req.query.id === "string" ? req.query.id : "";
  if (!id) return res.status(400).json({ ok: false, request_id: requestId, error: "id is required" });

  try {
    const access = await canAccessCommercialProject(authed.supabaseAdmin, authed.user, id);
    if (!access.found) return res.status(404).json({ ok: false, request_id: requestId, error: "Проект не найден" });
    if (!access.allowed) return res.status(403).json({ ok: false, request_id: requestId, error: "Нет доступа к проекту" });
    const baseSelect = `
        id,
        title,
        goal,
        status,
        package_mode,
        unlocked_package_mode,
        target_role,
        summary,
        commercial_people(full_name, email, current_position),
        commercial_project_tests(test_slug, test_title, sort_order),
        commercial_project_attempts(test_slug, test_title, result, created_at)
      `;
    const initialProject = await authed.supabaseAdmin
      .from("commercial_projects")
      .select(`
        id,
        title,
        goal,
        status,
        package_mode,
        unlocked_package_mode,
        target_role,
        registry_comment,
        registry_comment_updated_at,
        summary,
        commercial_people(full_name, email, current_position),
        commercial_project_tests(test_slug, test_title, sort_order),
        commercial_project_attempts(test_slug, test_title, result, created_at)
      `)
      .eq("id", id)
      .maybeSingle();
    let data: any = initialProject.data;
    let error: any = initialProject.error;
    if (isRegistrySchemaMissing(error)) {
      const fallback = await authed.supabaseAdmin
        .from("commercial_projects")
        .select(baseSelect)
        .eq("id", id)
        .maybeSingle();
      data = fallback.data;
      error = fallback.error;
    }

    if (error) throw error;
    if (!data) return res.status(404).json({ ok: false, request_id: requestId, error: "Проект не найден" });

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
      request_id: requestId,
      fully_done,
      completed,
      total,
      collected_at: explicitCollect ? new Date().toISOString() : null,
      collect_mode: explicitCollect ? "collect" : "view",
      project: {
        id: String((data as any).id),
        title: String((data as any).title || ""),
        goal: String((data as any).goal || "general_assessment"),
        status: ((data as any).status as string | null) || null,
        package_mode: ((data as any).package_mode as string | null) || null,
        unlocked_package_mode: ((data as any).unlocked_package_mode as string | null) || null,
        target_role: ((data as any).target_role as string | null) || null,
        registry_comment: ((data as any).registry_comment as string | null) || null,
        registry_comment_updated_at: ((data as any).registry_comment_updated_at as string | null) || null,
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
    logApiError("commercial.projects.results-map", requestId, error, { project_id: id, collect: explicitCollect });
    return res.status(400).json({ ok: false, request_id: requestId, error: error?.message || "Не удалось собрать страницу результатов" });
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<ResponseBody>) {
  if (req.method !== "GET" && req.method !== "POST") {
    const requestId = ensureRequestId(req, res);
    return res.status(405).json({ ok: false, request_id: requestId, error: "Method not allowed" });
  }
  return buildResponse(req, res, req.method === "POST");
}
