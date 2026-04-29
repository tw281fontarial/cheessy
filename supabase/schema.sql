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
  tables_count integer check (tables_count is null or tables_count > 0),
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
  assigned_table_number integer,
  queue_order integer,
  status text not null default 'playing' check (status in ('waiting','playing','completed')),
  white_user_id uuid references public.users(id) on delete set null,
  black_user_id uuid references public.users(id) on delete set null,
  result text check (result in ('1-0','0-1','0.5-0.5','bye')),
  created_at timestamptz not null default now()
);

create index if not exists games_round_id_idx on public.games(round_id);
create index if not exists games_round_status_queue_idx on public.games(round_id, status, queue_order);
create index if not exists registrations_user_id_idx on public.registrations(user_id);
create index if not exists registrations_tournament_status_idx on public.registrations(tournament_id, status);
create index if not exists tournaments_status_starts_at_idx on public.tournaments(status, starts_at);

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

create or replace function public.register_for_tournament(
  p_tournament_id uuid,
  p_user_id uuid,
  p_player_name text,
  p_show_telegram_username boolean default false,
  p_source text default 'telegram',
  p_checked_in boolean default false,
  p_arrival_status text default 'normal',
  p_allow_admin_status boolean default false,
  p_existing_registered_ok boolean default false
)
returns table(ok boolean, reason text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_max_players integer;
  v_active_count integer;
  v_existing_status text;
  v_existing_id uuid;
begin
  select status, max_players
    into v_status, v_max_players
  from public.tournaments
  where id = p_tournament_id
  for update;

  if not found then
    return query select false, 'not_found';
    return;
  end if;

  if p_allow_admin_status then
    if v_status = 'finished' then
      return query select false, 'tournament_finished';
      return;
    end if;
  elsif v_status <> 'registration_open' then
    return query select false, 'registration_closed';
    return;
  end if;

  select id, status
    into v_existing_id, v_existing_status
  from public.registrations
  where tournament_id = p_tournament_id
    and user_id = p_user_id;

  if v_existing_status = 'registered' then
    if not p_existing_registered_ok then
      return query select false, 'already_registered';
      return;
    end if;

    update public.registrations
    set checked_in = p_checked_in,
        source = p_source,
        player_name = nullif(trim(p_player_name), ''),
        show_telegram_username = p_show_telegram_username,
        arrival_status = p_arrival_status
    where id = v_existing_id;

    return query select true, null::text;
    return;
  end if;

  if v_max_players is not null then
    select count(*)
      into v_active_count
    from public.registrations
    where tournament_id = p_tournament_id
      and status = 'registered';

    if v_active_count >= v_max_players then
      return query select false, 'full';
      return;
    end if;
  end if;

  insert into public.registrations (
    tournament_id,
    user_id,
    source,
    status,
    checked_in,
    player_name,
    show_telegram_username,
    arrival_status
  )
  values (
    p_tournament_id,
    p_user_id,
    p_source,
    'registered',
    p_checked_in,
    nullif(trim(p_player_name), ''),
    p_show_telegram_username,
    p_arrival_status
  )
  on conflict (tournament_id, user_id) do update set
    source = excluded.source,
    status = excluded.status,
    checked_in = excluded.checked_in,
    player_name = excluded.player_name,
    show_telegram_username = excluded.show_telegram_username,
    arrival_status = excluded.arrival_status,
    updated_at = now();

  return query select true, null::text;
end;
$$;
