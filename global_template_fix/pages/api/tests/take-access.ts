import type { NextApiRequest, NextApiResponse } from "next";
import { requireUser } from "@/lib/serverAuth";
import { getTestTakePriceRub } from "@/lib/testTakeAccess";
import { isTestUnlimitedEmail } from "@/lib/testWallet";

type OkResp = {
  ok: true;
  unlocked: boolean;
  price_rub: number;
  balance_kopeks: number;
  unlimited: boolean;
};

type ErrResp = { ok: false; error: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse<OkResp | ErrResp>) {
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const auth = await requireUser(req, res);
  if (!auth) return;

  const slug = String(req.query.slug || "").trim();
  if (!slug) return res.status(400).json({ ok: false, error: "slug is required" });

  const unlimited = isTestUnlimitedEmail(auth.user.email);
  const priceRub = getTestTakePriceRub();

  if (unlimited) {
    return res.status(200).json({ ok: true, unlocked: true, price_rub: 0, balance_kopeks: 999_999_900_00, unlimited: true });
  }

  const { data: wallet } = await auth.supabaseAdmin
    .from("wallets")
    .select("balance_kopeks")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  return res.status(200).json({
    ok: true,
    unlocked: false,
    price_rub: priceRub,
    balance_kopeks: Number(wallet?.balance_kopeks ?? 0),
    unlimited: false,
  });
}
