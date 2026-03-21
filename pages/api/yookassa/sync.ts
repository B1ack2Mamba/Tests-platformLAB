import type { NextApiRequest, NextApiResponse } from "next";
import { PAYMENTS_ENABLED } from "@/lib/payments";

type Resp =
  | { ok: true; checked: number; credited: number; updated: number; skipped?: boolean }
  | { ok: false; error: string };

function wantsExplicitSync(req: NextApiRequest) {
  const forceQuery = req.query.force === "1" || req.query.paid === "1" || req.query.returned === "1";
  const body = typeof req.body === "object" && req.body ? req.body : {};
  const forceBody = body.force === true || body.paid === true || body.returned === true;
  return forceQuery || forceBody;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Resp>) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  // IMPORTANT:
  // - Opening /wallet must never auto-trigger a live YooKassa sync.
  // - In dev mode old client code / Fast Refresh may still hit this route.
  // - We therefore no-op unless payments are explicitly enabled AND the caller
  //   clearly indicates this request comes from a real payment return flow.
  if (!PAYMENTS_ENABLED || !wantsExplicitSync(req)) {
    return res.status(200).json({ ok: true, checked: 0, credited: 0, updated: 0, skipped: true });
  }

  // Real sync can be implemented on top of webhook / explicit return handling.
  return res.status(200).json({ ok: true, checked: 0, credited: 0, updated: 0, skipped: true });
}
