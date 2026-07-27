import type { NextApiRequest, NextApiResponse } from "next";

import {
  createExecutiveLabAdminClient,
  executiveLabErrorMessage,
  isExecutiveLabEnabled,
} from "../../../lib/executiveLab";

function textValue(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export default async function handler(
  request: NextApiRequest,
  response: NextApiResponse<{ ok: true; id: string } | { ok: false; error: string }>,
) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ ok: false, error: "Метод не поддерживается" });
  }

  if (!isExecutiveLabEnabled()) {
    return response.status(404).json({ ok: false, error: "Executive Lab выключен" });
  }

  const title = textValue(request.body?.title, 120);
  const folderTitle = textValue(request.body?.folderTitle, 40) || title;
  if (title.length < 3) {
    return response.status(400).json({ ok: false, error: "Название должно содержать не менее 3 символов" });
  }

  try {
    const client = createExecutiveLabAdminClient();
    const { data: workspace, error: workspaceError } = await client
      .from("executive_lab_workspaces")
      .select("id")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (workspaceError) throw workspaceError;
    if (!workspace) throw new Error("Рабочее пространство не найдено");

    const { data, error } = await client
      .from("executive_lab_projects")
      .insert({
        workspace_id: workspace.id,
        title,
        folder_title: folderTitle,
        participant_count: 0,
        progress: 0,
        status: "Новый",
        disposition: "active",
        start_date: new Date().toISOString().slice(0, 10),
        sort_order: Math.floor(Date.now() / 1000),
      })
      .select("id")
      .single();

    if (error) throw error;
    return response.status(201).json({ ok: true, id: data.id });
  } catch (error) {
    const message = executiveLabErrorMessage(error, "Не удалось создать проект");
    return response.status(500).json({ ok: false, error: message });
  }
}
