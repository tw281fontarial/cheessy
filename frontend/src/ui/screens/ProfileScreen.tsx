import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { getParticipantDisplay } from '../../lib/display'
import { isDevMode, isInsideTelegramWebApp } from '../../lib/devMode'
import { env } from '../../lib/env'
import { getTelegramDebugInfo } from '../../lib/telegram'
import { Button } from '../components/Button'
import { StickerCard } from '../components/StickerCard'

type ProfileSummary = {
  user: {
    id: string
    telegramId: number
    username: string | null
    firstName: string | null
    lastName: string | null
    role: 'user' | 'admin'
    defaultPlayerName: string | null
  }
  upcomingTournaments: Array<{
    tournamentId: string
    title: string
    startsAt: string
    locationText: string
    tournamentStatus: 'registration_open' | 'registration_closed' | 'running' | string
    status: 'in_list' | 'late' | 'checked_in' | 'running' | string
    playerName: string | null
  }>
  currentGames: Array<{
    tournamentId: string
    tournamentTitle: string
    roundNumber: number
    tableNumber: number
    opponent: string | null
    color: 'white' | 'black' | null
    result: '1-0' | '0-1' | '0.5-0.5' | 'bye' | null
    isBye: boolean
  }>
  history: Array<{
    tournamentId: string
    title: string
    startsAt: string
    place: number | null
    points: number
    playerName: string | null
  }>
  stats: {
    tournamentsPlayed: number
    gamesPlayed: number
    wins: number
    draws: number
    losses: number
    byes: number
    totalPoints: number
    avgPointsPerTournament: number
  }
}

