# Expert competency scoring update

Этот апдейт усиливает уже добавленный контур `lib/candidateAnalysis` и приближает анализ к ручному Excel-разбору кандидатов.

Главная идея: AI больше не должен сам угадывать баллы компетенций. Код сначала извлекает признаки из результатов тестов, считает компетенции и ограничения, а AI объясняет уже посчитанную картину.

## Что изменено

### 1. Усилен feature extractor

Файл:

```txt
lib/candidateAnalysis/featureExtractor.ts
```

Теперь extractor не только читает прямые шкалы тестов, но и строит производные сигналы:

- 16PF: первичные и вторичные факторы;
- Цветотипы: `RED_GREEN`, `BLUE_GREEN`, `RED_BLUE`, `RED_ONLY`, `GREEN_ONLY`, `BLUE_ONLY`;
- Тайм-менеджмент: `LC`, `LP`, `PC`, `LPC`;
- Типология обучения: `EXP_DOMINANT`, `PRA_DOMINANT`, `THE_DOMINANT`, `OBS_DOMINANT`;
- Переговорный стиль: `NEG_WINWIN`, `NEG_ASSERTIVE_BALANCE`, `NEG_HARD_BARGAIN_RISK`, `NEG_AVOID_RISK`, `NEG_OVER_ACCOMMODATION_RISK`, `A_DOMINANT`;
- Ситуативное руководство: `FLEX`, `ADEQ_DIAG`, `ADEQ_NEAR`, `ADEQ_UPPER`, `ADEQ_LOWER`, `S1_ONLY`–`S4_ONLY`.

Эти сигналы нужны, чтобы система могла машинно ловить такие выводы, которые раньше появлялись только в ручном анализе: низкая автономность по `Q2`, риск нормативности по `G`, слабый контроль качества по `CF`, сильная договороспособность по `NEG_WINWIN`, риск ригидного лидерского стиля по `S1_ONLY`.

### 2. Усилен deterministic scoring engine

Файл:

```txt
lib/candidateAnalysis/competencyScoring.ts
```

Scoring engine теперь работает в два слоя:

1. Парсит `data/competency-calibration/completed-workbook.json`:
   - `Core-signals`;
   - `Supportive-signals`;
   - `Contra-signals`;
   - `Rule of thumb`;
   - вопросы интервью.

2. Добавляет экспертные патчи по всем 31 компетенции `C01`–`C31`:
   - конкретные подтверждения;
   - конкретные contra-сигналы;
   - caps/floors;
   - штрафы за опасные сочетания;
   - усиление, когда несколько независимых семейств сходятся.

Примеры:

- `C15 Автономность`: низкий `Q2` ограничивает высокий уровень автономности.
- `C16 Ориентация на качество`: низкие `G`, `Q3`, `CF` ограничивают оценку качества.
- `C31 Переговорная компетентность`: `NEG_WINWIN` и `NEG_ASSERTIVE_BALANCE` усиливают оценку, а `NEG_HARD_BARGAIN_RISK`, `NEG_AVOID_RISK`, `NEG_OVER_ACCOMMODATION_RISK` режут её.
- `C25 Лидерский потенциал`: один высокий `E` или `RED` больше не даёт высокий уровень без устойчивости, гибкости и эмоционального контура.

### 3. Интеграция в обычный AI+ анализ

Файл:

```txt
lib/commercialEvaluation.ts
```

Теперь `buildCompetencySignals()` использует:

```ts
extractCandidateFeatures(attempts)
scoreAllCompetencies(features, focusIds)
```

Это значит, что улучшенный deterministic scoring используется не только в новом endpoint `candidate-analysis`, но и в стандартном AI+ отчёте проекта.

## Что должен проверить Codex

1. Установить зависимости:

```bash
npm install
```

2. Запустить проверки:

```bash
npm run typecheck
npm run lint
npm run build
```

3. Проверить проект с полным набором тестов:

```http
GET /api/commercial/projects/evaluation?id=<PROJECT_ID>&mode=premium_ai_plus
GET /api/commercial/projects/candidate-analysis?id=<PROJECT_ID>&include_registry=1
```

4. Сравнить логику на кейсах:

- кандидат с низкими `G`, `Q2`, `Q3`, `CF` должен получать риск по автономности, регламентности и качеству;
- кандидат с высоким ЭМИН, `GREEN`, `NEG_WINWIN` должен усиливаться в коммуникации, эмпатии и партнёрском контуре;
- кандидат с высоким `PL/RI/Q1`, но слабым `CF/Q3/G`, не должен автоматически считаться сильным по качеству решений;
- Registry-комментарий должен менять calibrated-индекс, а не baseline.

## Supabase

Этот апдейт не добавляет новых таблиц сверх предыдущей Registry-миграции.

Если Registry-миграция ещё не применена, применить:

```txt
supabase/commercial_registry_candidate_analysis.sql
```

## Важная методическая граница

Этот scoring engine не заменяет профессиональное интервью. Он делает тестовый анализ стабильнее и ближе к ручной экспертной логике, но финальное решение всё равно должно учитывать должность, опыт, интервью, реальные кейсы и рекомендации.
