import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { z } from 'zod'
import { loadEnv } from './env'
import { createSupabaseAdmin } from './supabase'
import { getTelegramUserFromInitData, verifyTelegramInitData } from './telegram/verifyInitData'
import { authMiddleware, requireAuth, requireAdmin, type AuthedRequest } from './auth/middleware'
import { signUserJwt } from './auth/jwt'
import { sendTelegramMessage, sendTelegramMessageWithWebAppButton } from './telegram/bot'
import { computePointsFromGames, swissPairing } from './services/swissPairing'

const env = loadEnv()
const supabase = createSupabaseAdmin(env)

const app = express()
const parseAllowedOrigins = () => {
  const base = [env.APP_BASE_URL]
  const extra = (env.APP_BASE_URLS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const dev = ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://127.0.0.1:5173']
  return [...new Set([...base, ...extra, ...dev])]
}
const allowedOrigins = parseAllowedOrigins()
const corsOptions: cors.CorsOptions = {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true)
    if (allowedOrigins.includes(origin)) return cb(null, true)
    return cb(new Error(`Origin not allowed: ${origin}`))
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
}
app.use(
  cors(corsOptions),
)
app.options(/.*/, cors(corsOptions))
app.use(express.json())
app.use(cookieParser())
app.use(authMiddleware(env))

async function sendBotMessageLogged(args: {
  userId?: string | null
  chatId: number
  messageType: string
  payload: Record<string, unknown>
  text: string
}) {
  const { data: row, error } = await supabase
    .from('bot_outbox')
    .insert({
      user_id: args.userId ?? null,
      telegram_chat_id: args.chatId,
      message_type: args.messageType,
      payload: args.payload,
      status: 'pending',
    })
    .select('id')
    .single()

  const outboxId = row?.id as string | undefined

  try {
    await sendTelegramMessage(env, args.chatId, args.text)
    if (outboxId) {
      await supabase
        .from('bot_outbox')
        .update({ status: 'sent', sent_at: new Date().toISOString(), error: null })
        .eq('id', outboxId)
    }
  } catch (e) {
    if (outboxId) {
      await supabase
        .from('bot_outbox')
        .update({ status: 'failed', error: e instanceof Error ? e.message : String(e) })
        .eq('id', outboxId)
    } else if (error) {
      // if insert failed, rethrow original send error, but keep signal in logs
      // eslint-disable-next-line no-console
      console.error('bot_outbox insert error', error.message)
    }
    throw e
  }
}

