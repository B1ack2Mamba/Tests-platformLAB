-- Fix duplicate YooKassa credits and make wallet top-ups idempotent.
-- 1) Remove duplicate ledger rows for the same user_id + ref (keep earliest row).
with ranked as (
  select id,
         row_number() over (partition by user_id, ref order by created_at asc, id asc) as rn
  from public.wallet_ledger
  where ref like 'yookassa:%'
)
delete from public.wallet_ledger l
using ranked r
where l.id = r.id and r.rn > 1;

-- 2) Recalculate wallet balances from ledger to undo over-crediting.
update public.wallets w
set balance_kopeks = coalesce(s.total_kopeks, 0),
    updated_at = now()
from (
  select user_id, coalesce(sum(amount_kopeks), 0) as total_kopeks
  from public.wallet_ledger
  group by user_id
) s
where w.user_id = s.user_id;

update public.wallets w
set balance_kopeks = 0,
    updated_at = now()
where not exists (
  select 1 from public.wallet_ledger l where l.user_id = w.user_id
);

-- 3) Prevent duplicates forever.
create unique index if not exists wallet_ledger_user_ref_unique
  on public.wallet_ledger(user_id, ref)
  where ref is not null;

-- 4) Idempotent server helper: only credit once per ref.
create or replace function public.credit_wallet_idempotent(
  p_user_id uuid,
  p_amount_kopeks bigint,
  p_reason text default 'topup',
  p_ref text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_balance bigint;
  v_inserted int;
begin
  if p_amount_kopeks is null or p_amount_kopeks <= 0 then
    raise exception 'Amount must be positive';
  end if;

  insert into public.wallets(user_id, balance_kopeks)
  values (p_user_id, 0)
  on conflict (user_id) do nothing;

  insert into public.wallet_ledger(user_id, amount_kopeks, reason, ref)
  values (p_user_id, p_amount_kopeks, coalesce(p_reason,'topup'), p_ref)
  on conflict do nothing;

  get diagnostics v_inserted = row_count;

  if v_inserted = 0 then
    return jsonb_build_object('ok', true, 'already', true);
  end if;

  update public.wallets
  set balance_kopeks = balance_kopeks + p_amount_kopeks,
      updated_at = now()
  where user_id = p_user_id
  returning balance_kopeks into v_new_balance;

  return jsonb_build_object('ok', true, 'balance_kopeks', v_new_balance, 'already', false);
end;
$$;

revoke all on function public.credit_wallet_idempotent(uuid, bigint, text, text) from public;
grant execute on function public.credit_wallet_idempotent(uuid, bigint, text, text) to service_role;
