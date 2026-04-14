Исправление для compile error и сохранения сертификатов в общий шаблон.

Что исправлено:
1) Сохранение/подтягивание сертификатов через общий scene-template.
2) Исправлен compile error:
   Block-scoped variable 'buildCurrentSceneStandard' used before its declaration.
   Хук useEffect перенесён ниже объявления buildCurrentSceneStandard.

Как применить:
- заменить файл pages/dashboard/index.tsx
или
- применить certificates-global-template.patch
