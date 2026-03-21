alter table public.commercial_project_folders
  add column if not exists icon_key text not null default 'folder';

update public.commercial_project_folders
set icon_key = 'folder'
where icon_key is null or btrim(icon_key) = '';

alter table public.commercial_project_folders
  alter column icon_key set default 'folder';

alter table public.commercial_project_folders
  alter column icon_key set not null;

grant all privileges on table public.commercial_project_folders to service_role;
