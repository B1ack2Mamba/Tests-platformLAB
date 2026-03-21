import type { NextApiRequest, NextApiResponse } from "next";
import { requireUser } from "@/lib/serverAuth";
import { ensureWorkspaceForUser } from "@/lib/commercialWorkspace";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const authed = await requireUser(req, res);
  if (!authed) return;

  try {
    const workspace = await ensureWorkspaceForUser(authed.supabaseAdmin, authed.user);
    return res.status(200).json({ ok: true, workspace });
  } catch (error: any) {
    return res.status(400).json({ ok: false, error: error?.message || "Не удалось подготовить рабочее пространство" });
  }
}
