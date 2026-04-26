import { useMutation, useQuery } from '@tanstack/react-query'
import { api, setAuthToken } from '../../lib/api'
import { getParticipantDisplay } from '../../lib/display'
import { isDevMode } from '../../lib/devMode'
import { getTelegramWebApp } from '../../lib/telegram'
import { StickerCard } from '../components/StickerCard'
import { Button } from '../components/Button'

type Me = {
  user: {
    id: string
    telegramId: number
    username: string | null
    firstName: string | null
    lastName: string | null
    role: 'user' | 'admin'
  }
  registrations: Array<{
    tournamentId: string
    tournamentTitle: string
    startsAt: string
    status: string
    checkedIn: boolean
  }>
}

export function ProfileScreen() {
  const devMode = isDevMode()

  const me = useQuery({
    queryKey: ['me'],
    queryFn: () => api<Me>('/api/me'),
    retry: false,
  })

  const login = useMutation({
    mutationFn: async () => {
      const wa = getTelegramWebApp()
      const initData = wa?.initData ?? ''
      const tgUser = wa?.initDataUnsafe && (wa.initDataUnsafe as any).user
      const data = await api<any>('/api/auth/telegram', {
        method: 'POST',
        body: JSON.stringify({
          initData,
          user: tgUser
            ? {
                id: tgUser.id,
                username: tgUser.username ?? null,
                first_name: tgUser.first_name ?? null,
                last_name: tgUser.last_name ?? null,
                photo_url: tgUser.photo_url ?? null,
              }
            : null,
        }),
      })
      if (data?.token) setAuthToken(data.token)
      return data
    },
    onSuccess: () => me.refetch(),
  })

  return (
    <div className="space-y-4">
      <StickerCard title="Профиль">
        {me.isLoading ? <div className="text-sm">Загружаю…</div> : null}
        {me.isError ? (
          <div className="space-y-3">
            <div className="text-sm opacity-80">
              {devMode
                ? 'DEV MODE: автологин выполняется в фоне. Если не получилось — проверь backend env и seed.'
                : 'Похоже, ты не залогинен через Telegram Mini App. Нажми кнопку ниже.'}
            </div>
            {!devMode ? (
              <Button onClick={() => login.mutate()} disabled={login.isPending}>
                Войти через Telegram
              </Button>
            ) : null}
            <div className="text-xs opacity-60">Нужен запуск внутри Telegram для корректного initData.</div>
          </div>
        ) : null}
        {me.data ? (
          <div className="space-y-2 text-sm">
            {(() => {
              const disp = getParticipantDisplay({
                username: me.data.user.username,
                firstName: me.data.user.firstName,
                lastName: me.data.user.lastName,
              })
              return (
                <>
                  <div className="font-black">{disp.primary}</div>
                  {disp.secondary ? <div className="opacity-80">{disp.secondary}</div> : null}
                </>
              )
            })()}
            <div className="inline-block rounded-full border-2 border-black px-2 py-1 text-[11px] font-black uppercase">
              role: {me.data.user.role}
            </div>
            <div className="text-xs opacity-70">telegram id: {me.data.user.telegramId}</div>
            {me.data.user.role === 'admin' ? (
              <div className="pt-2">
                <a className="font-black underline" href="/admin">
                  Перейти в админку
                </a>
              </div>
            ) : null}
          </div>
        ) : null}
      </StickerCard>

      <StickerCard title="Мои регистрации">
        {me.data ? (
          <div className="space-y-2">
            {me.data.registrations.length === 0 ? (
              <div className="text-sm opacity-80">Нет активных регистраций.</div>
            ) : (
              me.data.registrations.map((r) => (
                <div key={r.tournamentId} className="rounded-2xl border-4 border-black p-3">
                  <div className="text-sm font-black">{r.tournamentTitle}</div>
                  <div className="text-xs opacity-80">{new Date(r.startsAt).toLocaleString()}</div>
                  <div className="mt-2 text-xs font-bold">
                    {r.status} {r.checkedIn ? '· пришёл' : ''}
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="text-sm opacity-80">Войди, чтобы увидеть регистрации.</div>
        )}
      </StickerCard>
    </div>
  )
}

