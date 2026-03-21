-- Обновляет логику пакетов оценки:
-- цель = только рекомендуемый пресет тестов
-- package_mode = глубина аналитики результата

alter table public.commercial_projects
  alter column package_mode set default 'premium';

update public.commercial_projects
set package_mode = case
  when package_mode = 'basic' then 'basic'
  when package_mode = 'extended' then 'premium_ai_plus'
  when package_mode = 'recommended' then 'premium'
  when package_mode = 'custom' then 'premium'
  when package_mode in ('premium', 'premium_ai_plus') then package_mode
  else 'premium'
end;
