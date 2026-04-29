import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { api } from '../../../lib/api'
import { arrivalStatusLabel, getParticipantDisplay, registrationStatusLabel, sourceLabel, statusLabel } from '../../../lib/display'
import { uploadTournamentPoster } from '../../../lib/uploadTournamentPoster'
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
  tablesCount: number | null
  organizerContact?: string | null
  posterUrl?: string | null
}

type MeResponse = {
  user: {
    role: 'user' | 'admin'
  }
}

type RegistrationRow = {
  id: string
  status: string
  checkedIn: boolean
  source: string
  playerName: string | null
  showTelegramUsername: boolean
  arrivalStatus: string
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
  assigned_table_number: number | null
  queue_order: number | null
  status: 'waiting' | 'playing' | 'completed'
  white_user_id: string | null
  black_user_id: string | null
  result: string | null
  white: { id: string; username: string | null; first_name: string | null; last_name: string | null } | null
  black: { id: string; username: string | null; first_name: string | null; last_name: string | null } | null
}

export function AdminTournamentManageScreen() {
  const { id } = useParams()
  const tournamentId = useMemo(() => id ?? '', [id])
  const me = useQuery({ queryKey: ['me'], queryFn: () => api<MeResponse>('/api/me'), retry: false })

  const t = useQuery({
    queryKey: ['admin', 'tournament', tournamentId],
    enabled: Boolean(tournamentId) && me.data?.user?.role === 'admin',
    queryFn: () => api<{ tournament: Tournament }>(`/api/admin/tournaments/${tournamentId}`),
  })

  const regs = useQuery({
    queryKey: ['admin', 'registrations', tournamentId],
    enabled: Boolean(tournamentId) && me.data?.user?.role === 'admin',
    queryFn: () => api<{ registrations: RegistrationRow[] }>(`/api/admin/tournaments/${tournamentId}/registrations`),
  })

  const rounds = useQuery({
    queryKey: ['admin', 'rounds', tournamentId],
    enabled: Boolean(tournamentId) && me.data?.user?.role === 'admin',
    queryFn: () => api<{ rounds: Array<{ id: string; roundNumber: number; status: string }> }>(`/api/admin/tournaments/${tournamentId}/rounds`),
  })

  const games = useQuery({
    queryKey: ['admin', 'games', tournamentId],
    enabled: Boolean(tournamentId) && me.data?.user?.role === 'admin',
    queryFn: () => api<{ games: GameRow[] }>(`/api/admin/tournaments/${tournamentId}/games`),
  })

  const standings = useQuery({
    queryKey: ['admin', 'standings', tournamentId],
    enabled: Boolean(tournamentId) && me.data?.user?.role === 'admin',
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
  const noShow = useMutation({
    mutationFn: (registrationId: string) => api(`/api/admin/registrations/${registrationId}/no-show`, { method: 'PATCH', body: JSON.stringify({}) }),
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
  const startPreview = useQuery({
    queryKey: ['admin', 'start-preview', tournamentId],
    enabled: Boolean(tournamentId) && me.data?.user?.role === 'admin',
    queryFn: () => api<{ registered: number; checkedIn: number; late: number; notCheckedIn: number }>(`/api/admin/tournaments/${tournamentId}/start-preview`),
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

  const [telegramUsername, setTelegramUsername] = useState('')
  const addTelegramParticipant = useMutation({
    mutationFn: () =>
      api(`/api/admin/tournaments/${tournamentId}/add-telegram-participant`, {
        method: 'POST',
        body: JSON.stringify({ username: telegramUsername }),
      }),
    onSuccess: () => {
      regs.refetch()
      setTelegramUsername('')
    },
  })

  const [offlineNickname, setOfflineNickname] = useState('@guest')
  const [offlineFullName, setOfflineFullName] = useState('')
  const [posterUrlDraft, setPosterUrlDraft] = useState('')
  const [posterUploadError, setPosterUploadError] = useState<string | null>(null)
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

  const updatePoster = useMutation({
    mutationFn: () =>
      api(`/api/admin/tournaments/${tournamentId}`, {
        method: 'PATCH',
        body: JSON.stringify({ posterUrl: posterUrlDraft.trim() || null }),
      }),
    onSuccess: () => {
      t.refetch()
    },
  })

  const uploadPoster = useMutation({
    mutationFn: async (file: File) => {
      setPosterUploadError(null)
      const { publicUrl } = await uploadTournamentPoster(file, tournamentId)
      return publicUrl
    },
    onSuccess: (url) => {
      setPosterUrlDraft(url)
    },
    onError: (e) => {
      setPosterUploadError((e as Error).message)
    },
  })

  const totalRegs = regs.data?.registrations.length ?? 0
  const checkedInCount = regs.data?.registrations.filter((r) => r.checkedIn && r.status === 'registered').length ?? 0
  const tournamentStatus = t.data?.tournament?.status

  if (me.isLoading) return <div className="text-sm">Загружаю…</div>
  if (me.isError) return <div className="text-sm text-red-700">Ошибка: {(me.error as Error).message}</div>
  if (me.data?.user?.role !== 'admin') {
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
            {t.data.tournament.posterUrl ? (
              <img src={t.data.tournament.posterUrl} alt={t.data.tournament.title} className="h-40 w-full rounded-xl object-cover" />
            ) : null}
            <div className="text-base font-black">{t.data.tournament.title}</div>
            <div className="opacity-80">{new Date(t.data.tournament.startsAt).toLocaleString()}</div>
            <div className="opacity-80">{t.data.tournament.locationText}</div>
            {t.data.tournament.organizerContact ? <div className="opacity-80">Организатор: {t.data.tournament.organizerContact}</div> : null}
            <div className="inline-block rounded-full border border-white/20 px-2 py-1 text-[11px] font-black">
              {statusLabel(t.data.tournament.status)}
            </div>
            <div className="text-xs font-bold opacity-80">
              Количество регистраций: {totalRegs} · Пришли: {checkedInCount} · Столов: {t.data.tournament.tablesCount ?? 'без ограничения'}
            </div>
            <div className="pt-2">
              <Link to={`/admin/tournaments/${tournamentId}/display`} className="inline-block rounded-xl border border-white/20 bg-[#0f172a] px-3 py-2 text-xs font-bold">
                Экран организатора
              </Link>
            </div>
            <div className="pt-3">
              <div className="text-xs font-bold opacity-80">Афиша турнира (poster_url)</div>
              <div className="mt-2 flex gap-2">
                <input
                  type="url"
                  className="w-full rounded-xl border border-white/20 bg-[#0f172a] px-3 py-2 text-sm"
                  value={posterUrlDraft}
                  onChange={(e) => setPosterUrlDraft(e.target.value)}
                  placeholder={t.data.tournament.posterUrl ?? 'https://...'}
                />
                <button
                  type="button"
                  className="rounded-xl border border-white/20 bg-black px-3 py-2 text-xs font-bold"
                  onClick={() => updatePoster.mutate()}
                  disabled={updatePoster.isPending}
                >
                  Сохранить
                </button>
              </div>
              <div className="mt-2 flex items-start gap-2">
                <label className="shrink-0 inline-block rounded-xl border border-white/20 bg-[#0f172a] px-3 py-2 text-xs font-bold text-white">
                  {uploadPoster.isPending ? 'Загрузка…' : 'Загрузить новую афишу'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploadPoster.isPending}
                    onChange={(e) => {
                      const f = e.currentTarget.files?.[0]
                      e.currentTarget.value = ''
                      if (!f) return
                      uploadPoster.mutate(f)
                    }}
                  />
                </label>
                <div className="text-xs opacity-70">Можно вставить ссылку вручную или загрузить изображение из галереи.</div>
              </div>
              {posterUploadError ? <div className="mt-2 text-xs text-red-700">{posterUploadError}</div> : null}
              {updatePoster.isError ? <div className="mt-2 text-xs text-red-700">Ошибка: {(updatePoster.error as Error).message}</div> : null}
            </div>
          </div>
        ) : null}

        {tournamentStatus !== 'finished' ? (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button variant="yellow" onClick={() => openReg.mutate()} disabled={openReg.isPending || tournamentStatus === 'running'}>
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
                onClick={() => {
                  const p = startPreview.data
                  const msg = p
                    ? `В турнир попадут:\n- ${p.checkedIn} участников\n- ${p.late} опаздывают\n- ${p.notCheckedIn} не отмечены как пришедшие\n- столов в заведении: ${t.data?.tournament.tablesCount ?? 'без ограничения'}\n\nНачать турнир?`
                    : 'Начать турнир? Регистрация будет закрыта.'
                  if (!confirm(msg)) return
                  startTournament.mutate()
                }}
                disabled={startTournament.isPending || checkedInCount === 0}
              >
                {startTournament.isPending ? 'Стартую…' : 'Начать турнир'}
              </Button>
              {checkedInCount === 0 ? <div className="mt-2 text-xs opacity-80">Нельзя начать турнир без отмеченных участников.</div> : null}
              {(startPreview.data?.late ?? 0) > 0 ? (
                <div className="mt-2 text-xs opacity-80">Есть участники со статусом «Опаздывает». Они не попадут в первый тур, если не отмечены как пришедшие.</div>
              ) : null}
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
            const waitingCount = currentGames.filter((g) => g.status === 'waiting').length
            const running = t.data?.tournament?.status === 'running'

            return (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-black">Тур №{currentRoundNumber || '—'}</div>
	                  {running && currentRoundNumber ? (
	                    <div className="text-xs font-bold opacity-80">
	                      {waitingCount > 0 ? `очередь: ${waitingCount}` : allDone ? 'все результаты введены' : 'ожидаем результаты'}
	                    </div>
	                  ) : null}
                </div>

                {currentRoundNumber === 0 ? (
                  <div className="text-sm opacity-80">Туров ещё нет. Нажми “Начать турнир”.</div>
                ) : (
                  <div className="space-y-3">
                    {currentGames.map((g) => (
                      <div key={g.id} className="rounded-2xl border border-white/20 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
	                            <div className="text-xs font-black uppercase">
	                              {g.status === 'waiting' ? `очередь #${g.table_number}` : `стол #${g.assigned_table_number ?? g.table_number}`}
	                            </div>
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
	                            <div className="mt-1 text-xs font-bold opacity-80">
	                              Результат: {g.result ?? (g.status === 'waiting' ? 'ждёт свободный стол' : 'ожидается')}
	                            </div>
	                          </div>
	                        </div>

	                        {g.result === 'bye' || g.black_user_id === null || tournamentStatus === 'finished' || g.status === 'waiting' ? null : (
                          <div className="mt-3 grid grid-cols-3 gap-2">
                            <button
                              className="relative z-10 rounded-xl border-4 border-black bg-[#ffe600] px-2 py-2 text-xs font-black"
                              onClick={() => {
                                if (g.result !== null && !confirm('Изменить результат? Таблица очков пересчитается.')) return
                                setResult.mutate({ gameId: g.id, result: '1-0' })
                              }}
                              disabled={setResult.isPending || tournamentStatus !== 'running'}
                              type="button"
                            >
                              1-0
                            </button>
                            <button
                              className="relative z-10 rounded-xl border-4 border-black bg-white px-2 py-2 text-xs font-black"
                              onClick={() => {
                                if (g.result !== null && !confirm('Изменить результат? Таблица очков пересчитается.')) return
                                setResult.mutate({ gameId: g.id, result: '0.5-0.5' })
                              }}
                              disabled={setResult.isPending || tournamentStatus !== 'running'}
                              type="button"
                            >
                              ½-½
                            </button>
                            <button
                              className="relative z-10 rounded-xl border-4 border-black bg-[#ff2d2d] px-2 py-2 text-xs font-black text-white"
                              onClick={() => {
                                if (g.result !== null && !confirm('Изменить результат? Таблица очков пересчитается.')) return
                                setResult.mutate({ gameId: g.id, result: '0-1' })
                              }}
                              disabled={setResult.isPending || tournamentStatus !== 'running'}
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
                        <Button
                          variant="black"
                          onClick={() => {
                            if (!confirm('Создать следующий тур? Проверь, что все результаты внесены.')) return
                            generateNextRound.mutate()
                          }}
                          disabled={generateNextRound.isPending || !allDone}
                        >
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
              <div key={s.userId} className="flex items-center justify-between rounded-2xl border border-white/20 px-3 py-2">
                <div className="text-sm font-black">
                  {s.place}. {s.name}
                </div>
                <div className="text-sm font-black">{s.points}</div>
              </div>
            ))}
          </div>
        ) : null}
      </StickerCard>

      <StickerCard title="Опасные действия">
        <Button
          variant="danger"
          onClick={() => {
            if (!confirm('Завершить турнир? После этого турнир станет завершённым.')) return
            finishTournament.mutate()
          }}
          disabled={finishTournament.isPending || t.data?.tournament?.status !== 'running'}
        >
          {finishTournament.isPending ? 'Завершаю…' : 'Завершить турнир'}
        </Button>
        {finishTournament.isError ? <div className="mt-2 text-sm text-red-700">Ошибка: {(finishTournament.error as Error).message}</div> : null}
      </StickerCard>

      <StickerCard title="Участники">
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
          <Button variant="yellow" onClick={() => addOffline.mutate()} disabled={addOffline.isPending || tournamentStatus === 'finished'}>
            {addOffline.isPending ? 'Добавляю…' : 'Добавить офлайн-участника'}
          </Button>
          {addOffline.isError ? <div className="text-sm text-red-700">Ошибка: {(addOffline.error as Error).message}</div> : null}

          <div className="h-px bg-white/10" />
          <div className="text-xs font-bold opacity-70">Добавить Telegram-участника</div>
          <input
            className="rounded-xl border border-white/20 bg-[#0f172a] px-3 py-2 text-sm"
            value={telegramUsername}
            onChange={(e) => setTelegramUsername(e.target.value)}
            placeholder="@username"
          />
          <Button
            variant="black"
            onClick={() => addTelegramParticipant.mutate()}
            disabled={addTelegramParticipant.isPending || !telegramUsername.trim() || tournamentStatus === 'finished'}
          >
            {addTelegramParticipant.isPending ? 'Добавляю…' : 'Добавить Telegram-участника'}
          </Button>
          {addTelegramParticipant.isError ? (
            <div className="text-sm text-red-700">Ошибка: {(addTelegramParticipant.error as Error).message}</div>
          ) : null}
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
                playerName: r.playerName,
                username: r.user.username,
                firstName: r.user.firstName,
                lastName: r.user.lastName,
              })
              return (
                <div key={r.id} className="rounded-2xl border border-white/20 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-black">{disp.primary}</div>
                      {disp.secondary ? <div className="text-xs opacity-70">{disp.secondary}</div> : null}
                      {r.user.username ? <div className="text-xs opacity-70">@{r.user.username}</div> : null}
                      <div className="text-xs opacity-70">
                        {registrationStatusLabel(r.status)} · {sourceLabel(r.source)}
                      </div>
                      {r.arrivalStatus === 'late' ? <div className="text-xs text-yellow-300">{arrivalStatusLabel(r.arrivalStatus)}</div> : null}
                    </div>
                    <div
                      className={[
                        'rounded-full border-2 border-black px-2 py-1 text-[11px] font-black uppercase',
                        r.checkedIn ? 'bg-[#ffe600]' : 'bg-white',
                      ].join(' ')}
                    >
                      {r.checkedIn ? 'Пришёл' : 'Не отмечен'}
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button
                      variant="yellow"
                      onClick={() => checkIn.mutate(r.id)}
                      disabled={checkIn.isPending || r.checkedIn || tournamentStatus === 'finished' || r.status !== 'registered'}
                    >
                      Пришёл
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => uncheck.mutate(r.id)}
                      disabled={uncheck.isPending || !r.checkedIn || tournamentStatus === 'finished' || r.status !== 'registered'}
                    >
                      Снять
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => noShow.mutate(r.id)}
                      disabled={noShow.isPending || tournamentStatus === 'finished' || r.status !== 'registered'}
                      className="col-span-2"
                    >
                      Не пришёл
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
