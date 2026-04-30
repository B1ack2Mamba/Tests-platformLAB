# Лаборатория кадров — коммерческий стартовый проект

Новый коммерческий контур на базе текущего ядра тестов.

## Что внутри
- Next.js (Pages Router)
- Supabase Auth
- коммерческий кабинет специалиста
- каталог тестов и прохождение
- история результатов
- новый слой проектов оценки
- выбор цели оценки:
  - подбор на должность
  - общая оценка сотрудника
  - мотивация сотрудника

## Быстрый старт
1. Скопируйте `.env.example` в `.env.local`
2. Установите зависимости: `npm install`
3. Примените SQL в порядке ниже:
   - `supabase/schema.sql`
   - `supabase/commercial_schema.sql`
   - `supabase/commercial_goals_workflow.sql`
   - `supabase/commercial_package_logic_update.sql`
   - `supabase/auth_name_logins.sql`
   - `supabase/training_rooms_digits_mode.sql`
   - `supabase/test_take_unlocks.sql`
   - `supabase/paywall.sql`
   - `supabase/yookassa.sql`
   - `supabase/yookassa_amount_guard_hotfix.sql`
   - `supabase/yookassa_idempotency_fix.sql`
   - `supabase/wallet_debit.sql`
   - `supabase/commercial_fit_profiles.sql`
   - `supabase/commercial_competency_prompts.sql`
4. Загрузите тесты: `node scripts/seed-tests.mjs`
5. Для WSL / Windows запускайте dev-сервер так, чтобы браузер видел порт:
   - `npx next dev -H 0.0.0.0 -p 3000`
   - или замените `dev`-скрипт в `package.json`

## Обязательные env
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Важное
- `SUPABASE_SERVICE_ROLE_KEY` нельзя отдавать в браузер
- тесты берутся из таблицы `public.tests`; в dev есть fallback на `data/tests/*.json`
- коммерческие попытки пишутся в `public.commercial_attempts`
- новый workflow проектов использует таблицы:
  - `public.commercial_workspaces`
  - `public.commercial_workspace_members`
  - `public.commercial_people`
  - `public.commercial_projects`
  - `public.commercial_project_tests`
- платные сценарии и кошелёк требуют RPC и таблицы из:
  - `supabase/paywall.sql`
  - `supabase/yookassa.sql`
  - `supabase/yookassa_amount_guard_hotfix.sql`
  - `supabase/yookassa_idempotency_fix.sql`
  - `supabase/wallet_debit.sql`
- вход по имени и фамилии требует `supabase/auth_name_logins.sql`
- training mode с числовыми результатами требует `supabase/training_rooms_digits_mode.sql`
