create table if not exists public.commercial_scene_templates (
  template_key text primary key,
  owner_user_id uuid references auth.users(id) on delete set null,
  scene_widgets jsonb not null default '[]'::jsonb,
  desk_template jsonb not null default '{}'::jsonb,
  tray_guide_text text not null default 'Создать новую папку проектов',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_commercial_scene_templates_owner on public.commercial_scene_templates(owner_user_id);

drop trigger if exists trg_commercial_scene_templates_updated_at on public.commercial_scene_templates;
create trigger trg_commercial_scene_templates_updated_at
before update on public.commercial_scene_templates
for each row execute function public.set_updated_at();

alter table public.commercial_scene_templates enable row level security;

drop policy if exists "Authenticated users can view scene templates" on public.commercial_scene_templates;
create policy "Authenticated users can view scene templates"
  on public.commercial_scene_templates
  for select
  using (auth.uid() is not null);
