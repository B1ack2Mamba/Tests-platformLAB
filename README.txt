Что это делает
- перестаёт собирать AI+ полностью «на лету» при каждом GET /api/commercial/projects/evaluation
- добавляет кэш результата оценки в БД
- evaluation endpoint сначала пытается отдать готовый кэш, и только если его нет — собирает и сохраняет
- из основного evaluation-потока убрана тяжёлая генерация competency-body карточек, которая сильнее всего роняла Vercel по таймауту
- кнопка «Пересобрать анализ» теперь после пересборки карты результатов сбрасывает evaluation-кэш на фронте и запрашивает свежий evaluation с refresh=1

Что нужно сделать
1. Выполнить SQL из supabase/commercial_evaluation_cache.sql в Supabase SQL Editor.
2. Заменить файлы:
   - lib/commercialEvaluation.ts
   - pages/api/commercial/projects/evaluation.ts
   - pages/projects/[projectId]/results.tsx

Что изменилось по логике
- первый запрос evaluation для конкретного состояния проекта может собраться чуть дольше, но уже после этого будет читаться из БД
- heavy AI-блоки по компетенциям больше не строятся внутри основного evaluation GET, поэтому endpoint становится заметно легче
- top-level результат (короткий вывод, индексы, фокус, контекст, тестовые секции) остаётся
