-- Run with psql against SOURCE and RESTORED target, in a quiet migration window.
-- Read-only: no accounts, balances, keys, tokens or user answers are printed.
\set ON_ERROR_STOP on
begin transaction isolation level repeatable read read only;
set local statement_timeout = '120s';
set local timezone = 'UTC';

select current_setting('server_version') as postgres_version;
select extname, extversion from pg_extension order by extname;

-- Exact counts, not planner estimates. Internal Auth tables vary between releases.
select string_agg(format(
  'select %L as table_name, count(*)::bigint as rows from %I.%I',
  schemaname || '.' || tablename, schemaname, tablename
), ' union all ' order by schemaname, tablename) || ' order by table_name;'
from pg_tables
where schemaname = 'public'
   or (schemaname = 'auth' and tablename in ('users', 'identities'))
   or (schemaname = 'storage' and tablename in ('buckets', 'objects'))
\gexec

select n.nspname as schema_name, c.relname as table_name,
       c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r', 'p')
order by c.relname;

select schemaname, tablename, policyname, roles, cmd,
       md5(coalesce(qual, '') || '|' || coalesce(with_check, '')) as policy_hash
from pg_policies where schemaname = 'public'
order by tablename, policyname;

select tablename, indexname, md5(indexdef) as index_hash
from pg_indexes where schemaname = 'public'
order by tablename, indexname;

select p.proname, pg_get_function_identity_arguments(p.oid) as arguments,
       p.prosecdef as security_definer, md5(pg_get_functiondef(p.oid)) as definition_hash
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prokind = 'f'
order by p.proname, arguments;

select table_name, grantee, privilege_type from information_schema.role_table_grants
where table_schema = 'public' and grantee in ('anon', 'authenticated', 'service_role')
order by table_name, grantee, privilege_type;

select count(*) as wallets, coalesce(sum(balance_kopeks), 0) as total_balance_kopeks
from public.wallets;
select count(*) as ledger_entries, coalesce(sum(amount_kopeks), 0) as ledger_total_kopeks
from public.wallet_ledger;
select count(*) as duplicate_payment_references from (
  select user_id, ref from public.wallet_ledger where ref is not null
  group by user_id, ref having count(*) > 1
) duplicates;

-- Financial contents must match too; equal totals alone do not prove preservation.
select 'wallets' as table_name,
       md5(coalesce(string_agg(md5(to_jsonb(w)::text), '' order by md5(to_jsonb(w)::text)), '')) as content_hash
from public.wallets w
union all
select 'wallet_ledger',
       md5(coalesce(string_agg(md5(to_jsonb(l)::text), '' order by md5(to_jsonb(l)::text)), ''))
from public.wallet_ledger l;

commit;
