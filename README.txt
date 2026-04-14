Точечная правка: восстановлены суммы на кнопках открытия пакетов результатов.

Причина бага:
в pages/projects/[projectId]/results.tsx аргументы в getUpgradePriceRub(...) были переданы в обратном порядке.
Из-за этого цена апгрейда считалась как 0, и на кнопках показывалось просто «Открыть» вместо «Открыть за N ₽».

Что заменено:
было: getUpgradePriceRub(mode, unlockedMode)
стало: getUpgradePriceRub(unlockedMode, mode)
