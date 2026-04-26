-- Cheessy MVP schema (Supabase PostgreSQL)
-- Apply in Supabase SQL editor. Then enable RLS later if needed.

create extension if not exists "pgcrypto";

-- Users synced from Telegram
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null unique,
  username text,
  first_name text,
  last_name text,
  default_player_name text,
  photo_url text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  location_text text not null,
  starts_at timestamptz not null,
  status text not null default 'draft' check (status in ('draft','registration_open','registration_closed','running','finished')),
  max_players integer,
  organizer_contact text,
  format text,
  time_control text,
  important_note text,
  poster_url text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  source text not null default 'telegram' check (source in ('telegram','offline_admin')),
  status text not null default 'registered' check (status in ('registered','cancelled','no_show')),
  checked_in boolean not null default false,
  player_name text,
  show_telegram_username boolean not null default false,
  arrival_status text not null default 'normal' check (arrival_status in ('normal','late')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tournament_id, user_id)
);

create table if not exists public.rounds (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  round_number integer not null,
  status text not null default 'pairing' check (status in ('pairing','published','completed')),
  created_at timestamptz not null default now(),
  unique (tournament_id, round_number)
);

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds(id) on delete cascade,
  table_number integer not null,
  white_user_id uuid references public.users(id) on delete set null,
  black_user_id uuid references public.users(id) on delete set null,
  result text check (result in ('1-0','0-1','0.5-0.5','bye')),
  created_at timestamptz not null default now()
);

create index if not exists games_round_id_idx on public.games(round_id);

create table if not exists public.bot_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  telegram_chat_id bigint,
  message_type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','sent','failed')),
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

-- updated_at triggers
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'set_users_updated_at') then
    create trigger set_users_updated_at before update on public.users
    for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'set_tournaments_updated_at') then
    create trigger set_tournaments_updated_at before update on public.tournaments
    for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'set_registrations_updated_at') then
    create trigger set_registrations_updated_at before update on public.registrations
    for each row execute function public.set_updated_at();
  end if;
end $$;

