Safe strengthening hotfix for YooKassa wallet topups (NO SQL changes).

What changed:
- Added stricter reconciliation helpers in lib/yookassaGuard.ts
- Normalized provider statuses (paid/pending/canceled)
- webhook.ts and sync.ts now:
  - write richer error state to public.yookassa_topups
  - verify that wallet_ledger row really exists after credit_wallet_idempotent
  - log reconciliation failures instead of silently losing them
- WalletFull.tsx now:
  - stops swallowing sync errors silently on the last retry
  - clears pending payment ids only after paid status
  - keeps UI error visible if auto-confirmation fails

Files touched:
- lib/yookassaGuard.ts
- pages/api/yookassa/webhook.ts
- pages/api/yookassa/sync.ts
- components/WalletFull.tsx
- same files duplicated under global_template_fix/

No migrations included.
No visual wallet styling changes included.
