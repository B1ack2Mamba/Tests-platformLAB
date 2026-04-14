Точечная правка для проекта Tests-platformLAB-main.

Что внутри:
- pages/dashboard/index.tsx — готовый изменённый файл
- certificates-global-template.patch — unified diff относительно исходного архива

Как применить:
1. Открой свой проект Tests-platformLAB-main.
2. Замени файл pages/dashboard/index.tsx на файл из архива.
   ИЛИ
   примени patch-файл через git apply / patch.

Суть правки:
- сертификаты на рабочем столе сохраняются в общий scene-template
- при загрузке в режиме scheme сертификаты берутся из общего шаблона для всех
- остальные части проекта не менялись
