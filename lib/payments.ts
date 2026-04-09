// Feature flags for payment-related UX and server billing.
//
// - PAYMENTS_UI_ENABLED: shows wallet/top-up/pricing in the UI.
// - PAYMENTS_ENABLED: performs actual wallet debits in API routes.
// - TRAINING_SELF_REVEAL_ENABLED: allows a participant to unlock their own digits in training.
//
// Defaults: everything OFF.

function flag(value: string | undefined) {
  return value === "1" || String(value || "").toLowerCase() === "true";
}

export const PAYMENTS_UI_ENABLED = flag(process.env.NEXT_PUBLIC_PAYMENTS_ENABLED);
export const YOOKASSA_TEST_UI_ENABLED = flag(process.env.NEXT_PUBLIC_YOOKASSA_TEST_UI_ENABLED);

// Server-side flags (API routes).
// Fallback to NEXT_PUBLIC_* as a safety net so the UI and the actual debit logic
// do not drift apart when only one env var was configured.
export const PAYMENTS_ENABLED = flag(process.env.PAYMENTS_ENABLED) || flag(process.env.NEXT_PUBLIC_PAYMENTS_ENABLED);
export const TRAINING_SELF_REVEAL_ENABLED = flag(process.env.TRAINING_SELF_REVEAL_ENABLED);
