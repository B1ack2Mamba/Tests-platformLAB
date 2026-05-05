# Commercial Operations

## Боевой контур

- `npm run preflight`
  - typecheck
  - lint
  - build
  - public smoke
- `npm run preflight:auth`
  - весь `preflight`
  - auth smoke
- `npm run e2e:commercial`
  - создаёт временный demo-проект
  - проверяет project/results/evaluation/unlock-access
  - удаляет временный проект
- `npm run status:prod`
  - сводный JSON-статус по health, public smoke и auth smoke
- `npm run alert:prod`
  - шлёт Telegram-уведомление только если status упал
- `npm run heartbeat:prod`
  - шлёт короткое Telegram `OK`-сообщение
- `npm run readiness:prod`
  - полный боевой прогон перед релизом

## Админский экран

- `/admin/status`
  - итоговый статус системы
  - health
  - public smoke
  - auth smoke
  - recovery checklist

## Калибровочный контур

Эти файлы не являются частью ежедневного коммерческого preflight:

- `scripts/seed-sanya-calibration-cases.sh`
- `scripts/check-0000-calibration.ts`
- `pages/api/commercial/projects/calibration-case.ts`
- `pages/api/commercial/projects/calibration-report.ts`
- `lib/candidateAnalysis/*`
- `data/calibration/*`

Их использовать только для методической настройки и сверки движка, а не для проверки живости прода.

## Принцип разделения

- Если задача про доступность, логин, кабинет, AI, unlock, проекты и стабильность релиза — это боевой контур.
- Если задача про эталоны, benchmark, delta, profile tuning и manual calibration — это калибровочный контур.

## Alerting env

- `TELEGRAM_SUPPORT_BOT_TOKEN`
- `TELEGRAM_SUPPORT_CHAT_ID`
- `TELEGRAM_ALERT_THREAD_ID` — опционально, если heartbeat/alerts должны идти в отдельную тему
- `STATUS_ALERT_ON_OK=1` — отправлять heartbeat даже при зелёном статусе
- `STATUS_ALERT_DRY_RUN=1` — не отправлять сообщение, только показать текст локально