export function ProfileScreen() {
  const devMode = isDevMode()
  const insideTelegram = isInsideTelegramWebApp()
  const tgDebug = getTelegramDebugInfo()
  const authRequestStatus = localStorage.getItem('cheessy_auth_request_status') ?? 'idle'
  const authError = localStorage.getItem('cheessy_auth_error')
  const queryClient = useQueryClient()

  const profile = useQuery({
    queryKey: ['profile-summary'],
    queryFn: () => api<ProfileSummary>('/api/me/profile-summary'),
    retry: false,
  })
  const [nicknameDraft, setNicknameDraft] = useState('')
  useEffect(() => {
    if (!profile.data) return
    setNicknameDraft(profile.data.user.defaultPlayerName ?? '')
  }, [profile.data?.user.defaultPlayerName])

  const saveDefaultNickname = useMutation({
    mutationFn: (value: string) =>
      api('/api/me/profile', {
        method: 'PATCH',
        body: JSON.stringify({ defaultPlayerName: value.trim() || null }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['profile-summary'] })
      await queryClient.invalidateQueries({ queryKey: ['me'] })
    },
  })

  const registrationStatusText = (status: string) => {
    switch (status) {
      case 'late':
        return 'Опаздываешь'
      case 'checked_in':
        return 'Отмечен как пришёл'
      case 'running':
        return 'Турнир идёт'
      default:
        return 'Ты в списке'
    }
  }

  const resultLabel = (result: string | null) => {
    if (!result) return 'ожидается'
    if (result === '0.5-0.5') return '1/2-1/2'
    return result
  }

  return (
    <div className="space-y-4">
      <StickerCard title="Профиль">
        {profile.isLoading ? <div className="text-sm">Загружаю…</div> : null}
        {profile.isError ? (
          <div className="space-y-3">
            {insideTelegram && tgDebug.initDataLength > 0 ? (
              <>
                <div className="text-sm font-black">Не удалось авторизоваться через Telegram</div>
                <div className="text-sm opacity-80">
                  Приложение открыто внутри Telegram, но Telegram initData не прошёл проверку. Попробуй закрыть Mini App и открыть заново через кнопку бота.
                </div>
              </>
            ) : (
              <>
                <div className="text-sm opacity-80">
                  {devMode
                    ? 'DEV MODE: автологин выполняется в фоне. Если не получилось — проверь backend env и seed.'
                    : 'Не удалось получить данные Telegram. Закрой Mini App и открой его через кнопку "Открыть Cheessy" в боте.'}
                </div>
              </>
            )}

            <div className="rounded-xl border border-white/15 bg-[#0f172a] p-3 text-xs text-white">
              <div>telegramScriptLoaded: {tgDebug.telegramScriptLoaded ? 'true' : 'false'}</div>
              <div>hasTelegramObject: {tgDebug.hasTelegramObject ? 'true' : 'false'}</div>
              <div>hasWebApp: {tgDebug.hasWebApp ? 'true' : 'false'}</div>
              <div>initDataLength: {tgDebug.initDataLength}</div>
              <div>initDataPreview: {tgDebug.initDataPreview || '—'}</div>
              <div>hasUnsafeUser: {tgDebug.hasUnsafeUser ? 'true' : 'false'}</div>
              <div>unsafeUserId: {tgDebug.unsafeUserId ?? '—'}</div>
              <div>unsafeUsername: {tgDebug.unsafeUsername ?? '—'}</div>
              <div>isLikelyTelegramWebView: {tgDebug.isLikelyTelegramWebView ? 'true' : 'false'}</div>
              <div>authRequestStatus: {authRequestStatus}</div>
              <div>authError: {authError ?? (profile.error as Error).message}</div>
              <div>apiBaseUrl: {env.apiBaseUrl ?? 'missing'}</div>
              <div>currentUrl: {tgDebug.currentUrl}</div>
              <div>userAgent: {tgDebug.userAgent}</div>
            </div>
          </div>
        ) : null}
        {profile.data ? (
          <div className="space-y-2 text-sm">
            {(() => {
              const disp = getParticipantDisplay({
                username: profile.data.user.username,
                firstName: profile.data.user.firstName,
                lastName: profile.data.user.lastName,
              })
              return (
                <>
                  <div className="font-black">{disp.primary}</div>
                  {profile.data.user.username ? <div className="opacity-80">@{profile.data.user.username}</div> : null}
                  {disp.secondary ? <div className="opacity-80">{disp.secondary}</div> : null}
                </>
              )
            })()}
            <div className="inline-block rounded-full border border-white/15 bg-[#0f172a] px-2 py-1 text-[11px] font-bold uppercase text-white">
              {profile.data.user.role === 'admin' ? 'Админ' : 'Участник'}
            </div>
            {profile.data.user.role === 'admin' ? (
              <div className="inline-block rounded-full border border-[#ffe600]/50 bg-[#ffe600] px-2 py-1 text-[11px] font-bold uppercase text-black">
                Админ
              </div>
            ) : null}
            {(devMode || profile.data.user.role === 'admin') && profile.data.user.telegramId ? (
              <div className="text-xs opacity-70">Telegram ID: {profile.data.user.telegramId}</div>
            ) : null}
            {profile.data.user.role === 'admin' ? (
              <div className="pt-2">
                <a className="font-black underline" href="/admin">
                  Открыть админ панель
                </a>
              </div>
            ) : null}
          </div>
        ) : null}
      </StickerCard>

      <StickerCard title="Сейчас играешь">
        {profile.data ? (
          <div className="space-y-2">
            {profile.data.currentGames.length === 0 ? (
              <div className="text-sm opacity-80">Активных партий пока нет.</div>
            ) : (
              profile.data.currentGames.map((g) => (
                <div key={`${g.tournamentId}-${g.roundNumber}-${g.tableNumber}`} className="rounded-2xl border border-white/15 bg-[#0f172a] p-3 text-white">
                  <div className="text-sm font-black">{g.tournamentTitle}</div>
                  {g.isBye ? (
                    <div className="mt-2 space-y-1 text-sm">
                      <div>У тебя bye в этом туре</div>
                      <div className="font-bold">Ты получаешь 1 очко</div>
                    </div>
                  ) : (
                    <div className="mt-2 space-y-1 text-sm">
                      <div>Тур №{g.roundNumber}</div>
                      <div>Стол №{g.tableNumber}</div>
                      <div>Соперник: {g.opponent ?? '—'}</div>
                      <div>Цвет: {g.color === 'white' ? 'белые' : 'чёрные'}</div>
                      <div>Результат: {resultLabel(g.result)}</div>
                    </div>
                  )}
                  <div className="mt-3">
                    <a className="text-xs font-bold underline" href={`/tournaments/${g.tournamentId}`}>
                      Открыть турнир
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="text-sm opacity-80">Войди, чтобы видеть партии.</div>
        )}
      </StickerCard>

      <StickerCard title="Ближайшие турниры">
        {profile.data ? (
          <div className="space-y-2">
            {profile.data.upcomingTournaments.length === 0 ? (
              <div className="text-sm opacity-80">Ты пока не зарегистрирован на ближайшие турниры.</div>
            ) : (
              profile.data.upcomingTournaments.map((t) => (
                <div key={t.tournamentId} className="rounded-2xl border border-white/15 bg-[#0f172a] p-3 text-white">
                  <div className="text-sm font-black">{t.title}</div>
                  <div className="text-xs opacity-80">{new Date(t.startsAt).toLocaleString()}</div>
                  <div className="text-xs opacity-80">{t.locationText || 'Локация уточняется'}</div>
                  <div className="mt-2 text-xs font-bold">{registrationStatusText(t.status)}</div>
                  {t.playerName ? <div className="text-xs opacity-80">Ник: {t.playerName}</div> : null}
                  <div className="mt-3">
                    <a className="text-xs font-bold underline" href={`/tournaments/${t.tournamentId}`}>
                      Открыть турнир
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="text-sm opacity-80">Войди, чтобы увидеть турниры.</div>
        )}
      </StickerCard>

      <StickerCard title="Статистика">
        {profile.data ? (
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-xl border border-white/15 bg-[#0f172a] p-2">Турниров: {profile.data.stats.tournamentsPlayed}</div>
            <div className="rounded-xl border border-white/15 bg-[#0f172a] p-2">Партий: {profile.data.stats.gamesPlayed}</div>
            <div className="rounded-xl border border-white/15 bg-[#0f172a] p-2">Победы: {profile.data.stats.wins}</div>
            <div className="rounded-xl border border-white/15 bg-[#0f172a] p-2">Ничьи: {profile.data.stats.draws}</div>
            <div className="rounded-xl border border-white/15 bg-[#0f172a] p-2">Поражения: {profile.data.stats.losses}</div>
            <div className="rounded-xl border border-white/15 bg-[#0f172a] p-2">Bye: {profile.data.stats.byes}</div>
            <div className="rounded-xl border border-white/15 bg-[#0f172a] p-2">Очков всего: {profile.data.stats.totalPoints}</div>
            <div className="rounded-xl border border-white/15 bg-[#0f172a] p-2">Среднее: {profile.data.stats.avgPointsPerTournament}</div>
          </div>
        ) : (
          <div className="text-sm opacity-80">Войди, чтобы увидеть статистику.</div>
        )}
      </StickerCard>

      <StickerCard title="История турниров">
        {profile.data ? (
          <div className="space-y-2">
            {profile.data.history.length === 0 ? (
              <div className="text-sm opacity-80">Завершённых турниров пока нет.</div>
            ) : (
              profile.data.history.map((h) => (
                <div key={h.tournamentId} className="rounded-2xl border border-white/15 bg-[#0f172a] p-3 text-white">
                  <div className="text-sm font-black">{h.title}</div>
                  <div className="text-xs opacity-80">{new Date(h.startsAt).toLocaleString()}</div>
                  <div className="mt-2 text-xs">Место: {h.place ?? '—'}</div>
                  <div className="text-xs">Очки: {h.points}</div>
                  {h.playerName ? <div className="text-xs opacity-80">Ник: {h.playerName}</div> : null}
                  <div className="mt-3">
                    <a className="text-xs font-bold underline" href={`/tournaments/${h.tournamentId}`}>
                      Открыть итоги
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="text-sm opacity-80">Войди, чтобы увидеть историю.</div>
        )}
      </StickerCard>

      <StickerCard title="Мой ник для турниров">
        {profile.data ? (
          <div className="space-y-3">
            <input
              className="w-full rounded-xl border border-white/20 bg-[#0f172a] px-3 py-2 text-sm"
              value={nicknameDraft}
              onChange={(e) => setNicknameDraft(e.target.value)}
              placeholder="Например: Тед Лассо"
            />
            <Button
              variant="yellow"
              disabled={saveDefaultNickname.isPending}
              onClick={() => saveDefaultNickname.mutate(nicknameDraft)}
            >
              Сохранить
            </Button>
            {saveDefaultNickname.isError ? (
              <div className="text-xs text-red-700">Ошибка: {(saveDefaultNickname.error as Error).message}</div>
            ) : null}
            {saveDefaultNickname.isSuccess ? <div className="text-xs opacity-80">Ник сохранён</div> : null}
          </div>
        ) : (
          <div className="text-sm opacity-80">Войди, чтобы сохранить ник.</div>
        )}
      </StickerCard>
    </div>
  )
}

