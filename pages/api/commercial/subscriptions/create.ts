import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import { requireUser } from "@/lib/serverAuth";
import { ensureWorkspaceForUser } from "@/lib/commercialWorkspace";
import { getMonthlyPlanDefinition, isMonthlyPlanKey } from "@/lib/commercialSubscriptions";

type OkResp = { ok: true; payment_id: string; confirmation_url: string };
type ErrResp = { ok: false; error: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse<OkResp | ErrResp>) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const authed = await requireUser(req, res);
  if (!authed) return;

  const rawPlanKey = String(req.body?.plan_key || "").trim();
  if (!isMonthlyPlanKey(rawPlanKey)) {
    return res.status(400).json({ ok: false, error: "Некорректный тариф" });
  }

  const plan = getMonthlyPlanDefinition(rawPlanKey);
  if (!plan) return res.status(400).json({ ok: false, error: "Тариф не найден" });

  const shopId = process.env.YOOKASSA_SHOP_ID;
  const secretKey = process.env.YOOKASSA_SECRET_KEY;
  const appBaseUrl = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (!shopId || !secretKey || !appBaseUrl) {
    return res.status(500).json({ ok: false, error: "YooKassa is not configured: set YOOKASSA_SHOP_ID, YOOKASSA_SECRET_KEY and APP_BASE_URL (or NEXT_PUBLIC_APP_URL)" });
  }

  const workspace = await ensureWorkspaceForUser(authed.supabaseAdmin, authed.user);
  const userEmail = authed.user.email;
  if (!userEmail) {
    return res.status(400).json({ ok: false, error: "У пользователя нет email для чека" });
  }

  const amountValue = plan.monthlyPriceRub.toFixed(2);
  const auth = Buffer.from(`${shopId}:${secretKey}`).toString("base64");
  const idempotenceKey = crypto.randomUUID();
  const returnUrl = `${appBaseUrl.replace(/\/$/, "")}/wallet?plan_paid=1`;

  const taxSystemCode = Number(process.env.YOOKASSA_TAX_SYSTEM_CODE || "1");
  const vatCode = Number(process.env.YOOKASSA_VAT_CODE || "1");
  const paymentSubject = (process.env.YOOKASSA_PAYMENT_SUBJECT || "service").trim();
  const paymentMode = (process.env.YOOKASSA_PAYMENT_MODE || "full_payment").trim();

  const receipt = {
    customer: { email: userEmail },
    tax_system_code: taxSystemCode,
    items: [
      {
        description: `Месячный тариф: ${plan.title}`,
        quantity: "1.00",
        amount: { value: amountValue, currency: "RUB" },
        vat_code: vatCode,
        payment_subject: paymentSubject,
        payment_mode: paymentMode,
        measure: "piece",
      },
    ],
  };

  const createResp = await fetch("https://api.yookassa.ru/v3/payments", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Basic ${auth}`,
      "Idempotence-Key": idempotenceKey,
    },
    body: JSON.stringify({
      amount: { value: amountValue, currency: "RUB" },
      capture: true,
      confirmation: { type: "redirect", return_url: returnUrl },
      payment_method_data: { type: "sbp" },
      description: `Месячный тариф: ${plan.title}`,
      receipt,
      metadata: {
        kind: "commercial_subscription",
        user_id: authed.user.id,
        workspace_id: workspace.workspace_id,
        plan_key: plan.key,
        plan_title: plan.title,
        projects_limit: String(plan.projectsLimit),
        duration_days: String(plan.durationDays),
      },
    }),
  });

  const raw = await createResp.text();
  let json: any = null;
  try {
    json = JSON.parse(raw);
  } catch {}

  if (!createResp.ok) {
    return res.status(502).json({ ok: false, error: json?.description || json?.message || raw || "YooKassa error" });
  }

  const paymentId: string | undefined = json?.id;
  const confirmationUrl: string | undefined = json?.confirmation?.confirmation_url;
  if (!paymentId || !confirmationUrl) {
    return res.status(502).json({ ok: false, error: "YooKassa response missing id/confirmation_url" });
  }

  return res.status(200).json({ ok: true, payment_id: paymentId, confirmation_url: confirmationUrl });
}
