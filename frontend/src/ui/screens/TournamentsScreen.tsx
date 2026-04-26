import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { env } from '../../lib/env'
import { statusLabel } from '../../lib/display'
import { StickerCard } from '../components/StickerCard'

type TournamentListItem = {
  id: string
  title: string
  startsAt: string
  locationText: string
  status: string
  posterUrl?: string | null
  format?: string | null
}

export function TournamentsScreen() {
  const q = useQuery({
    queryKey: ['tournaments'],
    queryFn: () => api<{ tournaments: TournamentListItem[] }>('/api/tournaments'),
  })

  const active = (q.data?.tournaments ?? []).filter((t) => t.status !== 'finished')
  const finished = (q.data?.tournaments ?? []).filter((t) => t.status === 'finished')

  return (
    <div className="space-y-4">
      <StickerCard title="Турниры">
        {q.isLoading ? <div className="text-sm">Загружаю…</div> : null}
        {q.isError ? (
          <div className="text-sm text-red-700">
            <div>Не удалось загрузить турниры</div>
            <div className="mt-1 text-xs opacity-80">
              API: {env.apiBaseUrl ?? 'missing'} · {(q.error as Error).message}
            </div>
          </div>
        ) : null}
        {q.data ? (
          <div className="space-y-3">
            {q.data.tournaments.length === 0 ? (
              <div className="text-sm opacity-80">Пока пусто. Админ добавит турнир вручную.</div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {active.map((t) => (
                  <Link
                    key={t.id}
                    to={`/tournaments/${t.id}`}
                    className="overflow-hidden rounded-2xl border border-white/15 bg-[var(--tg-theme-secondary-bg-color,#1c1c1e)] hover:border-[#2AABEE]"
                  >
                    <div className="aspect-[3/4] w-full bg-[#111]">
                      {t.posterUrl ? (
                        <img
                          src={t.posterUrl}
                          alt={t.title}
                          className="h-full w-full object-cover"
                          loading="lazy"
                          onError={(e) => {
                            ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                          }}
                        />
                      ) : (
                        <div className="flex h-full items-end bg-gradient-to-b from-[#2a2a2a] via-[#1d1d1f] to-[#151518] p-3">
                          <div className="line-clamp-3 text-sm font-bold text-white">{t.title}</div>
                        </div>
                      )}
                    </div>
                    <div className="space-y-1 p-2.5">
                      <div className="line-clamp-2 text-xs font-bold">{t.title}</div>
                      <div className="text-[11px] opacity-80">{new Date(t.startsAt).toLocaleDateString()}</div>
                      {t.locationText ? <div className="line-clamp-2 text-[11px] opacity-70">{t.locationText}</div> : null}
                      {!t.locationText && t.format ? <div className="line-clamp-2 text-[11px] opacity-70">{t.format}</div> : null}
                      <div className="inline-block rounded-full border border-white/20 px-2 py-1 text-[10px] font-bold">
                        {statusLabel(t.status)}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
            {finished.length > 0 ? (
              <div className="pt-2">
                <div className="mb-2 text-xs font-bold opacity-70">Прошедшие</div>
                <div className="space-y-2">
                  {finished.map((t) => (
                    <Link
                      key={t.id}
                      to={`/tournaments/${t.id}`}
                      className="block rounded-2xl border border-white/10 bg-[#0f172a]/60 p-3 hover:border-white/25"
                    >
                      <div className="text-sm font-bold">{t.title}</div>
                      <div className="text-xs opacity-70">{new Date(t.startsAt).toLocaleString()}</div>
                      {t.locationText ? <div className="mt-1 text-xs opacity-70">{t.locationText}</div> : null}
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </StickerCard>
    </div>
  )
}

