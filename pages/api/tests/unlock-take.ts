import type { NextApiRequest, NextApiResponse } from "next";
import { requireUser } from "@/lib/serverAuth";
import { PAYMENTS_ENABLED } from "@/lib/payments";
import { getTestTakePriceRub } from "@/lib/testTakeAccess";
import { isTestUnlimitedEmail } from "@/lib/testWallet";

type Body = { test_slug?: string; op_id?: string };

type OkResp = {
  ok: true;
  already?: boolean;
  unlocked: true;
  price_rub: number;
  charged_kopeks: number;
  balance_kopeks: number;
  unlimited?: boolean;
};

type ErrResp = { ok: false; error: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse<OkResp | ErrResp>) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const auth = await requireUser(req, res);
  if (!auth) return;

  const body = (req.body || {}) as Body;
  const testSlug = String(body.test_slug || "").trim();
  if (!testSlug) return res.status(400).json({ ok: false, error: "test_slug is required" });

  const priceRub = getTestTakePriceRub();
  const priceKopeks = Math.round(priceRub * 100);

  if (isTestUnlimitedEmail(auth.user.email)) {
    return res.status(200).json({ ok: true, unlocked: true, price_rub: 0, charged_kopeks: 0, balance_kopeks: 999_999_900_00, unlimited: true });
  }

  const { data: testRow, error: testErr } = await auth.supabaseAdmin
    .from("tests")
    .select("slug,is_published")
    .eq("slug", testSlug)
    .maybeSingle();

  if (testErr || !testRow) return res.status(404).json({ ok: false, error: testErr?.message || "Тест не найден" });
  if (!(testRow as any).is_published) return res.status(403).json({ ok: false, error: "Тест не опубликован" });

  const { data: existing } = await auth.supabaseAdmin
    .from("test_take_unlocks")
    .select("paid_kopeks")
    .eq("user_id", auth.user.id)
    .eq("test_slug", testSlug)
    .maybeSingle();

  if (existing) {
    const { data: wallet } = await auth.supabaseAdmin
      .from("wallets")
      .select("balance_kopeks")
      .eq("user_id", auth.user.id)
      .maybeSingle();

    return res.status(200).json({
      ok: true,
      already: true,
      unlocked: true,
      price_rub: priceRub,
      charged_kopeks: 0,
      balance_kopeks: Number(wallet?.balance_kopeks ?? 0),
    });
  }

  let balanceKopeks = 0;
  let chargedKopeks = 0;

  if (PAYMENTS_ENABLED && priceKopeks > 0) {
    const ref = body.op_id ? `test_take:${testSlug}:${body.op_id}` : `test_take:${testSlug}:${Date.now()}`;
    const { data: debitData, error: debitErr } = await auth.supabaseAdmin.rpc("debit_wallet", {
      p_user_id: auth.user.id,
      p_amount_kopeks: priceKopeks,
      p_reason: "test_take_unlock",
      p_ref: ref,
    });

    if (debitErr) {
      return res.status(400).json({ ok: false, error: debitErr.message || "Не удалось списать средства" });
    }

    balanceKopeks = Number(debitData?.balance_kopeks ?? 0);
    chargedKopeks = Number(debitData?.charged_kopeks ?? priceKopeks);
  } else {
    const { data: wallet } = await auth.supabaseAdmin
      .from("wallets")
      .select("balance_kopeks")
      .eq("user_id", auth.user.id)
      .maybeSingle();
    balanceKopeks = Number(wallet?.balance_kopeks ?? 0);
  }

  const { error: insErr } = await auth.supabaseAdmin.from("test_take_unlocks").insert({
    user_id: auth.user.id,
    test_slug: testSlug,
    paid_kopeks: chargedKopeks,
  });

  if (insErr) return res.status(400).json({ ok: false, error: insErr.message || "Не удалось открыть тест" });

  return res.status(200).json({
    ok: true,
    unlocked: true,
    price_rub: priceRub,
    charged_kopeks: chargedKopeks,
    balance_kopeks: balanceKopeks,
  });
}
