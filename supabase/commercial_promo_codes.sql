create extension if not exists pgcrypto;

create table if not exists public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  amount_kopeks bigint not null check (amount_kopeks > 0),
  max_redemptions integer not null check (max_redemptions > 0),
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.promo_code_redemptions (
  id uuid primary key default gen_random_uuid(),
  promo_code_id uuid not null references public.promo_codes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount_kopeks bigint not null,
  created_at timestamptz not null default now(),
  unique (promo_code_id, user_id)
);

create index if not exists promo_code_redemptions_code_idx on public.promo_code_redemptions(promo_code_id, created_at desc);
create index if not exists promo_code_redemptions_user_idx on public.promo_code_redemptions(user_id, created_at desc);

alter table public.promo_codes enable row level security;
alter table public.promo_code_redemptions enable row level security;

-- promo_codes are managed only by server-side admin endpoints

drop policy if exists "Promo redemptions: read own" on public.promo_code_redemptions;
create policy "Promo redemptions: read own"
  on public.promo_code_redemptions
  for select
  using (auth.uid() = user_id);

create or replace function public.redeem_promo_code(
  p_user_id uuid,
  p_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code public.promo_codes%rowtype;
  v_redeemed_count integer;
  v_new_balance bigint;
begin
  if p_user_id is null then
    raise exception 'p_user_id is required';
  end if;

  if coalesce(trim(p_code), '') = '' then
    raise exception 'Promo code is required';
  end if;

  select * into v_code
  from public.promo_codes
  where upper(code) = upper(trim(p_code))
  for update;

  if not found then
    raise exception 'Промокод не найден';
  end if;

  if not v_code.is_active then
    raise exception 'Промокод отключен';
  end if;

  if exists (
    select 1 from public.promo_code_redemptions r
    where r.promo_code_id = v_code.id and r.user_id = p_user_id
  ) then
    raise exception 'Промокод уже использован';
  end if;

  select count(*)::int into v_redeemed_count
  from public.promo_code_redemptions r
  where r.promo_code_id = v_code.id;

  if v_redeemed_count >= v_code.max_redemptions then
    raise exception 'Лимит активаций исчерпан';
  end if;

  insert into public.wallets(user_id, balance_kopeks)
  values (p_user_id, 0)
  on conflict (user_id) do nothing;

  update public.wallets
  set balance_kopeks = balance_kopeks + v_code.amount_kopeks,
      updated_at = now()
  where user_id = p_user_id
  returning balance_kopeks into v_new_balance;

  insert into public.wallet_ledger(user_id, amount_kopeks, reason, ref)
  values (p_user_id, v_code.amount_kopeks, 'promo_code', v_code.code);

  insert into public.promo_code_redemptions(promo_code_id, user_id, amount_kopeks)
  values (v_code.id, p_user_id, v_code.amount_kopeks);

  return jsonb_build_object(
    'ok', true,
    'code', v_code.code,
    'credited_kopeks', v_code.amount_kopeks,
    'balance_kopeks', v_new_balance,
    'remaining', greatest(v_code.max_redemptions - v_redeemed_count - 1, 0)
  );
end;
$$;

revoke all on function public.redeem_promo_code(uuid, text) from public;
grant execute on function public.redeem_promo_code(uuid, text) to service_role;
