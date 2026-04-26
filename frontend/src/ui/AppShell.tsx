import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { api, setAuthToken } from '../lib/api'
import { canUseDevPanelForUser, isDevMode, isInsideTelegramWebApp } from '../lib/devMode'
import { getTelegramWebApp } from '../lib/telegram'

function TabLink(props: { to: string; label: string }) {
  return (
    <NavLink
      to={props.to}
      className={({ isActive }) =>
        [
          'flex-1 text-center px-3 py-2 rounded-xl border-4 border-black font-black uppercase tracking-wide',
          isActive ? 'bg-[#ffe600]' : 'bg-white',
        ].join(' ')
      }
    >
      {props.label}
    </NavLink>
  )
}

export function AppShell() {
  const location = useLocation()
  const [showInlineOnboarding, setShowInlineOnboarding] = useState(false)

  const devMode = isDevMode()
  const [devIdentity, setDevIdentity] = useState<'player' | 'admin'>(() => {
    const saved = localStorage.getItem('cheessy_dev_identity')
    return saved === 'admin' ? 'admin' : 'player'
  })

  const devPayload = useMemo(() => {
    return devIdentity === 'admin'
      ? { telegramId: 999000001, username: 'test_admin', firstName: 'Test' }
      : { telegramId: 999000101, username: 'test_player_1', firstName: 'Иван' }
  }, [devIdentity])

  const me = useQuery({
    queryKey: ['me'],
    queryFn: () => api('/api/me'),
    retry: false,
    enabled: true,
  })

  const devLogin = useMutation({
    mutationFn: () =>
      api('/api/auth/dev-login', {
        method: 'POST',
        body: JSON.stringify(devPayload),
      }),
    onSuccess: () => me.refetch(),
  })

  const telegramLogin = useMutation({
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

  useEffect(() => {
    const wa = getTelegramWebApp()
    wa?.ready?.()
    wa?.expand?.()
  }, [])

  useEffect(() => {
    if (!devMode) return
    if (me.isSuccess) return
    if (devLogin.isPending || devLogin.isSuccess) return
    // If /api/me failed, silently dev-login for local browser testing
    if (me.isError) devLogin.mutate()
  }, [devMode, me.isError, me.isSuccess, devLogin.isPending, devLogin.isSuccess])

  useEffect(() => {
    // production/telegram first-launch flow
    if (devMode) return
    if (!isInsideTelegramWebApp()) return
    if (me.isSuccess) return
    if (telegramLogin.isPending || telegramLogin.isSuccess) return
    if (me.isError) telegramLogin.mutate()
  }, [devMode, me.isError, me.isSuccess, telegramLogin.isPending, telegramLogin.isSuccess])

  useEffect(() => {
    if (!devMode) return
    localStorage.setItem('cheessy_dev_identity', devIdentity)
    // re-login immediately on switch
    devLogin.mutate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devIdentity])

  const showBottomNav = !location.pathname.startsWith('/admin')
  const isAdmin = (me.data as any)?.user?.role === 'admin'
  const currentUsername = ((me.data as any)?.user?.username as string | null | undefined) ?? null
  const canShowDevPanel = canUseDevPanelForUser(currentUsername)

  useEffect(() => {
    if (!isInsideTelegramWebApp()) return
    if (!me.data) return

    const telegramId = (me.data as any)?.user?.telegramId
    const key = `cheessy_onboarding_seen_${telegramId ?? 'guest'}`
    if (localStorage.getItem(key) === '1') return

    const wa = getTelegramWebApp()
    const message =
      'Привет! Это Cheessy — мини-приложение для шахматных турниров.\n\n' +
      'Турниры — смотри турниры и регистрируйся.\n' +
      'Профиль — смотри информацию о себе и свои регистрации.\n' +
      'Мерч — здесь позже можно будет купить мерч клуба.'

    localStorage.setItem(key, '1')

    if (wa?.showPopup) {
      wa.showPopup({
        title: 'Cheessy',
        message,
        buttons: [{ id: 'go', type: 'default', text: 'Погнали' }],
      })
      return
    }

    if (wa?.showAlert) {
      wa.showAlert(message)
      return
    }

    setShowInlineOnboarding(true)
  }, [me.data])

  return (
    <div className="min-h-dvh bg-chess">
      <div className="mx-auto max-w-md min-h-dvh bg-white border-x-4 border-black">
        <header className="px-4 pt-4">
          {canShowDevPanel ? (
            <div className="sticker px-4 py-2">
              {devMode ? (
                <div className="flex items-center justify-between gap-2">
                  <div className="text-left text-xs font-black uppercase tracking-wider">
                    DEV MODE: {devIdentity === 'admin' ? 'test_admin' : 'test_player_1'}
                  </div>
                  <div className="flex gap-2">
                    <button
                      className={[
                        'rounded-lg border-2 border-black px-2 py-1 text-[11px] font-black uppercase',
                        devIdentity === 'player' ? 'bg-[#ffe600]' : 'bg-white',
                      ].join(' ')}
                      onClick={() => setDevIdentity('player')}
                      type="button"
                    >
                      player
                    </button>
                    <button
                      className={[
                        'rounded-lg border-2 border-black px-2 py-1 text-[11px] font-black uppercase',
                        devIdentity === 'admin' ? 'bg-[#ffe600]' : 'bg-white',
                      ].join(' ')}
                      onClick={() => setDevIdentity('admin')}
                      type="button"
                    >
                      admin
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-left text-xs font-black uppercase tracking-wider">DEV TOOLS ENABLED</div>
              )}
            </div>
          ) : null}

          {isAdmin ? (
            <div className="mt-3 flex justify-end">
              <a
                href="/admin"
                className="rounded-xl border-4 border-black bg-black px-4 py-2 text-xs font-black uppercase tracking-wide text-white"
              >
                Админка
              </a>
            </div>
          ) : null}
        </header>

        <main className={['px-4 pb-28', showBottomNav ? 'pt-3' : 'pt-3 pb-6'].join(' ')}>
          <Outlet />
        </main>

        {showInlineOnboarding ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="w-full max-w-sm sticker bg-white p-4">
              <div className="text-base font-black">Привет! Это Cheessy</div>
              <div className="mt-2 text-sm whitespace-pre-line">
                {'Турниры — смотри турниры и регистрируйся.\nПрофиль — смотри информацию о себе и свои регистрации.\nМерч — здесь позже можно будет купить мерч клуба.'}
              </div>
              <button
                type="button"
                className="mt-4 w-full rounded-xl border-4 border-black bg-[#ffe600] px-4 py-2 text-sm font-black uppercase"
                onClick={() => setShowInlineOnboarding(false)}
              >
                Погнали
              </button>
            </div>
          </div>
        ) : null}

        {showBottomNav ? (
          <nav className="fixed bottom-0 left-0 right-0">
            <div className="mx-auto max-w-md border-t-4 border-black bg-white px-3 py-3">
              <div className="flex gap-2">
                <TabLink to="/tournaments" label="Турниры" />
                <TabLink to="/profile" label="Профиль" />
                <TabLink to="/merch" label="Мерч" />
              </div>
            </div>
          </nav>
        ) : null}
      </div>
    </div>
  )
}

