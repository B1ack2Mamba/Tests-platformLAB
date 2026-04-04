import type { NextApiRequest, NextApiResponse } from "next";
import { assertAdmin } from "@/lib/serverAdmin";
import { deleteFitConfigRow, listFitConfigRows, seedFitConfigDefaults, upsertFitConfigRow } from "@/lib/serverFitConfig";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await assertAdmin(req, res);
  if (!admin) return;

  if (req.method === "GET") {
    const result = await listFitConfigRows();
    return res.status(200).json({ ok: true, ...result });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const action = String((req.body || {}).action || "save");

    if (action === "seed") {
      const count = await seedFitConfigDefaults(admin.user.id);
      return res.status(200).json({ ok: true, seeded: count });
    }

    if (action === "delete") {
      const id = String((req.body || {}).id || "").trim();
      if (!id) return res.status(400).json({ ok: false, error: "id is required" });
      await deleteFitConfigRow(id);
      return res.status(200).json({ ok: true });
    }

    const item = (req.body || {}).item || {};
    const saved = await upsertFitConfigRow({ ...item, updated_by: admin.user.id });
    return res.status(200).json({ ok: true, item: saved });
  } catch (error: any) {
    return res.status(400).json({ ok: false, error: error?.message || "Не удалось сохранить матрицу" });
  }
}
