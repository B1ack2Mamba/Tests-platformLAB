create table if not exists public.commercial_support_threads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.commercial_workspaces(id) on delete cascade,
  workspace_name text,
  user_id uuid not null references auth.users(id) on delete cascade,
  user_email text,
  user_name text,
  company_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_user_message_at timestamptz,
  last_developer_message_at timestamptz,
  telegram_chat_id bigint,
  telegram_thread_id bigint
);

create unique index if not exists commercial_support_threads_workspace_user_uidx
  on public.commercial_support_threads(workspace_id, user_id);

create index if not exists commercial_support_threads_updated_idx
  on public.commercial_support_threads(updated_at desc);

create table if not exists public.commercial_support_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.commercial_support_threads(id) on delete cascade,
  workspace_id uuid not null references public.commercial_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  sender_type text not null check (sender_type in ('user', 'developer')),
  channel text not null default 'site',
  sender_label text,
  body text not null,
  delivery_status text not null default 'sent' check (delivery_status in ('sent', 'failed', 'pending')),
  telegram_message_id bigint,
  telegram_reply_to_message_id bigint,
  metadata jsonb not null default '{}'::jsonb,
  read_by_user_at timestamptz,
  read_by_developer_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists commercial_support_messages_thread_created_idx
  on public.commercial_support_messages(thread_id, created_at asc);

create index if not exists commercial_support_messages_telegram_msg_idx
  on public.commercial_support_messages(telegram_message_id)
  where telegram_message_id is not null;

alter table public.commercial_support_threads enable row level security;
alter table public.commercial_support_messages enable row level security;

drop policy if exists "Support threads: read by owner" on public.commercial_support_threads;
create policy "Support threads: read by owner"
  on public.commercial_support_threads
  for select
  using (auth.uid() = user_id);

drop policy if exists "Support messages: read by owner" on public.commercial_support_messages;
create policy "Support messages: read by owner"
  on public.commercial_support_messages
  for select
  using (auth.uid() = user_id);
