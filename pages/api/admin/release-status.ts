import type { NextApiRequest, NextApiResponse } from "next";
import { ensureRequestId, logApiError } from "@/lib/apiObservability";
import { isAdminEmail } from "@/lib/admin";
import { buildReleaseStatusReport } from "@/lib/releaseStatus";
import { requireUser } from "@/lib/serverAuth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const requestId = ensureRequestId(req, res);
  if (req.method !== "GET") return res.status(405).json({ ok: false, request_id: requestId, error: "Method not allowed" });

  const authed = await requireUser(req, res, { requireEmail: true });
  if (!authed) return;
  if (!isAdminEmail(authed.user.email)) {
    return res.status(403).json({ ok: false, request_id: requestId, error: "Access denied" });
  }

  try {
    const report = await buildReleaseStatusReport({ req, bearerToken: authed.token });
    return res.status(200).json({ ok: true, request_id: requestId, report });
  } catch (error: any) {
    logApiError("admin.release-status", requestId, error);
    return res.status(500).json({ ok: false, request_id: requestId, error: error?.message || "Не удалось собрать release status" });
  }
}
