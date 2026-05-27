-- Explicit Data API grants for Supabase public schema changes.
-- Run after the schema files. This file is additive: it does not change RLS policies.
-- Keep anon/authenticated narrow; server-side routes use service_role.

grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to service_role;

alter default privileges for role postgres in schema public
  grant usage, select on sequences to service_role;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'tests',
    'commercial_scene_templates'
  ] loop
    if to_regclass('public.' || table_name) is not null then
      execute format('grant select on table public.%I to anon, authenticated', table_name);
    end if;
  end loop;

  foreach table_name in array array[
    'auth_name_logins',
    'wallet_ledger',
    'test_unlocks',
    'test_interpretations',
    'test_take_unlocks',
    'yookassa_topups',
    'commercial_workspaces',
    'commercial_workspace_members',
    'commercial_people',
    'commercial_projects',
    'commercial_project_tests',
    'commercial_project_attempts',
    'commercial_project_folders',
    'commercial_workspace_subscriptions',
    'commercial_workspace_subscription_projects',
    'commercial_fit_profiles',
    'commercial_competency_prompts',
    'commercial_global_settings',
    'promo_code_redemptions',
    'commercial_support_threads',
    'commercial_support_messages'
  ] loop
    if to_regclass('public.' || table_name) is not null then
      execute format('grant select on table public.%I to authenticated', table_name);
    end if;
  end loop;

  foreach table_name in array array[
    'commercial_profiles',
    'commercial_attempts',
    'commercial_candidate_calibration_cases'
  ] loop
    if to_regclass('public.' || table_name) is not null then
      execute format('grant select, insert, update on table public.%I to authenticated', table_name);
    end if;
  end loop;

  if to_regclass('public.wallets') is not null then
    execute 'grant select, insert on table public.wallets to authenticated';
  end if;

  if to_regclass('public.commercial_project_registry_comments') is not null then
    execute 'grant select, insert on table public.commercial_project_registry_comments to authenticated';
  end if;

  if to_regprocedure('public.unlock_test(text,bigint)') is not null then
    execute 'grant execute on function public.unlock_test(text,bigint) to authenticated';
  end if;

  if to_regprocedure('public.credit_wallet(uuid,bigint,text,text)') is not null then
    execute 'grant execute on function public.credit_wallet(uuid,bigint,text,text) to service_role';
  end if;

  if to_regprocedure('public.credit_wallet_idempotent(uuid,bigint,text,text)') is not null then
    execute 'grant execute on function public.credit_wallet_idempotent(uuid,bigint,text,text) to service_role';
  end if;

  if to_regprocedure('public.debit_wallet(uuid,bigint,text,text)') is not null then
    execute 'grant execute on function public.debit_wallet(uuid,bigint,text,text) to service_role';
  end if;

  if to_regprocedure('public.redeem_promo_code(uuid,text)') is not null then
    execute 'grant execute on function public.redeem_promo_code(uuid,text) to service_role';
  end if;

  if to_regprocedure('public.consume_commercial_workspace_subscription(uuid,uuid)') is not null then
    execute 'grant execute on function public.consume_commercial_workspace_subscription(uuid,uuid) to service_role';
  end if;
end $$;
