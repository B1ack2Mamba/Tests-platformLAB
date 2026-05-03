# Candidate analysis calibration update

This update adds a calibration harness for the deterministic candidate-analysis engine.

The goal is to move the project closer to the manual expert Excel analysis by storing human/expert benchmark scores and comparing the project scoring engine against them.

## New files

```txt
lib/candidateAnalysis/calibration.ts
pages/api/commercial/projects/calibration-case.ts
pages/api/commercial/projects/calibration-report.ts
supabase/commercial_candidate_calibration_cases.sql
CALIBRATION_UPDATE_MANIFEST.txt
```

## Why this exists

The current expert scoring update already extracts test features, computes 31 competencies, applies Registry calibration, and returns baseline/calibrated candidate analysis.

This new layer answers a different question:

> How close is the project scoring to a trusted manual expert analysis?

It stores manual expert scores, then calculates:

- project baseline index vs manual baseline index;
- project calibrated index vs manual calibrated index;
- optional domain-level deltas;
- optional C01-C31 competency-level deltas;
- quality label: `hit`, `near`, `watch`, `needs_calibration`, `no_manual_score`;
- correction hints for weights/rules.

## Supabase migration

Apply after:

```txt
supabase/commercial_registry_candidate_analysis.sql
```

New migration:

```txt
supabase/commercial_candidate_calibration_cases.sql
```

It creates:

```txt
public.commercial_candidate_calibration_cases
```

Important columns:

```txt
project_id
benchmark_key
fit_profile_id
fit_request
manual_baseline_index
manual_calibrated_index
manual_domains
manual_competencies
expected_profile_type
manual_rank
expert_notes
correction_notes
is_active
```

`manual_domains` can store:

```json
{
  "thinking": 82,
  "management": 78,
  "communication": 70,
  "selfOrganization": 61,
  "emotional": 88,
  "motivation": 78
}
```

`manual_competencies` can store:

```json
{
  "C01": 84,
  "C03": 76,
  "C16": 58
}
```

## API endpoints

### Save or update one manual benchmark

```txt
POST /api/commercial/projects/calibration-case
```

Body example:

```json
{
  "project_id": "PROJECT_UUID",
  "benchmark_label": "Вовк О.С. ручной эталон 2026-05",
  "fit_profile_id": "project_manager",
  "fit_request": "руководитель проекта / координатор",
  "manual_baseline_index": 81,
  "manual_calibrated_index": 78,
  "manual_domains": {
    "thinking": 82,
    "management": 81,
    "communication": 70,
    "selfOrganization": 61,
    "emotional": 88,
    "motivation": 78
  },
  "expected_profile_type": "управленческо-аналитический",
  "manual_rank": 1,
  "expert_notes": "Сильнее для управленческо-аналитической роли, но есть риски нормативности/качества."
}
```

### Load one benchmark

```txt
GET /api/commercial/projects/calibration-case?project_id=PROJECT_UUID&fit_profile_id=project_manager&fit_request=...&with_analysis=1
```

With `with_analysis=1`, the endpoint also returns current project analysis and comparison against the manual benchmark.

### Build calibration report

```txt
POST /api/commercial/projects/calibration-report
```

Body:

```json
{
  "project_ids": ["PROJECT_UUID_1", "PROJECT_UUID_2"],
  "only_active": true
}
```

If `project_ids` is omitted, the endpoint uses all active calibration cases in the workspace.

Response includes:

```txt
rows[]
aggregate.cases
aggregate.scoredCases
aggregate.hit
aggregate.near
aggregate.watch
aggregate.needsCalibration
aggregate.averageAbsDelta
aggregate.maxAbsDelta
summary
```

## Manual benchmark examples from the previous Excel review

Use the real project UUIDs from your deployment; the names below are only the manual target scores.

```txt
Вовк О.С.
manual_baseline_index: 81
manual_calibrated_index: 78
expected_profile_type: управленческо-аналитический

Кондаурова А.К.
manual_baseline_index: 76
manual_calibrated_index: 74
expected_profile_type: коммуникации / развитие / идеи

Новый кандидат 0000
manual_baseline_index: 82
manual_calibrated_index: 76
expected_profile_type: коммуникационно-координационный
```

Target accuracy:

```txt
hit: max abs delta <= 3
near: max abs delta <= 5
watch: max abs delta <= 9
needs_calibration: max abs delta >= 10
```

## What Codex should verify

1. Apply SQL migrations in order:

```txt
supabase/commercial_registry_candidate_analysis.sql
supabase/commercial_candidate_calibration_cases.sql
```

2. Run:

```bash
npm install
npm run typecheck
npm run lint
npm run build
```

3. Smoke-test endpoints:

```bash
curl -X POST /api/commercial/projects/calibration-case
curl -X POST /api/commercial/projects/calibration-report
```
