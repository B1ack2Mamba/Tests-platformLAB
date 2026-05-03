# Registry-calibrated candidate analysis update

Этот архив добавляет в проект контур анализа кандидатов в стиле ручного Excel-разбора:

1. baseline-анализ без комментариев Registry;
2. calibrated-анализ с учетом комментариев Registry;
3. delta: что изменилось в индексе, доменах и компетенциях;
4. отдельные API для анализа одного кандидата и сравнения группы кандидатов;
5. SQL-миграцию Supabase для поля `registry_comment`.

## Что изменено в коде

### Новый модуль анализа

Добавлены файлы:

- `lib/candidateAnalysis/types.ts`
- `lib/candidateAnalysis/featureExtractor.ts`
- `lib/candidateAnalysis/competencyScoring.ts`
- `lib/candidateAnalysis/registryCalibration.ts`
- `lib/candidateAnalysis/candidateReport.ts`
- `lib/candidateAnalysis/candidateComparison.ts`

Логика:

```text
commercial_project_attempts.result
        ↓
extractCandidateFeatures()
        ↓
scoreAllCompetencies()
        ↓
baseline fit snapshot
        ↓
applyRegistryCalibrationToMatrix() + applyRegistryCalibrationToCompetencies()
        ↓
calibrated fit snapshot
        ↓
delta / summary / interview questions
```

Важно: Registry-комментарий не является доказательством компетенции. Он меняет требования роли и подсвечивает риски, если тестовые данные уже показывают слабую зону.

### Новые API

#### Один кандидат

```http
GET /api/commercial/projects/candidate-analysis?id=<PROJECT_ID>&fit_profile_id=project_manager&fit_request=руководитель проекта&include_registry=1
```

Ответ:

```ts
{
  ok: true,
  analysis: {
    candidate,
    baseline,
    calibrated,
    delta,
    registryCalibration,
    summary,
    comparisonLine
  }
}
```

#### Сравнение кандидатов

```http
POST /api/commercial/projects/candidate-comparison
```

Body:

```json
{
  "project_ids": ["project-id-1", "project-id-2"],
  "fit_profile_id": "project_manager",
  "fit_request": "руководитель проекта / координатор",
  "include_registry": true
}
```

#### Сохранение Registry-комментария

```http
POST /api/commercial/projects/registry-comment
```

Body:

```json
{
  "project_id": "project-id",
  "registry_comment": "Для роли критичны автономность, качество, регламентность и работа без постоянного контроля."
}
```

Также есть:

```http
GET /api/commercial/projects/registry-comment?id=<PROJECT_ID>
```

### Интеграция в существующий AI+

`lib/commercialEvaluation.ts` теперь передает Registry-комментарий в AI+ prompt как HR-калибровку. AI должен учитывать его как контекст требований роли, но не как самостоятельное доказательство.

`pages/api/commercial/projects/evaluation.ts`, `get.ts`, `update.ts`, `results-map.ts` теперь читают/пишут `registry_comment`.

На странице проекта `/projects/[projectId]` добавлено поле редактирования Registry-комментария.

## Supabase

Перед деплоем кода применить:

```sql
supabase/commercial_registry_candidate_analysis.sql
```

Миграция добавляет в `commercial_projects`:

- `registry_comment text`
- `registry_comment_updated_at timestamptz`
- `registry_comment_updated_by uuid`

И создает необязательную историческую таблицу:

- `commercial_project_registry_comments`

Файл `supabase/PREPRODUCTION-APPLY-ORDER.sql` обновлен: новый SQL указан пунктом 26.

## Что попросить Codex проверить перед пушем

1. Запустить:

```bash
npm install
npm run typecheck
npm run lint
npm run build
```

2. Применить SQL в Supabase до выката кода, потому что API теперь делает select по `registry_comment`.

3. Проверить вручную:

```bash
curl -H "Authorization: Bearer <TOKEN>" \
  "<APP_URL>/api/commercial/projects/candidate-analysis?id=<PROJECT_ID>&include_registry=1"
```

4. На проекте с завершенными тестами добавить Registry-комментарий и сравнить:

- `analysis.baseline.index`
- `analysis.calibrated.index`
- `analysis.delta.index`
- `analysis.delta.domains`
- `analysis.delta.competencies`

## Методическая логика

Движок использует уже существующую базу:

- `data/competency-calibration/completed-workbook.json`
- `lib/competencyRouter.ts`
- `lib/fitProfiles.ts`
- `lib/serverFitProfiles.ts`
- результаты в `commercial_project_attempts.result`

Основные правила:

- минимум 2 независимых семейства данных для уверенного verdict;
- supportive-сигналы не поднимают компетенцию до high в одиночку;
- contra-сигналы ограничивают уровень;
- Registry-комментарии усиливают веса и critical-компетенции роли;
- если Registry усиливает требование, а тесты показывают слабость по релевантным шкалам, появляется calibrated penalty.

## Пример смысла результата

Без комментария кандидат может иметь высокий baseline за счет коммуникации и общего профиля.

После комментария “нужны автономность, качество, регламентность” индекс может снизиться, если тесты показывают:

- 16PF `Q2` низко → риск автономности;
- 16PF `G` низко → риск нормативности;
- 16PF `Q3` низко → риск самоконтроля;
- Belbin `CF` низко → слабый контроль качества.

Это повторяет ручную аналитику: не просто “кто лучше”, а “под какую роль кандидат безопаснее”.
