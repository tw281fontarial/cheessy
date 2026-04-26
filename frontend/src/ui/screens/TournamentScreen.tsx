import { useMemo } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { api } from '../../lib/api'
import { getParticipantDisplay, statusLabel } from '../../lib/display'
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
  registrationOpen: boolean
  myRegistration: { status: string; checkedIn: boolean } | null
}

export function TournamentScreen() {
  const { id } = useParams()
  const tournamentId = useMemo(() => id ?? '', [id])

  const q = useQuery({
    queryKey: ['tournament', tournamentId],
    enabled: Boolean(tournamentId),
    queryFn: () => api<{ tournament: Tournament }>(`/api/tournaments/${tournamentId}`),
  })

  const register = useMutation({
    mutationFn: () => api(`/api/tournaments/${tournamentId}/register`, { method: 'POST', body: JSON.stringify({}) }),
    onSuccess: () => q.refetch(),
  })

  const myGame = useQuery({
    queryKey: ['my-current-game', tournamentId],
    enabled: Boolean(tournamentId),
    queryFn: () =>
      api<{
        game: null | {
          roundNumber: number
          tableNumber: number
          color: 'white' | 'black' | null
          opponent: { username: string | null; firstName: string | null; lastName: string | null; displayName: string } | null
          result: string | null
          isBye: boolean
        }
      }>(`/api/tournaments/${tournamentId}/my-current-game`),
    retry: false,
  })

  const finalStandings = useQuery({
    queryKey: ['final-standings', tournamentId],
    enabled: Boolean(tournamentId) && q.data?.tournament.status === 'finished',
    queryFn: () =>
      api<{ standings: Array<{ place: number; userId: string; name: string; points: number; wins: number; draws: number; losses: number }> }>(
        `/api/tournaments/${tournamentId}/final-standings`,
      ),
  })

  const copyFinal = () => {
    if (!q.data || !finalStandings.data) return
    const lines = finalStandings.data.standings.map((s) => `${s.place}. ${s.name} — ${s.points} очка`)
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
              {q.data.tournament.description ? <div className="opacity-90">{q.data.tournament.description}</div> : null}
              <div><span className="opacity-70">Лимит участников:</span> {q.data.tournament.maxPlayers ?? 'без лимита'}</div>
              <div><span className="opacity-70">Зарегистрировано:</span> {q.data.tournament.registrationsCount}</div>
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
                    {myGame.data.game.opponent
                      ? getParticipantDisplay({
                          username: myGame.data.game.opponent.username,
                          firstName: myGame.data.game.opponent.firstName,
                          lastName: myGame.data.game.opponent.lastName,
                        }).primary
                      : '—'}
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
                <Button variant="yellow" disabled>
                  Уже в списке
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
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
                  disabled={!q.data.tournament.registrationOpen || register.isPending}
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

          {q.data.tournament.status === 'finished' ? (
            <StickerCard title="Итоговая таблица">
              {finalStandings.isLoading ? <div className="text-sm">Загружаю…</div> : null}
              {finalStandings.isError ? <div className="text-sm text-red-700">Ошибка: {(finalStandings.error as Error).message}</div> : null}
              {finalStandings.data ? (
                <div className="space-y-2">
                  {finalStandings.data.standings.map((s) => (
                    <div key={s.userId} className="flex items-center justify-between rounded-xl border border-white/15 px-3 py-2 text-sm">
                      <div>{s.place}. {s.name}</div>
                      <div className="font-bold">{s.points}</div>
                    </div>
                  ))}
                  <Button variant="yellow" onClick={copyFinal}>Скопировать таблицу</Button>
                </div>
              ) : null}
            </StickerCard>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

