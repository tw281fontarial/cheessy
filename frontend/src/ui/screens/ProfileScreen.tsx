import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { getParticipantDisplay } from '../../lib/display'
import { isDevMode, isInsideTelegramWebApp } from '../../lib/devMode'
import { env } from '../../lib/env'
import { getTelegramDebugInfo } from '../../lib/telegram'
import { StickerCard } from '../components/StickerCard'

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
  const insideTelegram = isInsideTelegramWebApp()
  const tgDebug = getTelegramDebugInfo()
  const authRequestStatus = localStorage.getItem('cheessy_auth_request_status') ?? 'idle'
  const authError = localStorage.getItem('cheessy_auth_error')

  const me = useQuery({
    queryKey: ['me'],
    queryFn: () => api<Me>('/api/me'),
    retry: false,
  })

  return (
    <div className="space-y-4">
      <StickerCard title="Профиль">
        {me.isLoading ? <div className="text-sm">Загружаю…</div> : null}
        {me.isError ? (
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
              <div>authError: {authError ?? (me.error as Error).message}</div>
              <div>apiBaseUrl: {env.apiBaseUrl ?? 'missing'}</div>
              <div>currentUrl: {tgDebug.currentUrl}</div>
              <div>userAgent: {tgDebug.userAgent}</div>
            </div>
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
            <div className="inline-block rounded-full border border-white/15 bg-[#0f172a] px-2 py-1 text-[11px] font-bold uppercase text-white">
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
                <div key={r.tournamentId} className="rounded-2xl border border-white/15 bg-[#0f172a] p-3 text-white">
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

