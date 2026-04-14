Исправление возврата индекса соответствия для Premium AI+

Что изменено:
1. pages/projects/[projectId]/results.tsx
   - fit_enabled теперь включается автоматически, если у проекта есть конкретный ориентир:
     * выбранные компетенции
     * target_role
     * fit profile
     * fit request

2. lib/commercialEvaluation.ts
   - текст индекса теперь объясняет, что он считается по выбранным компетенциям,
     если анализ запущен в competency-режиме без target_role.

Замените файлы вручную или примените patch.
