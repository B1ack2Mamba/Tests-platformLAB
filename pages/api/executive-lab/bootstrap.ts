import type { NextApiRequest, NextApiResponse } from "next";

import {
  createExecutiveLabAdminClient,
  executiveLabErrorMessage,
  formatExecutiveDate,
  isExecutiveLabEnabled,
  type ExecutiveLabWorkspace,
} from "../../../lib/executiveLab";

type WorkspaceRow = {
  id: string;
  name: string;
  owner_name: string;
  owner_role: string;
  balance_kopeks: number | string;
  ai_efficiency: number;
};

type ProjectRow = {
  id: string;
  title: string;
  folder_title: string;
  participant_count: number;
  progress: number;
  status: string;
  disposition: "active" | "archived" | "trash";
  start_date: string;
};

export default async function handler(
  request: NextApiRequest,
  response: NextApiResponse<{ ok: true; workspace: ExecutiveLabWorkspace } | { ok: false; error: string }>,
) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ ok: false, error: "Метод не поддерживается" });
  }

  if (!isExecutiveLabEnabled()) {
    return response.status(404).json({ ok: false, error: "Executive Lab выключен" });
  }

  try {
    const client = createExecutiveLabAdminClient();
    const { data: workspaceData, error: workspaceError } = await client
      .from("executive_lab_workspaces")
      .select("id,name,owner_name,owner_role,balance_kopeks,ai_efficiency")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (workspaceError) throw workspaceError;
    if (!workspaceData) throw new Error("Рабочее пространство ещё не создано");

    const workspaceRow = workspaceData as WorkspaceRow;
    const { data: projectData, error: projectError } = await client
      .from("executive_lab_projects")
      .select("id,title,folder_title,participant_count,progress,status,disposition,start_date")
      .eq("workspace_id", workspaceRow.id)
      .order("sort_order", { ascending: true });

    if (projectError) throw projectError;

    const workspace: ExecutiveLabWorkspace = {
      id: workspaceRow.id,
      name: workspaceRow.name,
      ownerName: workspaceRow.owner_name,
      ownerRole: workspaceRow.owner_role,
      balanceKopeks: Number(workspaceRow.balance_kopeks),
      aiEfficiency: workspaceRow.ai_efficiency,
      projects: ((projectData ?? []) as ProjectRow[]).map((project) => ({
        id: project.id,
        title: project.title,
        folderTitle: project.folder_title,
        participants: project.participant_count,
        progress: project.progress,
        status: project.status,
        disposition: project.disposition,
        date: formatExecutiveDate(project.start_date),
      })),
    };

    response.setHeader("Cache-Control", "private, no-store");
    return response.status(200).json({ ok: true, workspace });
  } catch (error) {
    const message = executiveLabErrorMessage(error, "Не удалось загрузить Executive Lab");
    return response.status(500).json({ ok: false, error: message });
  }
}
