-- Постепенное внедрение платных уровней результата по проекту:
-- База / Премиум / Премиум+

alter table public.commercial_projects
  add column if not exists unlocked_package_mode text null;

alter table public.commercial_projects
  add column if not exists unlocked_package_paid_at timestamptz null;

alter table public.commercial_projects
  add column if not exists unlocked_package_price_kopeks integer not null default 0;

grant all privileges on table public.commercial_projects to service_role;
