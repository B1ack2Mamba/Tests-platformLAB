YooKassa duplicate-credit fix

Apply SQL first:
- supabase/yookassa_idempotency_fix.sql

Then deploy code changes:
- pages/api/yookassa/webhook.ts
- pages/api/yookassa/sync.ts
(and same files under global_template_fix/)
