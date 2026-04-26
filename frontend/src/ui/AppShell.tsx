import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { api } from '../lib/api'
import { isDevMode } from '../lib/devMode'
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
    if (!devMode) return
    localStorage.setItem('cheessy_dev_identity', devIdentity)
    // re-login immediately on switch
    devLogin.mutate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devIdentity])

  const showBottomNav = !location.pathname.startsWith('/admin')
  const isAdmin = (me.data as any)?.user?.role === 'admin'

  return (
    <div className="min-h-dvh bg-chess">
      <div className="mx-auto max-w-md min-h-dvh bg-white border-x-4 border-black">
        <header className="px-4 pt-4">
          <Link to="/tournaments" className="block sticker sticker-yellow px-4 py-3">
            <div className="text-left">
              <div className="text-xs font-black uppercase tracking-wider">CHEESSY SPB</div>
              <div className="text-lg font-black">Турниры по шахматам офлайн</div>
            </div>
          </Link>
          {devMode ? (
            <div className="mt-3 sticker px-4 py-2">
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
            </div>
          ) : null}

          {isAdmin ? (
            <div className="mt-3 flex justify-end">
              <Link
                to="/admin"
                className="rounded-xl border-4 border-black bg-black px-4 py-2 text-xs font-black uppercase tracking-wide text-white"
              >
                Админка
              </Link>
            </div>
          ) : null}
        </header>

        <main className={['px-4 pb-28', showBottomNav ? 'pt-4' : 'pt-4 pb-6'].join(' ')}>
          <Outlet />
        </main>

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

