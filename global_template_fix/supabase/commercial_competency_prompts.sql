begin;

create table if not exists public.commercial_competency_prompts (
  competency_id text primary key,
  competency_name text not null,
  competency_cluster text not null,
  system_prompt text not null default '',
  prompt_template text not null default '',
  notes text,
  sort_order integer not null default 100,
  is_active boolean not null default true,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists commercial_competency_prompts_sort_idx
  on public.commercial_competency_prompts(sort_order, competency_id);

create or replace function public.touch_commercial_competency_prompts_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_commercial_competency_prompts_updated_at on public.commercial_competency_prompts;
create trigger trg_touch_commercial_competency_prompts_updated_at
before update on public.commercial_competency_prompts
for each row
execute function public.touch_commercial_competency_prompts_updated_at();

alter table public.commercial_competency_prompts enable row level security;

drop policy if exists commercial_competency_prompts_read_authenticated on public.commercial_competency_prompts;
create policy commercial_competency_prompts_read_authenticated
  on public.commercial_competency_prompts
  for select
  to authenticated
  using (true);

commit;
