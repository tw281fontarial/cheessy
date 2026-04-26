import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { api } from '../../lib/api'
import { statusLabel } from '../../lib/display'
import { StickerCard } from '../components/StickerCard'
import { Button } from '../components/Button'
import { BackButton } from '../components/BackButton'

type Tournament = {
  id: string
  title: string
  description: string | null
  startsAt: string
  locationText: string
  status: string
  maxPlayers: number | null
  registrationsCount: number
  organizerContact: string | null
  format: string | null
  timeControl: string | null
  importantNote: string | null
  registrationOpen: boolean
  myRegistration: { status: string; checkedIn: boolean; player_name?: string | null; show_telegram_username?: boolean; arrival_status?: string } | null
}

type Me = {
  user: {
    defaultPlayerName: string | null
    username: string | null
    firstName: string | null
  }
}

export function TournamentScreen() {
  const { id } = useParams()
  const tournamentId = useMemo(() => id ?? '', [id])
  const [playerName, setPlayerName] = useState('')
  const [showTelegramUsername, setShowTelegramUsername] = useState(false)
  const me = useQuery({
    queryKey: ['me'],
    queryFn: () => api<Me>('/api/me'),
    retry: false,
  })

  const q = useQuery({
    queryKey: ['tournament', tournamentId],
    enabled: Boolean(tournamentId),
    queryFn: () => api<{ tournament: Tournament }>(`/api/tournaments/${tournamentId}`),
  })

  const register = useMutation({
    mutationFn: () =>
      api(`/api/tournaments/${tournamentId}/register`, {
        method: 'POST',
        body: JSON.stringify({ playerName: playerName.trim() || suggestedPlayerName, showTelegramUsername }),
      }),
    onSuccess: () => q.refetch(),
  })

  const suggestedPlayerName =
    me.data?.user.defaultPlayerName?.trim() ||
    me.data?.user.firstName?.trim() ||
    (me.data?.user.username ? me.data.user.username.replace(/^@/, '') : '')
  const cancelRegistration = useMutation({
    mutationFn: () => api(`/api/tournaments/${tournamentId}/cancel-registration`, { method: 'POST', body: JSON.stringify({}) }),
    onSuccess: () => q.refetch(),
  })
  const markLate = useMutation({
    mutationFn: () => api(`/api/tournaments/${tournamentId}/mark-late`, { method: 'POST', body: JSON.stringify({}) }),
    onSuccess: () => q.refetch(),
  })
  const participants = useQuery({
    queryKey: ['participants', tournamentId],
    enabled: Boolean(tournamentId),
    queryFn: () => api<{ participants: Array<{ playerName: string; username: string | null }> }>(`/api/tournaments/${tournamentId}/participants`),
  })
  const liveStandings = useQuery({
    queryKey: ['live-standings', tournamentId],
    enabled: Boolean(tournamentId) && q.data?.tournament.status !== 'draft',
    queryFn: () =>
      api<{
        roundsPlayed: number
        standings: Array<{
          place: number
          playerName: string
          points: number
          symbols: string
          roundResults: Array<{ roundNumber: number; symbol: string; result: string | null; opponentName: string | null; color: string | null; points: number }>
        }>
      }>(`/api/tournaments/${tournamentId}/standings`),
  })

  const myGame = useQuery({
    queryKey: ['my-current-game', tournamentId],
    enabled: Boolean(tournamentId),
    queryFn: () =>
      api<{ game: null | { roundNumber: number; tableNumber: number; color: 'white' | 'black' | null; opponent: { username: string | null; displayName: string } | null; result: string | null; isBye: boolean } }>(
        `/api/tournaments/${tournamentId}/my-current-game`,
      ),
    retry: false,
  })

  const copyStandings = () => {
    if (!q.data || !liveStandings.data) return
    const lines = liveStandings.data.standings.map((s) => `${s.place}. ${s.playerName} — ${s.points} оч.`)
    const text = `Итоги турнира: ${q.data.tournament.title}\n${lines.join('\n')}`
    navigator.clipboard?.writeText(text).catch(() => {})
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <BackButton />
      </div>
      {q.isLoading ? <div className="text-sm">Загружаю…</div> : null}
      {q.isError ? <div className="text-sm text-red-700">Ошибка: {(q.error as Error).message}</div> : null}
      {q.data ? (
        <>
          <StickerCard title={q.data.tournament.title} right={<span className="text-xs font-black">{statusLabel(q.data.tournament.status)}</span>}>
            <div className="space-y-2 text-sm">
              <div><span className="opacity-70">Дата и время:</span> <span className="font-bold">{new Date(q.data.tournament.startsAt).toLocaleString()}</span></div>
              <div><span className="opacity-70">Локация:</span> {q.data.tournament.locationText}</div>
              {q.data.tournament.organizerContact ? <div><span className="opacity-70">Организатор:</span> {q.data.tournament.organizerContact}</div> : null}
              {q.data.tournament.format ? <div><span className="opacity-70">Формат:</span> {q.data.tournament.format}</div> : null}
              {q.data.tournament.timeControl ? <div><span className="opacity-70">Контроль:</span> {q.data.tournament.timeControl}</div> : null}
              {q.data.tournament.description ? <div className="opacity-90">{q.data.tournament.description}</div> : null}
              {q.data.tournament.importantNote ? <div className="rounded-xl border border-white/15 bg-[#0f172a] p-2">Важно: {q.data.tournament.importantNote}</div> : null}
              <div><span className="opacity-70">Лимит участников:</span> {q.data.tournament.maxPlayers ?? 'без лимита'}</div>
              <div><span className="opacity-70">Зарегистрировано:</span> {q.data.tournament.registrationsCount}</div>
              {q.data.tournament.organizerContact ? <div className="text-xs opacity-80">По вопросам регистрации, опозданий и места проведения — писать организатору.</div> : null}
            </div>
          </StickerCard>

          <StickerCard title="Моя партия">
            {myGame.isLoading ? <div className="text-sm opacity-80">Загружаю…</div> : null}
            {myGame.isError ? <div className="text-sm opacity-80">Активной партии пока нет</div> : null}
            {myGame.data?.game ? (
              myGame.data.game.isBye ? (
                <div className="space-y-2 text-sm">
                  <div>У тебя bye в этом туре</div>
                  <div className="font-bold">Ты получаешь 1 очко</div>
                </div>
              ) : (
                <div className="space-y-2 text-sm">
                  <div>Тур №{myGame.data.game.roundNumber}</div>
                  <div>Стол №{myGame.data.game.tableNumber}</div>
                  <div>
                    Соперник:{' '}
                    {myGame.data.game.opponent ? myGame.data.game.opponent.displayName : '—'}
                  </div>
                  <div>Цвет: {myGame.data.game.color === 'white' ? 'белые' : 'чёрные'}</div>
                  <div>Результат: {myGame.data.game.result ?? 'ожидается'}</div>
                </div>
              )
            ) : (
              <div className="text-sm opacity-80">Активной партии пока нет</div>
            )}
          </StickerCard>

          <StickerCard title="Регистрация">
            {q.data.tournament.myRegistration ? (
              <div className="space-y-3">
                <div className="text-sm font-bold">Ты в списке</div>
                <div className="text-sm opacity-80">Ты в списке! Приходи за 15 минут до начала.</div>
                {q.data.tournament.status !== 'finished' ? (
                  <Button variant="black" onClick={() => markLate.mutate()} disabled={markLate.isPending || q.data.tournament.myRegistration?.arrival_status === 'late'}>
                    {q.data.tournament.myRegistration?.arrival_status === 'late' ? 'Отмечено: опаздываю' : 'Я опаздываю'}
                  </Button>
                ) : null}
                {q.data.tournament.status === 'registration_open' ? (
                  <Button variant="danger" onClick={() => cancelRegistration.mutate()} disabled={cancelRegistration.isPending}>
                    Отменить регистрацию
                  </Button>
                ) : null}
                {markLate.isSuccess ? <div className="text-xs opacity-80">Организатор увидит, что ты опаздываешь.</div> : null}
                {cancelRegistration.isSuccess ? <div className="text-xs opacity-80">Регистрация отменена</div> : null}
              </div>
            ) : (
              <div className="space-y-3">
                <input
                  className="w-full rounded-xl border border-white/20 bg-[#0f172a] px-3 py-2 text-sm"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder={suggestedPlayerName || 'Например: kven, макс из кухни, Ферзь из Купчино'}
                />
                <label className="flex items-center gap-2 text-xs opacity-80">
                  <input type="checkbox" checked={showTelegramUsername} onChange={(e) => setShowTelegramUsername(e.target.checked)} />
                  Показывать мой Telegram username другим участникам
                </label>
                <div className="text-sm opacity-80">
                  {q.data.tournament.registrationOpen
                    ? 'Регистрация открыта.'
                    : q.data.tournament.status === 'registration_closed'
                      ? 'Регистрация закрыта'
                      : q.data.tournament.status === 'running'
                        ? 'Турнир уже идёт'
                        : q.data.tournament.status === 'finished'
                          ? 'Турнир завершён'
                          : 'Регистрация пока недоступна'}
                </div>
                <Button
                  variant={q.data.tournament.registrationOpen ? 'black' : 'danger'}
                  disabled={!q.data.tournament.registrationOpen || register.isPending || !(playerName.trim() || suggestedPlayerName)}
                  onClick={() => register.mutate()}
                >
                  {register.isPending
                    ? 'Регистрирую…'
                    : q.data.tournament.registrationOpen
                      ? 'Зарегистрироваться'
                      : 'Нельзя зарегистрироваться'}
                </Button>
                {register.isSuccess ? (
                  <div className="text-sm font-black">Ты в списке! Приходи за 15 минут до начала.</div>
                ) : null}
                {register.isError ? (
                  <div className="text-sm text-red-700">Ошибка: {(register.error as Error).message}</div>
                ) : null}
              </div>
            )}
          </StickerCard>

          <StickerCard title={`Участники: ${participants.data?.participants.length ?? 0} / ${q.data.tournament.maxPlayers ?? '∞'}`}>
            {participants.isLoading ? <div className="text-sm">Загружаю…</div> : null}
            {participants.data ? (
              <div className="space-y-2">
                {participants.data.participants.map((p, i) => (
                  <div key={`${p.playerName}-${i}`} className="rounded-xl border border-white/15 px-3 py-2 text-sm">
                    <div>{p.playerName}</div>
                    {p.username ? <div className="text-xs opacity-70">@{p.username}</div> : null}
                  </div>
                ))}
              </div>
            ) : null}
          </StickerCard>

          <StickerCard title={q.data.tournament.status === 'finished' ? 'Итоговая таблица' : `Таблица после ${liveStandings.data?.roundsPlayed ?? 0} тура`}>
            {liveStandings.isLoading ? <div className="text-sm">Загружаю…</div> : null}
            {liveStandings.isError ? <div className="text-sm text-red-700">Ошибка: {(liveStandings.error as Error).message}</div> : null}
            {liveStandings.data ? (
              <div className="space-y-2">
                {liveStandings.data.standings.map((s) => (
                  <details key={`${s.place}-${s.playerName}`} className="rounded-xl border border-white/15 px-3 py-2 text-sm">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
                      <span>{s.place}. {s.playerName}</span>
                      <span className="font-bold">{s.points} · {s.symbols || '—'}</span>
                    </summary>
                    <div className="mt-2 space-y-1 text-xs opacity-80">
                      {s.roundResults.map((r) => (
                        <div key={r.roundNumber}>
                          Тур {r.roundNumber}: {r.symbol} · {r.color === 'white' ? 'белые' : r.color === 'black' ? 'чёрные' : '—'} · {r.opponentName ?? '—'} · {r.result ?? 'ожидается'}
                        </div>
                      ))}
                    </div>
                  </details>
                ))}
                <div className="space-y-2">
                  <Button variant="yellow" onClick={copyStandings}>Скопировать таблицу</Button>
                </div>
              </div>
            ) : null}
          </StickerCard>
        </>
      ) : null}
    </div>
  )
}

