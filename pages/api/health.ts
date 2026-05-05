import type { NextApiRequest, NextApiResponse } from "next";
import { ensureRequestId } from "@/lib/apiObservability";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const requestId = ensureRequestId(req, res);
  res.status(200).json({
    ok: true,
    ts: Date.now(),
    request_id: requestId,
    version: process.env.VERCEL_GIT_COMMIT_SHA || process.env.npm_package_version || "unknown",
  });
}
