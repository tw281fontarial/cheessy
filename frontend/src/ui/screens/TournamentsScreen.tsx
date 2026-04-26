import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { env } from '../../lib/env'
import { StickerCard } from '../components/StickerCard'

type TournamentListItem = {
  id: string
  title: string
  startsAt: string
  locationText: string
  status: string
}

export function TournamentsScreen() {
  const q = useQuery({
    queryKey: ['tournaments'],
    queryFn: () => api<{ tournaments: TournamentListItem[] }>('/api/tournaments'),
  })

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
              q.data.tournaments.map((t) => (
                <Link
                  key={t.id}
                  to={`/tournaments/${t.id}`}
                  className="block rounded-2xl border border-white/15 bg-[#0f172a] p-3 hover:border-[#ffe600]/70"
                >
                  <div className="text-base font-bold">{t.title}</div>
                  <div className="text-xs font-bold opacity-80">{new Date(t.startsAt).toLocaleString()}</div>
                  <div className="text-xs opacity-80">{t.locationText}</div>
                  <div className="mt-2 inline-block rounded-full border border-white/20 px-2 py-1 text-[11px] font-bold uppercase">
                    {t.status}
                  </div>
                </Link>
              ))
            )}
          </div>
        ) : null}
      </StickerCard>
    </div>
  )
}

