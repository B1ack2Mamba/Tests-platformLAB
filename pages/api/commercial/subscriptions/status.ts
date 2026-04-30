import type { NextApiRequest, NextApiResponse } from "next";
import { requireUser } from "@/lib/serverAuth";
import { ensureWorkspaceForUser } from "@/lib/commercialWorkspace";
import { getActiveWorkspaceSubscription } from "@/lib/serverWorkspaceSubscription";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const authed = await requireUser(req, res);
  if (!authed) return;

  try {
    const workspace = await ensureWorkspaceForUser(authed.supabaseAdmin, authed.user);
    const activePlan = await getActiveWorkspaceSubscription(authed.supabaseAdmin, workspace.workspace_id);

    return res.status(200).json({ ok: true, workspace, active_subscription: activePlan });
  } catch (err: any) {
    return res.status(400).json({ ok: false, error: err?.message || "Не удалось загрузить тариф" });
  }
}
