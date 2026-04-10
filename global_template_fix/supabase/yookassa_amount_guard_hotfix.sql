-- Hotfix: amount guard + durable YooKassa bookkeeping
-- Run this in Supabase SQL editor.
-- Safe to run multiple times.

create table if not exists public.yookassa_topups (
  payment_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount_kopeks bigint not null check (amount_kopeks > 0),
  requested_amount_kopeks bigint null,
  provider_amount_kopeks bigint null,
  status text not null default 'pending',
  mismatch_detected boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  last_error text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz null
);

alter table public.yookassa_topups
  add column if not exists requested_amount_kopeks bigint null;

alter table public.yookassa_topups
  add column if not exists provider_amount_kopeks bigint null;

alter table public.yookassa_topups
  add column if not exists mismatch_detected boolean not null default false;

alter table public.yookassa_topups
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.yookassa_topups
  add column if not exists last_error text null;

alter table public.yookassa_topups
  add column if not exists updated_at timestamptz not null default now();

alter table public.yookassa_topups
  add column if not exists paid_at timestamptz null;

alter table public.yookassa_topups enable row level security;

drop policy if exists "YooKassa topups: read own" on public.yookassa_topups;
create policy "YooKassa topups: read own"
  on public.yookassa_topups
  for select
  using (auth.uid() = user_id);

create index if not exists yookassa_topups_user_id_created_at_idx
  on public.yookassa_topups(user_id, created_at desc);

create unique index if not exists wallet_ledger_user_ref_unique
  on public.wallet_ledger(user_id, ref)
  where ref is not null;

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
  values (p_user_id, p_amount_kopeks, coalesce(p_reason, 'topup'), p_ref)
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
