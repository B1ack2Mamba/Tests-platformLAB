create table if not exists public.commercial_scene_templates (
  template_key text primary key
);

alter table public.commercial_scene_templates
  add column if not exists version integer not null default 1,
  add column if not exists scene_widgets jsonb not null default '[]'::jsonb,
  add column if not exists tray_guide_text text not null default 'Создать новую папку проектов',
  add column if not exists tray_guide_position jsonb,
  add column if not exists trash_guide_position jsonb,
  add column if not exists folder_template jsonb,
  add column if not exists project_template jsonb,
  add column if not exists updated_by uuid references auth.users(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

alter table public.commercial_scene_templates enable row level security;

drop policy if exists "Anyone can read commercial scene templates" on public.commercial_scene_templates;
create policy "Anyone can read commercial scene templates"
  on public.commercial_scene_templates
  for select
  using (true);

insert into public.commercial_scene_templates (template_key)
values ('global_default')
on conflict (template_key) do nothing;