function displayName(u: { username?: string | null; first_name?: string | null; last_name?: string | null }) {
  const username = (u.username ?? '').trim()
  const isTechOffline = username.startsWith('offline_')
  if (username && !isTechOffline) return `@${username}`
  const name = `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim()
  if (name) return name
  // fallback: never show @offline_...
  if (username && isTechOffline) return 'Офлайн-участник'
  return 'Игрок'
}

function statusPriority(status: string) {
  switch (status) {
    case 'registration_open':
      return 1
    case 'registration_closed':
      return 2
    case 'running':
      return 3
    case 'finished':
      return 4
    case 'draft':
      return 5
    default:
      return 99
  }
}

app.get('/api/health', (_req, res) => res.json({ ok: true }))

app.post('/api/telegram/webhook', async (req, res) => {
  const message = req.body?.message
  const text = typeof message?.text === 'string' ? message.text : ''
  if (!message || !text.startsWith('/start')) return res.json({ ok: true })

  const from = message?.from
  const chatId = message?.chat?.id
  if (!from?.id || typeof chatId !== 'number') return res.json({ ok: true })

  const { error } = await supabase.from('users').upsert(
    {
      telegram_id: from.id,
      username: from.username ?? null,
      first_name: from.first_name ?? null,
      last_name: from.last_name ?? null,
    },
    { onConflict: 'telegram_id' },
  )

  if (!error) {
    await sendTelegramMessageWithWebAppButton(env, chatId).catch(() => {})
  }

  return res.json({ ok: true })
})

app.post('/api/auth/telegram', async (req: AuthedRequest, res) => {
  const Body = z.object({
    initData: z.string().optional(),
    user: z
      .object({
        id: z.number().int(),
        username: z.string().nullable().optional(),
        first_name: z.string().nullable().optional(),
        last_name: z.string().nullable().optional(),
        photo_url: z.string().nullable().optional(),
      })
      .nullable()
      .optional(),
  })
  const body = Body.safeParse(req.body)
  if (!body.success) return res.status(400).json({ error: 'Bad request' })

  if (!body.data.initData || body.data.initData.trim().length === 0) {
    return res.status(400).json({ error: 'Missing Telegram initData' })
  }
  const initData = body.data.initData

  const ok = verifyTelegramInitData(initData, env.TELEGRAM_BOT_TOKEN)
  if (!ok) {
    return res.status(401).json({ error: 'Invalid Telegram initData' })
  }

  const tgUser = getTelegramUserFromInitData(initData) ?? (body.data.user as any)
  if (!tgUser?.id) return res.status(401).json({ error: 'missing_user' })

  // Upsert user
  const { data: userRow, error } = await supabase
    .from('users')
    .upsert(
      {
        telegram_id: tgUser.id,
        username: tgUser.username ?? null,
        first_name: tgUser.first_name ?? null,
        last_name: tgUser.last_name ?? null,
        photo_url: tgUser.photo_url ?? null,
      },
      { onConflict: 'telegram_id' },
    )
    .select('id, role')
    .single()

  if (error || !userRow) return res.status(500).json({ error: 'DB error' })

  const role = (userRow.role === 'admin' ? 'admin' : 'user') as 'user' | 'admin'
  const token = signUserJwt(env, { sub: userRow.id, role })

  res.cookie('cheessy_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  })

  res.json({
    ok: true,
    token,
    user: {
      id: userRow.id,
      telegramId: tgUser.id,
      username: tgUser.username ?? null,
      firstName: tgUser.first_name ?? null,
      lastName: tgUser.last_name ?? null,
      role,
    },
  })
})

app.post('/api/auth/dev-login', async (req: AuthedRequest, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not found' })
  }

  const Body = z.object({
    telegramId: z.number().int(),
    username: z.string().min(1),
    firstName: z.string().min(1),
  })
  const parsed = Body.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Bad request' })

  const { data: userRow, error } = await supabase
    .from('users')
    .upsert(
      {
        telegram_id: parsed.data.telegramId,
        username: parsed.data.username,
        first_name: parsed.data.firstName,
        // Dev rule: admin only for seeded test admin telegram_id
        role: parsed.data.telegramId === 999000001 ? 'admin' : 'user',
      },
      { onConflict: 'telegram_id' },
    )
    .select('id, telegram_id, username, first_name, last_name, role')
    .single()

  if (error || !userRow) return res.status(500).json({ error: 'DB error' })

  const role = (userRow.role === 'admin' ? 'admin' : 'user') as 'user' | 'admin'
  const token = signUserJwt(env, { sub: userRow.id, role })

  res.cookie('cheessy_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  })

  res.json({
    ok: true,
    token,
    user: {
      id: userRow.id,
      telegramId: userRow.telegram_id,
      username: userRow.username,
      firstName: userRow.first_name,
      lastName: userRow.last_name,
      role,
    },
  })
})

app.get('/api/me', async (req: AuthedRequest, res) => {
  if (!requireAuth(req, res)) return

  const { data: user, error: userErr } = await supabase
    .from('users')
    .select('id, telegram_id, username, first_name, last_name, role')
    .eq('id', req.auth.userId)
    .single()
  if (userErr || !user) return res.status(500).json({ error: 'DB error' })

  const { data: regs, error: regErr } = await supabase
    .from('registrations')
    .select('tournament_id, status, checked_in, tournaments(title, starts_at)')
    .eq('user_id', req.auth.userId)
    .neq('status', 'cancelled')
  if (regErr) return res.status(500).json({ error: 'DB error' })

  res.json({
    user: {
      id: user.id,
      telegramId: user.telegram_id,
      username: user.username,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role === 'admin' ? 'admin' : 'user',
    },
    registrations:
      regs?.map((r: any) => ({
        tournamentId: r.tournament_id,
        tournamentTitle: r.tournaments?.title ?? 'Турнир',
        startsAt: r.tournaments?.starts_at ?? new Date().toISOString(),
        status: r.status,
        checkedIn: r.checked_in,
      })) ?? [],
  })
})

app.get('/api/tournaments', async (_req, res) => {
  const { data, error } = await supabase
    .from('tournaments')
    .select('id, title, starts_at, location_text, status')
    .order('starts_at', { ascending: true })
    .limit(200)
  if (error) return res.status(500).json({ error: 'DB error' })

  const visible = (data ?? []).filter((t) => t.status !== 'draft')
  const sorted = visible.sort((a, b) => {
    const byStatus = statusPriority(a.status) - statusPriority(b.status)
    if (byStatus !== 0) return byStatus
    return new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
  })

  res.json({
    tournaments: sorted.map((t) => ({
      id: t.id,
      title: t.title,
      startsAt: t.starts_at,
      locationText: t.location_text,
      status: t.status,
    })),
  })
})

app.get('/api/tournaments/:id', async (req: AuthedRequest, res) => {
  const id = req.params.id
  const { data: t, error } = await supabase
    .from('tournaments')
    .select('id, title, description, starts_at, location_text, status, max_players')
    .eq('id', id)
    .single()
  if (error || !t) return res.status(404).json({ error: 'Not found' })

  const registrationOpen = t.status === 'registration_open'

  let myRegistration: any = null
  if (req.auth?.userId) {
    const { data: r } = await supabase
      .from('registrations')
      .select('status, checked_in')
      .eq('tournament_id', id)
      .eq('user_id', req.auth.userId)
      .maybeSingle()
    if (r && r.status !== 'cancelled') myRegistration = r
  }

  const { count: registrationsCount } = await supabase
    .from('registrations')
    .select('*', { count: 'exact', head: true })
    .eq('tournament_id', id)
    .neq('status', 'cancelled')

  res.json({
    tournament: {
      id: t.id,
      title: t.title,
      description: t.description,
      startsAt: t.starts_at,
      locationText: t.location_text,
      status: t.status,
      maxPlayers: t.max_players,
      registrationsCount: registrationsCount ?? 0,
      registrationOpen,
      myRegistration,
    },
  })
})

app.post('/api/tournaments/:id/register', async (req: AuthedRequest, res) => {
  if (!requireAuth(req, res)) return
  const tournamentId = req.params.id

  const { data: t, error: tErr } = await supabase
    .from('tournaments')
    .select('id, status, title, starts_at, location_text')
    .eq('id', tournamentId)
    .single()
  if (tErr || !t) return res.status(404).json({ error: 'Not found' })
  if (t.status !== 'registration_open') return res.status(400).json({ error: 'Registration is closed' })

  const { data: existing } = await supabase
    .from('registrations')
    .select('status')
    .eq('tournament_id', tournamentId)
    .eq('user_id', req.auth.userId)
    .maybeSingle()
  if (existing && (existing as any).status === 'registered') return res.status(400).json({ error: 'Already registered' })

  const { error } = await supabase
    .from('registrations')
    .upsert(
      { tournament_id: tournamentId, user_id: req.auth.userId, status: 'registered', source: 'telegram', checked_in: false },
      { onConflict: 'tournament_id,user_id' },
    )
  if (error) return res.status(500).json({ error: 'DB error' })

  // Bot confirmation (logged to bot_outbox)
  const [{ data: user }, { data: tour }] = await Promise.all([
    supabase.from('users').select('telegram_id').eq('id', req.auth.userId).maybeSingle(),
    supabase.from('tournaments').select('title, starts_at, location_text').eq('id', tournamentId).maybeSingle(),
  ])
  const chatId = (user as any)?.telegram_id
  if (typeof chatId === 'number' && chatId > 0) {
    const title = (tour as any)?.title ?? 'Турнир'
    const startsAt = (tour as any)?.starts_at ? new Date((tour as any).starts_at).toLocaleString() : ''
    const location = (tour as any)?.location_text ?? 'Локация уточняется'
    const text = `Ты зарегистрирован на турнир: ${title}. Начало: ${startsAt}. Локация: ${location}.`
    await sendBotMessageLogged({
      userId: req.auth.userId,
      chatId,
      messageType: 'registration_confirmed',
      payload: { tournamentId, title, startsAt },
      text,
    }).catch(() => {})
  }

  res.json({ ok: true })
})

// Admin: open/close registration
app.post('/api/admin/tournaments/:id/registration/open', async (req: AuthedRequest, res) => {
  if (!requireAdmin(req, res)) return
  const { error } = await supabase.from('tournaments').update({ status: 'registration_open' }).eq('id', req.params.id)
  if (error) return res.status(500).json({ error: 'DB error' })
  res.json({ ok: true })
})

app.post('/api/admin/tournaments/:id/registration/close', async (req: AuthedRequest, res) => {
  if (!requireAdmin(req, res)) return
  const { error } = await supabase.from('tournaments').update({ status: 'registration_closed' }).eq('id', req.params.id)
  if (error) return res.status(500).json({ error: 'DB error' })
  res.json({ ok: true })
})

app.get('/api/admin/tournaments', async (req: AuthedRequest, res) => {
  if (!requireAdmin(req, res)) return
  const { data: tournaments, error } = await supabase
    .from('tournaments')
    .select('id, title, starts_at, location_text, status, max_players, created_at')
    .order('starts_at', { ascending: true })
    .limit(200)
  if (error) return res.status(500).json({ error: 'DB error' })

  const { data: regs, error: regErr } = await supabase
    .from('registrations')
    .select('tournament_id, status')
    .neq('status', 'cancelled')
  if (regErr) return res.status(500).json({ error: 'DB error' })

  const counts = new Map<string, number>()
  for (const r of regs ?? []) {
    const tid = (r as any).tournament_id as string
    counts.set(tid, (counts.get(tid) ?? 0) + 1)
  }

  res.json({
    tournaments:
      (tournaments ?? []).map((t: any) => ({
        id: t.id,
        title: t.title,
        startsAt: t.starts_at,
        locationText: t.location_text,
        status: t.status,
        maxPlayers: t.max_players,
        registrationsCount: counts.get(t.id) ?? 0,
      })) ?? [],
  })
})

app.get('/api/admin/tournaments/:id', async (req: AuthedRequest, res) => {
  if (!requireAdmin(req, res)) return
  const { data: t, error } = await supabase
    .from('tournaments')
    .select('id, title, description, location_text, starts_at, status, max_players')
    .eq('id', req.params.id)
    .maybeSingle()
  if (error) return res.status(500).json({ error: 'DB error' })
  if (!t) return res.status(404).json({ error: 'Not found' })
  res.json({
    tournament: {
      id: (t as any).id,
      title: (t as any).title,
      description: (t as any).description,
      locationText: (t as any).location_text,
      startsAt: (t as any).starts_at,
      status: (t as any).status,
      maxPlayers: (t as any).max_players,
    },
  })
})

app.patch('/api/admin/tournaments/:id', async (req: AuthedRequest, res) => {
  if (!requireAdmin(req, res)) return
  const Body = z.object({
    title: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
    locationText: z.string().min(1).optional(),
    startsAt: z.string().min(1).optional(),
    maxPlayers: z.number().int().positive().nullable().optional(),
    status: z.enum(['draft', 'registration_open', 'registration_closed', 'running', 'finished']).optional(),
  })
  const parsed = Body.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Bad request' })

  const patch: any = {}
  if (parsed.data.title !== undefined) patch.title = parsed.data.title
  if (parsed.data.description !== undefined) patch.description = parsed.data.description
  if (parsed.data.locationText !== undefined) patch.location_text = parsed.data.locationText
  if (parsed.data.startsAt !== undefined) patch.starts_at = parsed.data.startsAt
  if (parsed.data.maxPlayers !== undefined) patch.max_players = parsed.data.maxPlayers
  if (parsed.data.status !== undefined) patch.status = parsed.data.status

  const { data, error } = await supabase.from('tournaments').update(patch).eq('id', req.params.id).select('id').maybeSingle()
  if (error) return res.status(500).json({ error: 'DB error' })
  if (!data) return res.status(404).json({ error: 'Not found' })
  res.json({ ok: true })
})

app.get('/api/admin/tournaments/:id/registrations', async (req: AuthedRequest, res) => {
  if (!requireAdmin(req, res)) return
  const tournamentId = req.params.id
  const { data, error } = await supabase
    .from('registrations')
    .select('id, status, checked_in, source, users(id, telegram_id, username, first_name, last_name)')
    .eq('tournament_id', tournamentId)
    .order('created_at', { ascending: true })
  if (error) return res.status(500).json({ error: 'DB error' })
  res.json({
    registrations:
      data?.map((r: any) => ({
        id: r.id,
        status: r.status,
        checkedIn: r.checked_in,
        source: r.source,
        user: {
          id: r.users?.id,
          telegramId: r.users?.telegram_id,
          username: r.users?.username,
          firstName: r.users?.first_name,
          lastName: r.users?.last_name,
        },
      })) ?? [],
  })
})

app.patch('/api/admin/registrations/:registrationId/check-in', async (req: AuthedRequest, res) => {
  if (!requireAdmin(req, res)) return
  const { data, error } = await supabase
    .from('registrations')
    .update({ checked_in: true })
    .eq('id', req.params.registrationId)
    .select('id')
    .maybeSingle()
  if (error) return res.status(500).json({ error: 'DB error' })
  if (!data) return res.status(404).json({ error: 'Not found' })
  res.json({ ok: true })
})

app.patch('/api/admin/registrations/:registrationId/uncheck', async (req: AuthedRequest, res) => {
  if (!requireAdmin(req, res)) return
  const { data, error } = await supabase
    .from('registrations')
    .update({ checked_in: false })
    .eq('id', req.params.registrationId)
    .select('id')
    .maybeSingle()
  if (error) return res.status(500).json({ error: 'DB error' })
  if (!data) return res.status(404).json({ error: 'Not found' })
  res.json({ ok: true })
})

// Admin: add offline participant (minimal: creates a pseudo-user row with telegram_id negative)
app.post('/api/admin/tournaments/:id/participants/offline', async (req: AuthedRequest, res) => {
  if (!requireAdmin(req, res)) return
  const Body = z.object({ displayName: z.string().min(1) })
  const parsed = Body.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'bad_request' })

  const fakeTelegramId = -Math.floor(Date.now() / 1000)
  const [firstName, ...rest] = parsed.data.displayName.split(' ')
  const lastName = rest.join(' ') || null

  const { data: user, error: uErr } = await supabase
    .from('users')
    .insert({
      telegram_id: fakeTelegramId,
      first_name: firstName,
      last_name: lastName,
      username: null,
      photo_url: null,
      role: 'user',
    })
    .select('id')
    .single()
  if (uErr || !user) return res.status(500).json({ error: 'DB error' })

  const { error: rErr } = await supabase
    .from('registrations')
    .upsert(
      {
        tournament_id: req.params.id,
        user_id: user.id,
        status: 'registered',
        source: 'offline_admin',
        checked_in: true,
      },
      { onConflict: 'tournament_id,user_id' },
    )
  if (rErr) return res.status(500).json({ error: 'DB error' })

  res.json({ ok: true, userId: user.id })
})

// Alias endpoint as requested by admin spec
app.post('/api/admin/tournaments/:id/offline-participant', async (req: AuthedRequest, res) => {
  if (!requireAdmin(req, res)) return
  const Body = z.object({
    nickname: z.string().min(1),
    fullName: z.string().optional().nullable(),
  })
  const parsed = Body.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Bad request' })

  const normalizeUsername = (raw: string) => {
    let u = raw.trim()
    if (u.startsWith('@')) u = u.slice(1)
    u = u.replace(/\s+/g, '_')
    u = u.replace(/[^a-zA-Z0-9_]/g, '_')
    u = u.replace(/_+/g, '_')
    u = u.replace(/^_+|_+$/g, '')
    return u.toLowerCase()
  }

  const fakeTelegramId = -Math.floor(Date.now() / 1000)
  const username = normalizeUsername(parsed.data.nickname) || `offline_${fakeTelegramId * -1}`
  const fullName = (parsed.data.fullName ?? '').trim()
  const firstName = fullName || parsed.data.nickname.trim().replace(/^@/, '')

  const { data: user, error: uErr } = await supabase
    .from('users')
    .insert({
      telegram_id: fakeTelegramId,
      first_name: firstName,
      last_name: null,
      username,
      photo_url: null,
      role: 'user',
    })
    .select('id')
    .single()
  if (uErr || !user) return res.status(500).json({ error: 'DB error' })

  const { error: rErr } = await supabase
    .from('registrations')
    .upsert(
      {
        tournament_id: req.params.id,
        user_id: user.id,
        status: 'registered',
        source: 'offline_admin',
        checked_in: true,
      },
      { onConflict: 'tournament_id,user_id' },
    )
  if (rErr) return res.status(500).json({ error: 'DB error' })

  res.json({ ok: true, userId: user.id })
})

app.post('/api/admin/tournaments/:id/participants/:userId/checkin', async (req: AuthedRequest, res) => {
  if (!requireAdmin(req, res)) return
  const { error } = await supabase
    .from('registrations')
    .update({ checked_in: true })
    .eq('tournament_id', req.params.id)
    .eq('user_id', req.params.userId)
  if (error) return res.status(500).json({ error: 'DB error' })
  res.json({ ok: true })
})

app.post('/api/admin/tournaments/:id/notify/15min', async (req: AuthedRequest, res) => {
  if (!requireAdmin(req, res)) return
  const tournamentId = req.params.id
  const { data: t } = await supabase.from('tournaments').select('title, starts_at').eq('id', tournamentId).maybeSingle()
  const { data: regs, error } = await supabase
    .from('registrations')
    .select('user_id, users(telegram_id)')
    .eq('tournament_id', tournamentId)
    .eq('status', 'registered')
  if (error) return res.status(500).json({ error: 'DB error' })

  const title = (t as any)?.title ?? 'Турнир'
  const msg = `Турнир ${title} начнётся через 15 минут. Подходи к организатору для отметки.`
  const targets = (regs ?? [])
    .map((r: any) => ({ userId: r.user_id as string | undefined, chatId: r.users?.telegram_id as number | undefined }))
    .filter((x: any) => typeof x.chatId === 'number' && x.chatId > 0) as Array<{ userId?: string; chatId: number }>

  await Promise.allSettled(
    targets.map((t) =>
      sendBotMessageLogged({
        userId: t.userId ?? null,
        chatId: t.chatId,
        messageType: 'tournament_15min',
          payload: { tournamentId, title },
        text: msg,
      }),
    ),
  )
  res.json({ ok: true, sent: targets.length })
})

app.post('/api/admin/tournaments/:id/start', async (req: AuthedRequest, res) => {
  if (!requireAdmin(req, res)) return
  const tournamentId = req.params.id
  const { data: tournament, error: tErr } = await supabase
    .from('tournaments')
    .select('id, status, title')
    .eq('id', tournamentId)
    .single()
  if (tErr || !tournament) return res.status(404).json({ error: 'Not found' })
  if ((tournament as any).status === 'finished') return res.status(400).json({ error: 'Tournament is finished' })

  const { data: r1 } = await supabase
    .from('rounds')
    .select('id')
    .eq('tournament_id', tournamentId)
    .eq('round_number', 1)
    .maybeSingle()
  if (r1) return res.status(400).json({ error: 'Round already exists' })

  // Only checked-in registered participants
  const { data: regs, error: rErr } = await supabase
    .from('registrations')
    .select('users(id, telegram_id, username, first_name, last_name)')
    .eq('tournament_id', tournamentId)
    .eq('status', 'registered')
    .eq('checked_in', true)
  if (rErr) return res.status(500).json({ error: 'DB error' })

  const players = (regs ?? [])
    .map((r: any) => r.users)
    .filter(Boolean)
    .map((u: any) => ({
      userId: u.id as string,
      telegramId: typeof u.telegram_id === 'number' && u.telegram_id > 0 ? (u.telegram_id as number) : null,
      name: displayName(u),
    }))

  if (players.length === 0) return res.status(400).json({ error: 'No checked-in participants' })
  if (players.length < 2) return res.status(400).json({ error: 'Not enough participants' })

  // running + close registration
  const { error: updErr } = await supabase.from('tournaments').update({ status: 'running' }).eq('id', tournamentId)
  if (updErr) return res.status(500).json({ error: 'DB error' })

  const pairing = swissPairing({
    players,
    points: new Map(),
    pastPairs: [],
    byeHistory: new Set(),
    roundNumber: 1,
  })

  const { data: round, error: roundErr } = await supabase
    .from('rounds')
    .insert({ tournament_id: tournamentId, round_number: 1, status: 'published' })
    .select('id')
    .single()
  if (roundErr || !round) return res.status(500).json({ error: 'DB error' })

  const inserts: any[] = pairing.pairs.map((p) => ({
    round_id: (round as any).id,
    table_number: p.table,
    white_user_id: p.white.userId,
    black_user_id: p.black.userId,
    result: null,
  }))

  if (pairing.bye) {
    inserts.push({
      round_id: (round as any).id,
      table_number: pairing.pairs.length + 1,
      white_user_id: pairing.bye.userId,
      black_user_id: null,
      result: 'bye',
    })
  }

  const { error: gErr } = await supabase.from('games').insert(inserts)
  if (gErr) return res.status(500).json({ error: 'DB error' })

  // Notify pairings; failures don't break start
  const tasks: Promise<unknown>[] = []
  for (const p of pairing.pairs) {
    if (p.white.telegramId)
      tasks.push(
        sendBotMessageLogged({
          userId: p.white.userId,
          chatId: p.white.telegramId,
          messageType: 'pairing_published',
          payload: { tournamentId, roundNumber: 1, tableNumber: p.table, opponent: p.black.name, color: 'white' },
          text: `Тур №1. Стол №${p.table}. Твой соперник: ${p.black.name}. Ты играешь белыми.`,
        }).catch(() => {}),
      )
    if (p.black.telegramId)
      tasks.push(
        sendBotMessageLogged({
          userId: p.black.userId,
          chatId: p.black.telegramId,
          messageType: 'pairing_published',
          payload: { tournamentId, roundNumber: 1, tableNumber: p.table, opponent: p.white.name, color: 'black' },
          text: `Тур №1. Стол №${p.table}. Твой соперник: ${p.white.name}. Ты играешь чёрными.`,
        }).catch(() => {}),
      )
  }

  if (pairing.bye?.telegramId) {
    tasks.push(
      sendBotMessageLogged({
        userId: pairing.bye.userId,
        chatId: pairing.bye.telegramId,
        messageType: 'bye',
        payload: { tournamentId, roundNumber: 1 },
        text: `Тур №1. У тебя bye, ты получаешь 1 очко.`,
      }).catch(() => {}),
    )
  }
  Promise.allSettled(tasks).catch(() => {})

  res.json({ ok: true, roundId: (round as any).id })
})

async function generateNextRound(req: AuthedRequest, res: express.Response) {
  if (!requireAdmin(req, res)) return
  const tournamentId = req.params.id

  const { data: tournament, error: tErr } = await supabase
    .from('tournaments')
    .select('id, status')
    .eq('id', tournamentId)
    .single()
  if (tErr || !tournament) return res.status(404).json({ error: 'Not found' })
  if ((tournament as any).status !== 'running') return res.status(400).json({ error: 'Tournament is not running' })

  const { data: existingRounds } = await supabase
    .from('rounds')
    .select('round_number')
    .eq('tournament_id', tournamentId)
    .order('round_number', { ascending: false })
    .limit(1)
  const nextRoundNumber = (existingRounds?.[0]?.round_number ?? 0) + 1

  const { data: same } = await supabase
    .from('rounds')
    .select('id')
    .eq('tournament_id', tournamentId)
    .eq('round_number', nextRoundNumber)
    .maybeSingle()
  if (same) return res.status(400).json({ error: 'Round already exists' })

  if (nextRoundNumber > 1) {
    const prevRoundNumber = nextRoundNumber - 1
    const { data: prevRound } = await supabase
      .from('rounds')
      .select('id')
      .eq('tournament_id', tournamentId)
      .eq('round_number', prevRoundNumber)
      .maybeSingle()
    if (!prevRound) return res.status(400).json({ error: 'Previous round not found' })

    const { data: pending } = await supabase
      .from('games')
      .select('id, result')
      .eq('round_id', (prevRound as any).id)
      .is('result', null)
    if ((pending ?? []).length > 0) return res.status(400).json({ error: 'Current round is not finished' })
  }

  // participants: only registered + checked-in at generation moment
  const { data: regs } = await supabase
    .from('registrations')
    .select('checked_in, users(id, telegram_id, first_name, last_name, username)')
    .eq('tournament_id', tournamentId)
    .eq('status', 'registered')

  const checkedIn = (regs ?? []).filter((r: any) => r.checked_in)
  const players = checkedIn
    .map((r: any) => r.users)
    .filter(Boolean)
    .map((u: any) => ({
      userId: u.id as string,
      telegramId: typeof u.telegram_id === 'number' && u.telegram_id > 0 ? (u.telegram_id as number) : null,
      name: displayName(u),
    }))

  if (checkedIn.length === 0) return res.status(400).json({ error: 'No checked-in participants' })
  if (players.length < 2) return res.status(400).json({ error: 'Not enough participants' })

  // past games for points + repeat avoidance
  const { data: pastGameRows } = await supabase
    .from('games')
    .select('white_user_id, black_user_id, result, rounds!inner(tournament_id)')
    .eq('rounds.tournament_id', tournamentId)

  const points = computePointsFromGames((pastGameRows ?? []) as any)
  const pastPairs =
    (pastGameRows ?? [])
      .filter((g: any) => g.white_user_id && g.black_user_id)
      .map((g: any) => ({ a: g.white_user_id as string, b: g.black_user_id as string })) ?? []

  const byeHistory = new Set<string>()
  for (const g of pastGameRows ?? []) {
    if ((g as any).result === 'bye') {
      const p = (g as any).white_user_id ?? (g as any).black_user_id
      if (p) byeHistory.add(p)
    }
  }

  const { pairs, bye } = swissPairing({ players, points, pastPairs, byeHistory, roundNumber: nextRoundNumber })

  const { data: round, error: rErr } = await supabase
    .from('rounds')
    .insert({ tournament_id: tournamentId, round_number: nextRoundNumber, status: 'published' })
    .select('id')
    .single()
  if (rErr || !round) return res.status(500).json({ error: 'DB error' })

  const gameInserts = pairs.map((p: any) => ({
    round_id: round.id,
    table_number: p.table,
    white_user_id: p.white.userId,
    black_user_id: p.black.userId,
    result: null,
  }))

  if (bye) {
    gameInserts.push({
      round_id: round.id,
      table_number: pairs.length + 1,
      white_user_id: bye.userId,
      black_user_id: null,
      result: 'bye',
    } as any)
  }

  const { error: gErr } = await supabase.from('games').insert(gameInserts)
  if (gErr) return res.status(500).json({ error: 'DB error' })

  // Notify pairings; failures don't break generation
  const tasks: Promise<unknown>[] = []
  for (const p of pairs as any[]) {
    if (p.white.telegramId)
      tasks.push(
        sendBotMessageLogged({
          userId: p.white.userId,
          chatId: p.white.telegramId,
          messageType: 'pairing_published',
          payload: { tournamentId, roundNumber: nextRoundNumber, tableNumber: p.table, opponent: p.black.name, color: 'white' },
          text: `Тур №${nextRoundNumber}. Стол №${p.table}. Твой соперник: ${p.black.name}. Ты играешь белыми.`,
        }).catch(() => {}),
      )
    if (p.black.telegramId)
      tasks.push(
        sendBotMessageLogged({
          userId: p.black.userId,
          chatId: p.black.telegramId,
          messageType: 'pairing_published',
          payload: { tournamentId, roundNumber: nextRoundNumber, tableNumber: p.table, opponent: p.white.name, color: 'black' },
          text: `Тур №${nextRoundNumber}. Стол №${p.table}. Твой соперник: ${p.white.name}. Ты играешь чёрными.`,
        }).catch(() => {}),
      )
  }
  if (bye?.telegramId) {
    tasks.push(
      sendBotMessageLogged({
        userId: bye.userId,
        chatId: bye.telegramId,
        messageType: 'bye',
        payload: { tournamentId, roundNumber: nextRoundNumber },
        text: `Тур №${nextRoundNumber}. У тебя bye, ты получаешь 1 очко.`,
      }).catch(() => {}),
    )
  }
  Promise.allSettled(tasks).catch(() => {})

  res.json({ ok: true, roundId: round.id, roundNumber: nextRoundNumber })
}

app.post('/api/admin/tournaments/:id/rounds/next', generateNextRound)
app.post('/api/admin/tournaments/:id/rounds/generate', generateNextRound)

app.post('/api/admin/rounds/:roundId/publish-pairings', async (req: AuthedRequest, res) => {
  if (!requireAdmin(req, res)) return
  const roundId = req.params.roundId

  const { data: round, error: rErr } = await supabase
    .from('rounds')
    .select('id, round_number, tournaments!inner(id, title)')
    .eq('id', roundId)
    .single()
  if (rErr || !round) return res.status(404).json({ error: 'Not found' })

  const { data: games, error: gErr } = await supabase
    .from('games')
    .select(
      'id, table_number, result, white_user_id, black_user_id, white:users!games_white_user_id_fkey(telegram_id, first_name, last_name, username), black:users!games_black_user_id_fkey(telegram_id, first_name, last_name, username)',
    )
    .eq('round_id', roundId)
    .order('table_number', { ascending: true })
  if (gErr) return res.status(500).json({ error: 'DB error' })

  const title = (round as any).tournaments?.title ?? 'Турнир'
  const roundNumber = (round as any).round_number

  const tasks: Promise<unknown>[] = []
  for (const g of games ?? []) {
    if ((g as any).result === 'bye') continue
    const white = (g as any).white
    const black = (g as any).black
    if (!white?.telegram_id || !black?.telegram_id) continue

    const wName = white.username ? `@${white.username}` : `${white.first_name ?? ''} ${white.last_name ?? ''}`.trim()
    const bName = black.username ? `@${black.username}` : `${black.first_name ?? ''} ${black.last_name ?? ''}`.trim()
    const table = (g as any).table_number

    tasks.push(
      sendBotMessageLogged({
        userId: (g as any).white_user_id,
        chatId: white.telegram_id,
        messageType: 'pairing_published',
        payload: { tournamentTitle: title, roundNumber, tableNumber: table, opponent: bName, color: 'white' },
        text: `♟️ ${title}\nТур ${roundNumber}\nСтол ${table}\nТвой оппонент: ${bName}\nЦвет: белые`,
      }),
    )
    tasks.push(
      sendBotMessageLogged({
        userId: (g as any).black_user_id,
        chatId: black.telegram_id,
        messageType: 'pairing_published',
        payload: { tournamentTitle: title, roundNumber, tableNumber: table, opponent: wName, color: 'black' },
        text: `♟️ ${title}\nТур ${roundNumber}\nСтол ${table}\nТвой оппонент: ${wName}\nЦвет: чёрные`,
      }),
    )
  }

  await Promise.allSettled(tasks)
  await supabase.from('rounds').update({ status: 'published' }).eq('id', roundId)
  res.json({ ok: true })
})

app.get('/api/admin/tournaments/:id/rounds', async (req: AuthedRequest, res) => {
  if (!requireAdmin(req, res)) return
  const tournamentId = req.params.id
  const { data, error } = await supabase
    .from('rounds')
    .select('id, round_number, status, created_at')
    .eq('tournament_id', tournamentId)
    .order('round_number', { ascending: false })
  if (error) return res.status(500).json({ error: 'DB error' })
  res.json({ rounds: (data ?? []).map((r: any) => ({ id: r.id, roundNumber: r.round_number, status: r.status })) })
})

app.get('/api/admin/tournaments/:id/games', async (req: AuthedRequest, res) => {
  if (!requireAdmin(req, res)) return
  const tournamentId = req.params.id

  const { data: rounds, error: rErr } = await supabase
    .from('rounds')
    .select('id, round_number')
    .eq('tournament_id', tournamentId)
  if (rErr) return res.status(500).json({ error: 'DB error' })

  const roundMap = new Map<string, number>()
  const roundIds = (rounds ?? []).map((r: any) => {
    roundMap.set(r.id, r.round_number)
    return r.id
  })
  if (roundIds.length === 0) return res.json({ games: [] })

  const { data: games, error: gErr } = await supabase
    .from('games')
    .select(
      'id, round_id, table_number, white_user_id, black_user_id, result, white:users!games_white_user_id_fkey(id, username, first_name, last_name), black:users!games_black_user_id_fkey(id, username, first_name, last_name)',
    )
    .in('round_id', roundIds)
    .order('round_id', { ascending: false })
    .order('table_number', { ascending: true })
  if (gErr) return res.status(500).json({ error: 'DB error' })

  res.json({
    games:
      (games ?? []).map((g: any) => ({
        id: g.id,
        round_id: g.round_id,
        roundNumber: roundMap.get(g.round_id) ?? 0,
        table_number: g.table_number,
        white_user_id: g.white_user_id,
        black_user_id: g.black_user_id,
        result: g.result,
        white: g.white_user_id
          ? {
              id: g.white?.id ?? g.white_user_id,
              username: g.white?.username ?? null,
              first_name: g.white?.first_name ?? null,
              last_name: g.white?.last_name ?? null,
            }
          : null,
        black: g.black_user_id
          ? {
              id: g.black?.id ?? g.black_user_id,
              username: g.black?.username ?? null,
              first_name: g.black?.first_name ?? null,
              last_name: g.black?.last_name ?? null,
            }
          : null,
      })) ?? [],
  })
})

async function setGameResult(req: AuthedRequest, res: express.Response) {
  if (!requireAdmin(req, res)) return
  const Body = z.object({ result: z.enum(['1-0', '0-1', '0.5-0.5', 'bye']) })
  const parsed = Body.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Bad request' })

  const { data: game, error: gErr } = await supabase
    .from('games')
    .select('id, round_id, table_number, white_user_id, black_user_id, result, rounds!inner(tournament_id)')
    .eq('id', req.params.gameId)
    .single()
  if (gErr || !game) return res.status(404).json({ error: 'Not found' })

  const { data: tour } = await supabase
    .from('tournaments')
    .select('status')
    .eq('id', (game as any).rounds?.tournament_id)
    .maybeSingle()
  if ((tour as any)?.status === 'finished') return res.status(400).json({ error: 'Tournament is finished' })

  const { error } = await supabase.from('games').update({ result: parsed.data.result }).eq('id', game.id)
  if (error) return res.status(500).json({ error: 'DB error' })

  const { data: remaining } = await supabase
    .from('games')
    .select('id, result')
    .eq('round_id', (game as any).round_id)
    .is('result', null)

  if ((remaining ?? []).length === 0) {
    await supabase.from('rounds').update({ status: 'completed' }).eq('id', (game as any).round_id)
  }

  res.json({
    ok: true,
    game: {
      id: (game as any).id,
      round_id: (game as any).round_id,
      table_number: (game as any).table_number,
      white_user_id: (game as any).white_user_id,
      black_user_id: (game as any).black_user_id,
      result: parsed.data.result,
    },
  })
}

app.patch('/api/admin/games/:gameId/result', setGameResult)
app.post('/api/admin/games/:gameId/result', setGameResult)

app.get('/api/admin/tournaments/:id/standings', async (req: AuthedRequest, res) => {
  if (!requireAdmin(req, res)) return
  const tournamentId = req.params.id

  const { data: regs, error: rErr } = await supabase
    .from('registrations')
    .select('users(id, username, first_name, last_name)')
    .eq('tournament_id', tournamentId)
    .eq('status', 'registered')
    .eq('checked_in', true)
  if (rErr) return res.status(500).json({ error: 'DB error' })

  const users = (regs ?? []).map((r: any) => r.users).filter(Boolean)
  const ids = users.map((u: any) => u.id)

  const { data: pastGameRows, error: gErr } = await supabase
    .from('games')
    .select('white_user_id, black_user_id, result, rounds!inner(tournament_id)')
    .eq('rounds.tournament_id', tournamentId)
  if (gErr) return res.status(500).json({ error: 'DB error' })

  const pts = computePointsFromGames((pastGameRows ?? []) as any)
  const standings = ids
    .map((id: string) => {
      const u = users.find((x: any) => x.id === id)
      return { userId: id, name: displayName(u ?? {}), points: pts.get(id) ?? 0 }
    })
    .sort((a, b) => b.points - a.points || a.userId.localeCompare(b.userId))
    .map((row, idx) => ({ place: idx + 1, ...row }))

  res.json({ standings })
})

app.post('/api/admin/tournaments/:id/finish', async (req: AuthedRequest, res) => {
  if (!requireAdmin(req, res)) return
  const { data: t } = await supabase.from('tournaments').select('status').eq('id', req.params.id).maybeSingle()
  if (!t) return res.status(404).json({ error: 'Not found' })
  if ((t as any).status === 'finished') return res.status(400).json({ error: 'Tournament is already finished' })
  const { error } = await supabase.from('tournaments').update({ status: 'finished' }).eq('id', req.params.id)
  if (error) return res.status(500).json({ error: 'DB error' })
  res.json({ ok: true })
})

// Admin: create tournament
app.post('/api/admin/tournaments', async (req: AuthedRequest, res) => {
  if (!requireAdmin(req, res)) return
  const auth = req.auth!
  const Body = z.object({
    title: z.string().trim().optional(),
    description: z.string().nullable().optional(),
    locationText: z.string().trim().optional(),
    location_text: z.string().trim().optional(),
    startsAt: z.string().optional(),
    starts_at: z.string().optional(),
    maxPlayers: z.number().int().positive().nullable().optional(),
    max_players: z.number().int().positive().nullable().optional(),
    status: z.enum(['draft', 'registration_open', 'registration_closed', 'running', 'finished']).optional(),
  })
  const parsed = Body.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Bad request' })

  const title = (parsed.data.title ?? '').trim()
  if (!title) return res.status(400).json({ error: 'Title is required' })
  const locationText = (parsed.data.locationText ?? parsed.data.location_text ?? '').trim()
  if (!locationText) return res.status(400).json({ error: 'Location is required' })
  const startsAtRaw = parsed.data.startsAt ?? parsed.data.starts_at
  const startsAt = startsAtRaw ? new Date(startsAtRaw) : null
  if (!startsAt || Number.isNaN(startsAt.getTime())) return res.status(400).json({ error: 'Invalid starts_at' })
  const status = parsed.data.status ?? 'draft'
  const maxPlayers = parsed.data.maxPlayers ?? parsed.data.max_players ?? null

  const { data, error } = await supabase
    .from('tournaments')
    .insert({
      title,
      description: parsed.data.description ?? null,
      location_text: locationText,
      starts_at: startsAt.toISOString(),
      status,
      max_players: maxPlayers,
      created_by: auth.userId,
    })
    .select('id')
    .single()
  if (error || !data) return res.status(500).json({ error: 'DB error' })

  res.json({ ok: true, id: data.id })
})

app.get('/api/tournaments/:id/my-current-game', async (req: AuthedRequest, res) => {
  if (!requireAuth(req, res)) return
  const tournamentId = req.params.id

  const { data: round } = await supabase
    .from('rounds')
    .select('id, round_number, status')
    .eq('tournament_id', tournamentId)
    .eq('status', 'published')
    .order('round_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!round) return res.json({ game: null })

  const { data: game, error } = await supabase
    .from('games')
    .select(
      'id, table_number, result, white_user_id, black_user_id, white:users!games_white_user_id_fkey(id, username, first_name, last_name), black:users!games_black_user_id_fkey(id, username, first_name, last_name)',
    )
    .eq('round_id', (round as any).id)
    .or(`white_user_id.eq.${req.auth.userId},black_user_id.eq.${req.auth.userId}`)
    .maybeSingle()
  if (error) return res.status(500).json({ error: 'DB error' })
  if (!game) return res.json({ game: null })

  const isWhite = (game as any).white_user_id === req.auth.userId
  const opponent = isWhite ? (game as any).black : (game as any).white
  const color = (game as any).result === 'bye' || !(game as any).black_user_id ? null : isWhite ? 'white' : 'black'
  res.json({
    game: {
      roundNumber: (round as any).round_number,
      tableNumber: (game as any).table_number,
      color,
      opponent: opponent
        ? {
            id: opponent.id,
            username: opponent.username,
            firstName: opponent.first_name,
            lastName: opponent.last_name,
            displayName: displayName(opponent),
          }
        : null,
      result: (game as any).result,
      isBye: (game as any).result === 'bye' || !(game as any).black_user_id,
    },
  })
})

app.get('/api/tournaments/:id/final-standings', async (req: AuthedRequest, res) => {
  const tournamentId = req.params.id
  const { data: t, error: tErr } = await supabase.from('tournaments').select('status').eq('id', tournamentId).maybeSingle()
  if (tErr || !t) return res.status(404).json({ error: 'Not found' })
  if ((t as any).status !== 'finished' && req.auth?.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const { data: regs, error: rErr } = await supabase
    .from('registrations')
    .select('users(id, username, first_name, last_name)')
    .eq('tournament_id', tournamentId)
    .eq('status', 'registered')
  if (rErr) return res.status(500).json({ error: 'DB error' })

  const users = (regs ?? []).map((r: any) => r.users).filter(Boolean)
  const userMap = new Map<string, any>()
  for (const u of users) userMap.set(u.id, u)

  const { data: games, error: gErr } = await supabase
    .from('games')
    .select('white_user_id, black_user_id, result, rounds!inner(tournament_id)')
    .eq('rounds.tournament_id', tournamentId)
  if (gErr) return res.status(500).json({ error: 'DB error' })

  const points = computePointsFromGames((games ?? []) as any)
  const stats = new Map<string, { wins: number; draws: number; losses: number }>()
  const ensureStats = (id: string) => {
    if (!stats.has(id)) stats.set(id, { wins: 0, draws: 0, losses: 0 })
    return stats.get(id)!
  }
  for (const g of games ?? []) {
    if (!(g as any).white_user_id) continue
    const whiteId = (g as any).white_user_id as string
    const blackId = ((g as any).black_user_id as string | null) ?? null
    if ((g as any).result === '1-0' && blackId) {
      ensureStats(whiteId).wins += 1
      ensureStats(blackId).losses += 1
    } else if ((g as any).result === '0-1' && blackId) {
      ensureStats(whiteId).losses += 1
      ensureStats(blackId).wins += 1
    } else if ((g as any).result === '0.5-0.5' && blackId) {
      ensureStats(whiteId).draws += 1
      ensureStats(blackId).draws += 1
    }
  }

  const standings = [...userMap.keys()]
    .map((id) => {
      const u = userMap.get(id)
      const s = ensureStats(id)
      return { userId: id, name: displayName(u ?? {}), points: points.get(id) ?? 0, ...s }
    })
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name))
    .map((row, idx) => ({ place: idx + 1, ...row }))

  res.json({ standings })
})

app.post('/api/admin/tournaments/:id/add-telegram-participant', async (req: AuthedRequest, res) => {
  if (!requireAdmin(req, res)) return
  const Body = z.object({ username: z.string().min(1) })
  const parsed = Body.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Bad request' })
  const tournamentId = req.params.id

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, status, title')
    .eq('id', tournamentId)
    .maybeSingle()
  if (!tournament) return res.status(404).json({ error: 'Not found' })
  if ((tournament as any).status === 'finished') return res.status(400).json({ error: 'Tournament is finished' })

  const normalizedUsername = parsed.data.username.trim().replace(/^@+/, '').toLowerCase()
  const { data: user } = await supabase
    .from('users')
    .select('id, telegram_id, username')
    .ilike('username', normalizedUsername)
    .maybeSingle()
  if (!user) {
    return res.status(404).json({ error: 'Пользователь не найден. Попроси его сначала открыть бота /start.' })
  }

  const { data: existing } = await supabase
    .from('registrations')
    .select('id, status, checked_in')
    .eq('tournament_id', tournamentId)
    .eq('user_id', (user as any).id)
    .maybeSingle()

  if (existing) {
    const { error: updErr } = await supabase
      .from('registrations')
      .update({ status: 'registered', checked_in: true, source: 'telegram' })
      .eq('id', (existing as any).id)
    if (updErr) return res.status(500).json({ error: 'DB error' })
  } else {
    const { error: insertErr } = await supabase.from('registrations').insert({
      tournament_id: tournamentId,
      user_id: (user as any).id,
      source: 'telegram',
      status: 'registered',
      checked_in: true,
    })
    if (insertErr) return res.status(500).json({ error: 'DB error' })
  }

  const chatId = (user as any).telegram_id
  if (typeof chatId === 'number' && chatId > 0) {
    await sendBotMessageLogged({
      userId: (user as any).id,
      chatId,
      messageType: 'late_participant_added',
      payload: { tournamentId, title: (tournament as any).title },
      text: `Тебя добавили в турнир ${(tournament as any).title}. Ты начнёшь играть со следующего тура.`,
    }).catch(() => {})
  }

  res.json({ ok: true })
})

app.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`backend listening on :${env.PORT}`)
})

