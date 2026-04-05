import type { NextApiRequest, NextApiResponse } from "next";
import { assertAdmin } from "@/lib/serverAdmin";
import {
  listCompetencyPromptRows,
  seedCompetencyPromptDefaults,
  upsertCompetencyPromptRow,
} from "@/lib/serverCompetencyPrompts";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await assertAdmin(req, res);
  if (!admin) return;

  if (req.method === "GET") {
    const result = await listCompetencyPromptRows();
    return res.status(200).json({ ok: true, ...result });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const action = String((req.body || {}).action || "save");
    if (action === "seed") {
      const count = await seedCompetencyPromptDefaults(admin.user.id);
      return res.status(200).json({ ok: true, seeded: count });
    }

    const item = (req.body || {}).item || {};
    const competencyId = String(item.competency_id || "").trim();
    if (!competencyId) return res.status(400).json({ ok: false, error: "competency_id is required" });

    const saved = await upsertCompetencyPromptRow({ ...item, competency_id: competencyId, updated_by: admin.user.id });
    return res.status(200).json({ ok: true, item: saved });
  } catch (error: any) {
    return res.status(400).json({ ok: false, error: error?.message || "Не удалось сохранить AI-шаблон" });
  }
}
