import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { api, setAuthToken } from '../lib/api'
import { canUseDevPanelForUser, isDevMode, isInsideTelegramWebApp } from '../lib/devMode'
import { getTelegramWebApp, waitForTelegramWebApp } from '../lib/telegram'

function TabLink(props: { to: string; label: string }) {
  return (
    <NavLink
      to={props.to}
      className={({ isActive }) =>
        [
          'flex-1 text-center px-3 py-2 rounded-xl border border-black/20 font-bold tracking-wide text-sm',
          isActive ? 'bg-[var(--tg-theme-button-color,#2AABEE)] text-[var(--tg-theme-button-text-color,#fff)] border-transparent' : 'bg-[var(--tg-theme-secondary-bg-color,#1c1c1e)] text-[var(--tg-theme-text-color,#fff)] border-white/10',
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
  const [telegramSdkResolved, setTelegramSdkResolved] = useState(false)

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
    onSuccess: (data) => {
      localStorage.setItem('cheessy_auth_request_status', 'success')
      localStorage.removeItem('cheessy_auth_error')
      if (data?.token) setAuthToken(data.token)
      me.refetch()
    },
    onError: (e) => {
      localStorage.setItem('cheessy_auth_request_status', 'error')
      localStorage.setItem('cheessy_auth_error', (e as Error).message)
    },
  })

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const wa = await waitForTelegramWebApp()
      if (cancelled) return
      wa?.ready?.()
      wa?.expand?.()
      setTelegramSdkResolved(true)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!devMode) return
    if (me.isSuccess) return
    if (devLogin.isPending || devLogin.isSuccess) return
    // If /api/me failed, silently dev-login for local browser testing
    if (me.isError) devLogin.mutate()
  }, [devMode, me.isError, me.isSuccess, devLogin.isPending, devLogin.isSuccess])

  useEffect(() => {
    if (devMode) return
    if (me.isSuccess) return
    if (telegramLogin.isPending || telegramLogin.isSuccess) return
    if (!telegramSdkResolved) return

    let cancelled = false
    ;(async () => {
      const wa = await waitForTelegramWebApp()
      if (cancelled) return
      if (!wa || !isInsideTelegramWebApp()) return

      const initData = wa.initData ?? ''
      const unsafeUser = wa.initDataUnsafe && (wa.initDataUnsafe as any).user
      if (!initData) {
        localStorage.setItem('cheessy_auth_request_status', 'error')
        localStorage.setItem('cheessy_auth_error', 'Missing Telegram initData')
        return
      }
      if (!unsafeUser?.id) {
        localStorage.setItem('cheessy_auth_request_status', 'error')
        localStorage.setItem('cheessy_auth_error', 'Missing Telegram user in initDataUnsafe')
        return
      }

      localStorage.setItem('cheessy_auth_request_status', 'loading')
      localStorage.removeItem('cheessy_auth_error')
      telegramLogin.mutate()
    })()

    return () => {
      cancelled = true
    }
  }, [devMode, me.isSuccess, telegramLogin.isPending, telegramLogin.isSuccess, telegramSdkResolved])

  useEffect(() => {
    if (!devMode) return
    localStorage.setItem('cheessy_dev_identity', devIdentity)
    // re-login immediately on switch
    devLogin.mutate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devIdentity])

  const showBottomNav = !location.pathname.startsWith('/admin')
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
    <div className="min-h-dvh bg-app">
      <div className="mx-auto max-w-md min-h-dvh border-x border-white/10 bg-[var(--tg-theme-bg-color,#0f0f0f)]">
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
                        'rounded-lg border border-white/20 px-2 py-1 text-[11px] font-bold uppercase',
                        devIdentity === 'player' ? 'bg-[var(--tg-theme-button-color,#2AABEE)] text-[var(--tg-theme-button-text-color,#fff)]' : 'bg-[var(--tg-theme-secondary-bg-color,#1c1c1e)]',
                      ].join(' ')}
                      onClick={() => setDevIdentity('player')}
                      type="button"
                    >
                      player
                    </button>
                    <button
                      className={[
                        'rounded-lg border border-white/20 px-2 py-1 text-[11px] font-bold uppercase',
                        devIdentity === 'admin' ? 'bg-[var(--tg-theme-button-color,#2AABEE)] text-[var(--tg-theme-button-text-color,#fff)]' : 'bg-[var(--tg-theme-secondary-bg-color,#1c1c1e)]',
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

        </header>

        <main className={['px-4 pb-28', showBottomNav ? 'pt-3' : 'pt-3 pb-6'].join(' ')}>
          <Outlet />
        </main>

        {showInlineOnboarding ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="w-full max-w-sm sticker p-4">
              <div className="text-base font-black">Привет! Это Cheessy</div>
              <div className="mt-2 text-sm whitespace-pre-line">
                {'Турниры — смотри турниры и регистрируйся.\nПрофиль — смотри информацию о себе и свои регистрации.\nМерч — здесь позже можно будет купить мерч клуба.'}
              </div>
              <button
                type="button"
                className="mt-4 w-full rounded-xl border border-white/20 bg-[var(--tg-theme-button-color,#2AABEE)] px-4 py-2 text-sm font-bold"
                onClick={() => setShowInlineOnboarding(false)}
              >
                Погнали
              </button>
            </div>
          </div>
        ) : null}

        {showBottomNav ? (
          <nav className="fixed bottom-0 left-0 right-0">
            <div className="mx-auto max-w-md border-t border-white/10 bg-[var(--tg-theme-bg-color,#0f0f0f)] px-3 py-2">
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

