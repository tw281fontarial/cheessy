-- Registration limits, venue table count, and game table waves.

alter table public.tournaments
add column if not exists tables_count integer;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tournaments_tables_count_check'
      and conrelid = 'public.tournaments'::regclass
  ) then
    alter table public.tournaments
      add constraint tournaments_tables_count_check
      check (tables_count is null or tables_count > 0);
  end if;
end $$;

alter table public.games
add column if not exists assigned_table_number integer;

alter table public.games
add column if not exists queue_order integer;

alter table public.games
add column if not exists status text not null default 'playing';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'games_status_check'
      and conrelid = 'public.games'::regclass
  ) then
    alter table public.games
      add constraint games_status_check
      check (status in ('waiting','playing','completed'));
  end if;
end $$;

update public.games
set
  queue_order = coalesce(queue_order, table_number),
  assigned_table_number = case
    when result is null and assigned_table_number is null then table_number
    else assigned_table_number
  end,
  status = case
    when result is not null then 'completed'
    else coalesce(status, 'playing')
  end;

create index if not exists games_round_status_queue_idx
  on public.games(round_id, status, queue_order);

create index if not exists registrations_user_id_idx
  on public.registrations(user_id);

create index if not exists registrations_tournament_status_idx
  on public.registrations(tournament_id, status);

create index if not exists tournaments_status_starts_at_idx
  on public.tournaments(status, starts_at);

drop policy if exists "anon upload tournament-posters" on storage.objects;

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
