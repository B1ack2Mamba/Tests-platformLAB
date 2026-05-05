import crypto from "node:crypto";
import type { NextApiRequest, NextApiResponse } from "next";

export function ensureRequestId(req: NextApiRequest, res: NextApiResponse) {
  const headerValue = req.headers["x-request-id"];
  const requestId =
    (Array.isArray(headerValue) ? headerValue[0] : headerValue)?.trim() ||
    crypto.randomUUID();
  res.setHeader("X-Request-Id", requestId);
  return requestId;
}

export function logApiError(scope: string, requestId: string, error: unknown, extra?: Record<string, unknown>) {
  const message = error instanceof Error ? error.message : String(error || "");
  console.error(`[api:${scope}]`, {
    request_id: requestId,
    message,
    ...(extra || {}),
  });
}

