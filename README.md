# Cheessy — Telegram Mini App MVP

MVP Telegram Mini App для организации офлайн шахматных турниров в Санкт‑Петербурге.

## Локальный запуск

### 1) Supabase

- Создай проект Supabase
- Выполни SQL из `supabase/schema.sql` в SQL Editor
- (Опционально) Выполни SQL из `supabase/seed.sql`, чтобы создать тестовые данные
- Возьми `SUPABASE_URL` и `SUPABASE_SERVICE_ROLE_KEY`

Как применить `seed.sql`:

- Открой Supabase Dashboard → **SQL Editor**
- Вставь содержимое `supabase/seed.sql`
- Нажми **Run**
- После этого `GET /api/tournaments` начнёт возвращать 2 тестовых турнира (один `registration_open`, второй `draft`)

### 2) Backend env

Скопируй `backend/.env.example` → `backend/.env` и заполни:

- `TELEGRAM_BOT_TOKEN`
- `APP_BASE_URL` (для production: `https://cheessy-frontend.vercel.app`)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `JWT_SECRET`

### 3) Frontend env

Скопируй `frontend/.env.example` → `frontend/.env`

### 4) Установка и запуск

```bash
npm install
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:4000/api/health`

## Что уже есть

- Sticker UI каркас (нижняя навигация, экраны: Турниры/Турнир/Профиль/Мерч/Админка)
- Backend API:
  - `POST /api/auth/telegram` (валидация Telegram `initData`, upsert user, cookie JWT)
  - `GET /api/me`
  - `GET /api/tournaments`
  - `GET /api/tournaments/:id`
  - `POST /api/tournaments/:id/register`

Следующий шаг — расширить админ‑флоу и добавить туры/пары/результаты + рассылки ботом.

## Telegram webhook (/start flow)

После деплоя backend настрой webhook для бота:

1. Выполни:
   `https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=https://cheessy-api.onrender.com/api/telegram/webhook`
2. Проверь:
   `https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getWebhookInfo`
3. После этого напиши `/start` боту `@cheesssy_bot`
4. Бот должен прислать кнопку **Открыть Cheessy** (это `web_app` кнопка)

## Очистка тестовых турниров

Если нужно вручную очистить тестовые турниры в production/stage, можно выполнить SQL:

```sql
delete from public.tournaments
where title ilike '%TEST%';
```

Важно: у `tournaments` включён `on delete cascade`, поэтому будут удалены связанные `registrations`, `rounds` и `games`.

## Миграции 0.3 (Supabase SQL)

```sql
alter table public.registrations add column if not exists player_name text;
alter table public.registrations add column if not exists show_telegram_username boolean not null default false;
alter table public.registrations add column if not exists arrival_status text not null default 'normal';
alter table public.registrations drop constraint if exists registrations_status_check;
alter table public.registrations add constraint registrations_status_check check (status in ('registered','cancelled','no_show'));

alter table public.tournaments add column if not exists organizer_contact text;
alter table public.tournaments add column if not exists format text;
alter table public.tournaments add column if not exists time_control text;
alter table public.tournaments add column if not exists important_note text;
```

## Чеклист тестирования 0.3

- Регистрация с обязательным `player_name`
- Приватность username (чекбокс) в публичном списке участников
- Кнопки `Я опаздываю` и `Отменить регистрацию`
- Админ видит `Опаздывает`, `Отменил`, `Не пришёл`
- Публичная live-таблица `GET /api/tournaments/:id/standings` с символами `+ - = B •`
- Экран организатора `/admin/tournaments/:id/display`
- Копирование итоговой таблицы после завершения турнира

