-- Cheessy MVP seed data for local/dev testing
-- Safe to re-run: users upsert by telegram_id, registrations upsert by (tournament_id,user_id),
-- tournaments are created only if a tournament with same title doesn't exist.

-- 1) Users (1 admin + a few players)
with upserted_users as (
  insert into public.users (telegram_id, username, first_name, last_name, role)
  values
    -- Admin: replace telegram_id with your real Telegram ID if needed
    (999000001, 'test_admin', 'Test', 'Admin', 'admin'),
    (999000101, 'test_player_1', 'Иван', 'Пешкин', 'user'),
    (999000102, 'test_player_2', 'Анна', 'Конёва', 'user'),
    (999000103, 'test_player_3', 'Пётр', 'Ладьин', 'user'),
    (999000104, 'test_player_4', 'Мария', 'Ферзёва', 'user')
  on conflict (telegram_id) do update set
    username = excluded.username,
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    role = excluded.role,
    updated_at = now()
  returning id, telegram_id
),
admin_user as (
  select id from public.users where telegram_id = 999000001
),
-- 2) Tournaments (one open, one draft)
open_tournament as (
  insert into public.tournaments (title, description, location_text, starts_at, status, max_players, created_by)
  select
    'CHEESSY TEST OPEN — SPB',
    'Тестовый турнир для разработки (регистрация открыта).',
    'СПб · Тестовая локация · Невский проспект',
    now() + interval '3 days',
    'registration_open',
    32,
    (select id from admin_user)
  where not exists (select 1 from public.tournaments where title = 'CHEESSY TEST OPEN — SPB')
  returning id
),
draft_tournament as (
  insert into public.tournaments (title, description, location_text, starts_at, status, max_players, created_by)
  select
    'CHEESSY TEST DRAFT — SPB',
    'Тестовый турнир (draft).',
    'СПб · Тестовая локация · Литейный',
    now() + interval '10 days',
    'draft',
    24,
    (select id from admin_user)
  where not exists (select 1 from public.tournaments where title = 'CHEESSY TEST DRAFT — SPB')
  returning id
),
open_tournament_id as (
  select id from open_tournament
  union all
  select id from public.tournaments where title = 'CHEESSY TEST OPEN — SPB'
  limit 1
),
-- 3) Registrations for open tournament
players as (
  select id
  from public.users
  where telegram_id in (999000101, 999000102, 999000103, 999000104)
)
insert into public.registrations (tournament_id, user_id, source, status, checked_in)
select
  (select id from open_tournament_id),
  p.id,
  'telegram',
  'registered',
  false
from players p
on conflict (tournament_id, user_id) do update set
  status = excluded.status,
  checked_in = excluded.checked_in,
  source = excluded.source,
  updated_at = now();

