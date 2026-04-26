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

