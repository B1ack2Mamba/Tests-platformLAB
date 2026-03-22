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
3. Примените SQL: `supabase/schema.sql`
4. Примените SQL: `supabase/commercial_schema.sql`
5. Примените SQL: `supabase/commercial_goals_workflow.sql`
6. Для новой логики пакетов примените SQL: `supabase/commercial_package_logic_update.sql`
6. Загрузите тесты: `node scripts/seed-tests.mjs`
7. Для WSL / Windows запускайте dev-сервер так, чтобы браузер видел порт:
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
