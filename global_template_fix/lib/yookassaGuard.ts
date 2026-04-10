
export function parseRequestedRubInput(raw: unknown): number | null {
  if (typeof raw === "number") {
    if (!Number.isFinite(raw)) return null;
    const n = Math.floor(raw);
    return Number.isSafeInteger(n) && n >= 1 ? n : null;
  }

  const text = String(raw ?? "").trim();
  if (!text) return null;
  const compact = text.replace(/\s+/g, "");
  if (!/^\d+$/.test(compact)) return null;

  const n = Number(compact);
  if (!Number.isSafeInteger(n) || n < 1) return null;
  return n;
}

export function parseRequestedAmountKopeksFromMetadata(metadata: any): number | null {
  const raw = metadata?.requested_amount_kopeks;
  if (raw === undefined || raw === null || raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  const value = Math.floor(n);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

export function getProviderAmountKopeksFromPayment(payment: any): number {
  const amountValue = Number(payment?.amount?.value || 0);
  if (!Number.isFinite(amountValue) || amountValue <= 0) return 0;
  return Math.round(amountValue * 100);
}

export function isYooKassaAmountMismatch(requestedAmountKopeks: number | null, providerAmountKopeks: number): boolean {
  return requestedAmountKopeks !== null && providerAmountKopeks > 0 && requestedAmountKopeks !== providerAmountKopeks;
}


export function normalizeYooKassaTopupStatus(status: unknown): string {
  const value = String(status ?? "").trim().toLowerCase();
  if (!value) return "unknown";
  if (value === "succeeded" || value === "paid") return "paid";
  if (value === "canceled" || value === "cancelled") return "canceled";
  return value;
}

export function getYooKassaPaidAt(payment: any): string | null {
  const raw = payment?.captured_at || payment?.paid_at || payment?.created_at || null;
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export type YooKassaTopupUpsertRow = {
  payment_id: string;
  user_id: string;
  amount_kopeks: number;
  status: string;
  paid_at?: string | null;
  requested_amount_kopeks?: number | null;
  provider_amount_kopeks?: number | null;
  mismatch_detected?: boolean;
  metadata?: Record<string, string>;
  last_error?: string | null;
  updated_at?: string;
};

export async function upsertYooKassaTopupSafe(supabaseAdmin: any, row: YooKassaTopupUpsertRow) {
  const fullRow = {
    payment_id: row.payment_id,
    user_id: row.user_id,
    amount_kopeks: row.amount_kopeks,
    status: row.status,
    paid_at: row.paid_at ?? null,
    requested_amount_kopeks: row.requested_amount_kopeks ?? null,
    provider_amount_kopeks: row.provider_amount_kopeks ?? null,
    mismatch_detected: Boolean(row.mismatch_detected),
    metadata: row.metadata ?? {},
    last_error: row.last_error ?? null,
    updated_at: row.updated_at ?? new Date().toISOString(),
  };

  let result = await supabaseAdmin.from("yookassa_topups").upsert(fullRow);
  if (!result?.error) return;

  const message = String(result.error.message || "");
  if (/relation\s+"?public\.yookassa_topups"?\s+does\s+not\s+exist/i.test(message)) {
    return;
  }

  if (/column .* does not exist|schema cache/i.test(message)) {
    const legacyRow = {
      payment_id: row.payment_id,
      user_id: row.user_id,
      amount_kopeks: row.amount_kopeks,
      status: row.status,
      paid_at: row.paid_at ?? null,
    };
    result = await supabaseAdmin.from("yookassa_topups").upsert(legacyRow);
    if (!result?.error) return;
    if (/relation\s+"?public\.yookassa_topups"?\s+does\s+not\s+exist/i.test(String(result.error.message || ""))) {
      return;
    }
  }
}


export async function patchYooKassaTopupSafe(
  supabaseAdmin: any,
  paymentId: string,
  patch: Partial<YooKassaTopupUpsertRow>
) {
  const fullPatch = {
    amount_kopeks: patch.amount_kopeks,
    status: patch.status,
    paid_at: patch.paid_at,
    requested_amount_kopeks: patch.requested_amount_kopeks,
    provider_amount_kopeks: patch.provider_amount_kopeks,
    mismatch_detected: patch.mismatch_detected,
    metadata: patch.metadata,
    last_error: patch.last_error,
    updated_at: patch.updated_at ?? new Date().toISOString(),
  };

  let result = await supabaseAdmin.from("yookassa_topups").update(fullPatch).eq("payment_id", paymentId);
  if (!result?.error) return;

  const message = String(result.error.message || "");
  if (/relation\s+"?public\.yookassa_topups"?\s+does\s+not\s+exist/i.test(message)) {
    return;
  }

  if (/column .* does not exist|schema cache/i.test(message)) {
    const legacyPatch = {
      amount_kopeks: patch.amount_kopeks,
      status: patch.status,
      paid_at: patch.paid_at,
    };
    result = await supabaseAdmin.from("yookassa_topups").update(legacyPatch).eq("payment_id", paymentId);
    if (!result?.error) return;
    if (/relation\s+"?public\.yookassa_topups"?\s+does\s+not\s+exist/i.test(String(result.error.message || ""))) {
      return;
    }
  }
}

export async function findWalletLedgerByRef(supabaseAdmin: any, userId: string, ref: string) {
  const { data, error } = await supabaseAdmin
    .from("wallet_ledger")
    .select("id,user_id,amount_kopeks,reason,ref,created_at")
    .eq("user_id", userId)
    .eq("ref", ref)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}
