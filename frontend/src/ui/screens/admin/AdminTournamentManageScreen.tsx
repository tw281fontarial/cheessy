import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { api } from '../../../lib/api'
import { getParticipantDisplay } from '../../../lib/display'
import { StickerCard } from '../../components/StickerCard'
import { Button } from '../../components/Button'
import { BackButton } from '../../components/BackButton'

type Tournament = {
  id: string
  title: string
  description: string | null
  locationText: string
  startsAt: string
  status: string
  maxPlayers: number | null
}

type RegistrationRow = {
  id: string
  status: string
  checkedIn: boolean
  source: string
  user: {
    id: string
    telegramId: number
    username: string | null
    firstName: string | null
    lastName: string | null
  }
}

type GameRow = {
  id: string
  roundNumber: number
  round_id: string
  table_number: number
  white_user_id: string | null
  black_user_id: string | null
  result: string | null
  white: { id: string; username: string | null; first_name: string | null; last_name: string | null } | null
  black: { id: string; username: string | null; first_name: string | null; last_name: string | null } | null
}

export function AdminTournamentManageScreen() {
  const { id } = useParams()
  const tournamentId = useMemo(() => id ?? '', [id])
  const me = useQuery({ queryKey: ['me'], queryFn: () => api<any>('/api/me'), retry: false })

  const t = useQuery({
    queryKey: ['admin', 'tournament', tournamentId],
    enabled: Boolean(tournamentId) && (me.data as any)?.user?.role === 'admin',
    queryFn: () => api<{ tournament: Tournament }>(`/api/admin/tournaments/${tournamentId}`),
  })

  const regs = useQuery({
    queryKey: ['admin', 'registrations', tournamentId],
    enabled: Boolean(tournamentId) && (me.data as any)?.user?.role === 'admin',
    queryFn: () => api<{ registrations: RegistrationRow[] }>(`/api/admin/tournaments/${tournamentId}/registrations`),
  })

  const rounds = useQuery({
    queryKey: ['admin', 'rounds', tournamentId],
    enabled: Boolean(tournamentId) && (me.data as any)?.user?.role === 'admin',
    queryFn: () => api<{ rounds: Array<{ id: string; roundNumber: number; status: string }> }>(`/api/admin/tournaments/${tournamentId}/rounds`),
  })

  const games = useQuery({
    queryKey: ['admin', 'games', tournamentId],
    enabled: Boolean(tournamentId) && (me.data as any)?.user?.role === 'admin',
    queryFn: () => api<{ games: GameRow[] }>(`/api/admin/tournaments/${tournamentId}/games`),
  })

  const standings = useQuery({
    queryKey: ['admin', 'standings', tournamentId],
    enabled: Boolean(tournamentId) && (me.data as any)?.user?.role === 'admin',
    queryFn: () => api<{ standings: Array<{ place: number; userId: string; name: string; points: number }> }>(`/api/admin/tournaments/${tournamentId}/standings`),
  })

  const openReg = useMutation({
    mutationFn: () => api(`/api/admin/tournaments/${tournamentId}/registration/open`, { method: 'POST', body: JSON.stringify({}) }),
    onSuccess: () => t.refetch(),
  })
  const closeReg = useMutation({
    mutationFn: () => api(`/api/admin/tournaments/${tournamentId}/registration/close`, { method: 'POST', body: JSON.stringify({}) }),
    onSuccess: () => t.refetch(),
  })

  const checkIn = useMutation({
    mutationFn: (registrationId: string) => api(`/api/admin/registrations/${registrationId}/check-in`, { method: 'PATCH', body: JSON.stringify({}) }),
    onSuccess: () => regs.refetch(),
  })
  const uncheck = useMutation({
    mutationFn: (registrationId: string) => api(`/api/admin/registrations/${registrationId}/uncheck`, { method: 'PATCH', body: JSON.stringify({}) }),
    onSuccess: () => regs.refetch(),
  })

  const notify15 = useMutation({
    mutationFn: () => api(`/api/admin/tournaments/${tournamentId}/notify/15min`, { method: 'POST', body: JSON.stringify({}) }),
  })

  const startTournament = useMutation({
    mutationFn: () => api(`/api/admin/tournaments/${tournamentId}/start`, { method: 'POST', body: JSON.stringify({}) }),
    onSuccess: () => {
      t.refetch()
      rounds.refetch()
      games.refetch()
      standings.refetch()
    },
  })

  const generateNextRound = useMutation({
    mutationFn: () => api(`/api/admin/tournaments/${tournamentId}/rounds/generate`, { method: 'POST', body: JSON.stringify({}) }),
    onSuccess: () => {
      rounds.refetch()
      games.refetch()
      standings.refetch()
    },
  })

  const finishTournament = useMutation({
    mutationFn: () => api(`/api/admin/tournaments/${tournamentId}/finish`, { method: 'POST', body: JSON.stringify({}) }),
    onSuccess: () => t.refetch(),
  })

  const [offlineNickname, setOfflineNickname] = useState('@guest')
  const [offlineFullName, setOfflineFullName] = useState('')
  const addOffline = useMutation({
    mutationFn: () =>
      api(`/api/admin/tournaments/${tournamentId}/offline-participant`, {
        method: 'POST',
        body: JSON.stringify({ nickname: offlineNickname, fullName: offlineFullName || null }),
      }),
    onSuccess: () => regs.refetch(),
  })

  const setResult = useMutation({
    mutationFn: (args: { gameId: string; result: '1-0' | '0-1' | '0.5-0.5' }) =>
      {
        console.log('setting game result', args.gameId, args.result)
        return api(`/api/admin/games/${args.gameId}/result`, { method: 'PATCH', body: JSON.stringify({ result: args.result }) })
      },
    onSuccess: () => {
      games.refetch()
      rounds.refetch()
      standings.refetch()
    },
    onError: (e) => {
      console.error('set game result failed', e)
    },
  })

  const totalRegs = regs.data?.registrations.length ?? 0
  const checkedInCount = regs.data?.registrations.filter((r) => r.checkedIn && r.status === 'registered').length ?? 0
  const tournamentStatus = (t.data as any)?.tournament?.status as string | undefined

  if (me.isLoading) return <div className="text-sm">Загружаю…</div>
  if (me.isError) return <div className="text-sm text-red-700">Ошибка: {(me.error as Error).message}</div>
  if ((me.data as any)?.user?.role !== 'admin') {
    return (
      <StickerCard title="Управление турниром">
        <div className="text-sm text-red-700 font-bold">Forbidden</div>
      </StickerCard>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <BackButton label="← Назад" fallbackTo="/tournaments" />
        <Link
          to="/tournaments"
          className="rounded-xl border border-white/20 bg-[#0f172a] px-3 py-2 text-xs font-bold text-white"
        >
          ← В приложение
        </Link>
      </div>
      <StickerCard
        title="Турнир"
        right={
          <BackButton label="← К админке" fallbackTo="/tournaments" />
        }
      >
        {t.isLoading ? <div className="text-sm">Загружаю…</div> : null}
        {t.isError ? <div className="text-sm text-red-700">Ошибка: {(t.error as Error).message}</div> : null}
        {t.data ? (
          <div className="space-y-2 text-sm">
            <div className="text-base font-black">{t.data.tournament.title}</div>
            <div className="opacity-80">{new Date(t.data.tournament.startsAt).toLocaleString()}</div>
            <div className="opacity-80">{t.data.tournament.locationText}</div>
            <div className="inline-block rounded-full border-2 border-black px-2 py-1 text-[11px] font-black uppercase">
              {t.data.tournament.status}
            </div>
            <div className="text-xs font-bold opacity-80">
              регистраций: {totalRegs} · пришли: {checkedInCount}
            </div>
          </div>
        ) : null}

        {tournamentStatus !== 'finished' ? (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button
              variant="yellow"
              onClick={() => openReg.mutate()}
              disabled={openReg.isPending || tournamentStatus === 'running'}
            >
              Открыть рег.
            </Button>
            <Button
              variant="danger"
              onClick={() => closeReg.mutate()}
              disabled={closeReg.isPending || tournamentStatus === 'running'}
            >
              Закрыть рег.
            </Button>
          </div>
        ) : null}

        <div className="mt-3">
          {tournamentStatus === 'registration_open' ? (
            <>
              <Button
                variant="black"
                onClick={() => startTournament.mutate()}
                disabled={startTournament.isPending || checkedInCount === 0}
              >
                {startTournament.isPending ? 'Стартую…' : 'Начать турнир'}
              </Button>
              {checkedInCount === 0 ? <div className="mt-2 text-xs opacity-80">Нужен минимум 1 отмеченный “пришёл”.</div> : null}
              {startTournament.isError ? (
                <div className="mt-2 text-sm text-red-700">Ошибка: {(startTournament.error as Error).message}</div>
              ) : null}
            </>
          ) : null}
        </div>

        <div className="mt-3">
          <Button onClick={() => notify15.mutate()} disabled={notify15.isPending}>
            {notify15.isPending ? 'Отправляю…' : 'Турнир через 15 минут'}
          </Button>
          {notify15.isSuccess ? <div className="mt-2 text-sm font-black">Отправлено</div> : null}
          {notify15.isError ? <div className="mt-2 text-sm text-red-700">Ошибка: {(notify15.error as Error).message}</div> : null}
        </div>
      </StickerCard>

      <StickerCard title="Текущий тур">
        {rounds.isLoading || games.isLoading ? <div className="text-sm">Загружаю…</div> : null}
        {rounds.isError ? <div className="text-sm text-red-700">Не удалось загрузить туры</div> : null}
        {games.isError ? <div className="text-sm text-red-700">Не удалось загрузить партии</div> : null}

        {rounds.data && games.data ? (
          (() => {
            const currentRound = rounds.data.rounds[0]
            const currentRoundNumber = currentRound?.roundNumber ?? 0
            const currentGames = games.data.games.filter((g) => g.roundNumber === currentRoundNumber).sort((a, b) => a.table_number - b.table_number)
            const allDone = currentGames.every((g) => g.result !== null)
            const running = (t.data as any)?.tournament?.status === 'running'

            return (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-black">Тур №{currentRoundNumber || '—'}</div>
                  {running && currentRoundNumber ? (
                    <div className="text-xs font-bold opacity-80">{allDone ? 'все результаты введены' : 'ожидаем результаты'}</div>
                  ) : null}
                </div>

                {currentRoundNumber === 0 ? (
                  <div className="text-sm opacity-80">Туров ещё нет. Нажми “Начать турнир”.</div>
                ) : (
                  <div className="space-y-3">
                    {currentGames.map((g) => (
                      <div key={g.id} className="rounded-2xl border-4 border-black p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-xs font-black uppercase">стол #{g.table_number}</div>
                            {g.result === 'bye' || g.black_user_id === null ? (
                              <>
                                <div className="text-sm font-black">
                                  {(() => {
                                    const d = getParticipantDisplay({
                                      username: g.white?.username ?? null,
                                      firstName: g.white?.first_name ?? null,
                                      lastName: g.white?.last_name ?? null,
                                    })
                                    return d.primary
                                  })()}{' '}
                                  — BYE +1
                                </div>
                                <div className="text-xs opacity-80">Игрок без пары, получает 1 очко</div>
                              </>
                            ) : (
                              <div className="text-sm">
                                <span className="font-black">
                                  ⚪{' '}
                                  {(() => {
                                    const d = getParticipantDisplay({
                                      username: g.white?.username ?? null,
                                      firstName: g.white?.first_name ?? null,
                                      lastName: g.white?.last_name ?? null,
                                    })
                                    return d.primary
                                  })()}
                                </span>
                                <span className="opacity-70"> vs </span>
                                <span className="font-black">
                                  ⚫{' '}
                                  {(() => {
                                    const d = getParticipantDisplay({
                                      username: g.black?.username ?? null,
                                      firstName: g.black?.first_name ?? null,
                                      lastName: g.black?.last_name ?? null,
                                    })
                                    return d.primary
                                  })()}
                                </span>
                              </div>
                            )}
                            <div className="mt-1 text-xs font-bold opacity-80">result: {g.result ?? '—'}</div>
                          </div>
                        </div>

                        {g.result === 'bye' || g.black_user_id === null || tournamentStatus === 'finished' ? null : (
                          <div className="mt-3 grid grid-cols-3 gap-2">
                            <button
                              className="relative z-10 rounded-xl border-4 border-black bg-[#ffe600] px-2 py-2 text-xs font-black"
                              onClick={() => setResult.mutate({ gameId: g.id, result: '1-0' })}
                              disabled={setResult.isPending || tournamentStatus !== 'running' || g.result !== null}
                              type="button"
                            >
                              1-0
                            </button>
                            <button
                              className="relative z-10 rounded-xl border-4 border-black bg-white px-2 py-2 text-xs font-black"
                              onClick={() => setResult.mutate({ gameId: g.id, result: '0.5-0.5' })}
                              disabled={setResult.isPending || tournamentStatus !== 'running' || g.result !== null}
                              type="button"
                            >
                              ½-½
                            </button>
                            <button
                              className="relative z-10 rounded-xl border-4 border-black bg-[#ff2d2d] px-2 py-2 text-xs font-black text-white"
                              onClick={() => setResult.mutate({ gameId: g.id, result: '0-1' })}
                              disabled={setResult.isPending || tournamentStatus !== 'running' || g.result !== null}
                              type="button"
                            >
                              0-1
                            </button>
                          </div>
                        )}
                      </div>
                    ))}

                    {setResult.isPending ? <div className="text-sm font-black">Сохраняю результат…</div> : null}
                    {setResult.isError ? <div className="text-sm text-red-700">Не удалось сохранить результат партии</div> : null}

                    {running && allDone ? (
                      <div className="space-y-2">
                        <Button variant="black" onClick={() => generateNextRound.mutate()} disabled={generateNextRound.isPending}>
                          {generateNextRound.isPending ? 'Генерирую…' : 'Создать следующий тур'}
                        </Button>
                        {generateNextRound.isError ? (
                          <div className="text-sm text-red-700">Ошибка: {(generateNextRound.error as Error).message}</div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            )
          })()
        ) : null}
      </StickerCard>

      <StickerCard title="Очки (standings)">
        {standings.isLoading ? <div className="text-sm">Загружаю…</div> : null}
        {standings.isError ? <div className="text-sm text-red-700">Не удалось загрузить таблицу очков</div> : null}
        {standings.data ? (
          <div className="space-y-2">
            {standings.data.standings.map((s) => (
              <div key={s.userId} className="flex items-center justify-between rounded-2xl border-4 border-black px-3 py-2">
                <div className="text-sm font-black">
                  {s.place}. {s.name}
                </div>
                <div className="text-sm font-black">{s.points}</div>
              </div>
            ))}
          </div>
        ) : null}
      </StickerCard>

      <StickerCard title="Завершение">
        <Button
          variant="danger"
          onClick={() => finishTournament.mutate()}
          disabled={finishTournament.isPending || (t.data as any)?.tournament?.status !== 'running'}
        >
          {finishTournament.isPending ? 'Завершаю…' : 'Завершить турнир'}
        </Button>
        {finishTournament.isError ? <div className="mt-2 text-sm text-red-700">Ошибка: {(finishTournament.error as Error).message}</div> : null}
      </StickerCard>

      <StickerCard title="Офлайн-участник">
        <div className="space-y-3">
          <div className="space-y-2">
            <input
              className="rounded-xl border-4 border-black px-3 py-2 text-sm"
              value={offlineNickname}
              onChange={(e) => setOfflineNickname(e.target.value)}
              placeholder="Никнейм / отображаемое имя *"
            />
            <input
              className="rounded-xl border-4 border-black px-3 py-2 text-sm"
              value={offlineFullName}
              onChange={(e) => setOfflineFullName(e.target.value)}
              placeholder="Имя и фамилия (опционально)"
            />
          </div>
          <Button variant="yellow" onClick={() => addOffline.mutate()} disabled={addOffline.isPending}>
            {addOffline.isPending ? 'Добавляю…' : 'Добавить'}
          </Button>
          {addOffline.isError ? <div className="text-sm text-red-700">Ошибка: {(addOffline.error as Error).message}</div> : null}
        </div>
      </StickerCard>

      <StickerCard title="Регистрации">
        {regs.isLoading ? <div className="text-sm">Загружаю…</div> : null}
        {regs.isError ? <div className="text-sm text-red-700">Ошибка: {(regs.error as Error).message}</div> : null}
        {regs.data ? (
          <div className="space-y-3">
            {regs.data.registrations.length === 0 ? <div className="text-sm opacity-80">Пока пусто.</div> : null}
            {regs.data.registrations.map((r) => {
              const disp = getParticipantDisplay({
                username: r.user.username,
                firstName: r.user.firstName,
                lastName: r.user.lastName,
              })
              return (
                <div key={r.id} className="rounded-2xl border-4 border-black p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-black">{disp.primary}</div>
                      {disp.secondary ? <div className="text-xs opacity-70">{disp.secondary}</div> : null}
                      <div className="text-xs opacity-70">
                        {r.status} · {r.source}
                      </div>
                    </div>
                    <div
                      className={[
                        'rounded-full border-2 border-black px-2 py-1 text-[11px] font-black uppercase',
                        r.checkedIn ? 'bg-[#ffe600]' : 'bg-white',
                      ].join(' ')}
                    >
                      {r.checkedIn ? 'checked-in' : 'not yet'}
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button
                      variant="yellow"
                      onClick={() => checkIn.mutate(r.id)}
                      disabled={checkIn.isPending || r.checkedIn}
                    >
                      Пришёл
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => uncheck.mutate(r.id)}
                      disabled={uncheck.isPending || !r.checkedIn}
                    >
                      Снять
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : null}
      </StickerCard>
    </div>
  )
}

