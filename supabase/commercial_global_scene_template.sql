create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table if not exists public.commercial_global_settings (
  id uuid primary key default gen_random_uuid(),
  setting_key text not null unique,
  setting_value jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_commercial_global_settings_key
  on public.commercial_global_settings(setting_key);

drop trigger if exists trg_commercial_global_settings_updated_at on public.commercial_global_settings;
create trigger trg_commercial_global_settings_updated_at
before update on public.commercial_global_settings
for each row execute function public.set_updated_at();

alter table public.commercial_global_settings enable row level security;

drop policy if exists "Global settings are readable by authenticated users" on public.commercial_global_settings;
create policy "Global settings are readable by authenticated users"
  on public.commercial_global_settings
  for select
  using (auth.role() = 'authenticated');

grant all privileges on table public.commercial_global_settings to service_role;
