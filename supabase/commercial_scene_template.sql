create table if not exists public.commercial_scene_templates (
  template_key text primary key,
  version integer not null default 1,
  scene_widgets jsonb not null default '[]'::jsonb,
  tray_guide_text text not null default 'Создать новую папку проектов',
  tray_guide_position jsonb,
  trash_guide_position jsonb,
  folder_template jsonb,
  project_template jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.commercial_scene_templates enable row level security;

drop policy if exists "Anyone can read commercial scene templates" on public.commercial_scene_templates;
create policy "Anyone can read commercial scene templates"
  on public.commercial_scene_templates
  for select
  using (true);

-- Writes happen only through service-role server APIs.
insert into public.commercial_scene_templates (template_key)
values ('global_default')
on conflict (template_key) do nothing;
