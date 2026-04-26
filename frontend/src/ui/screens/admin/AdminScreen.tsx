import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../../../lib/api'
import { statusLabel } from '../../../lib/display'
import { StickerCard } from '../../components/StickerCard'
import { BackButton } from '../../components/BackButton'

type AdminTournamentListItem = {
  id: string
  title: string
  startsAt: string
  locationText: string
  maxPlayers: number | null
  organizerContact?: string | null
  format?: string | null
  timeControl?: string | null
  importantNote?: string | null
  description?: string | null
  status: string
  registrationsCount: number
  posterUrl?: string | null
}

export function AdminScreen() {
  const me = useQuery({ queryKey: ['me'], queryFn: () => api<any>('/api/me'), retry: false })

  const tournaments = useQuery({
    queryKey: ['admin', 'tournaments'],
    queryFn: () => api<{ tournaments: AdminTournamentListItem[] }>('/api/admin/tournaments'),
    enabled: (me.data as any)?.user?.role === 'admin',
  })

  if (me.isLoading) return <div className="text-sm">Загружаю…</div>
  if (me.isError) return <div className="text-sm text-red-700">Ошибка: {(me.error as Error).message}</div>
  if ((me.data as any)?.user?.role !== 'admin') {
    return (
      <StickerCard title="Админка">
        <div className="text-sm text-red-700 font-bold">Forbidden</div>
      </StickerCard>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-start">
        <BackButton label="← В приложение" fallbackTo="/tournaments" />
      </div>
      <StickerCard
        title="Турниры (админ)"
        right={
          <Link
            to="/admin/tournaments/new"
            className="rounded-xl border border-black/20 bg-[#ffe600] px-3 py-2 text-xs font-bold uppercase"
          >
            + Создать
          </Link>
        }
      >
        {tournaments.isLoading ? <div className="text-sm">Загружаю…</div> : null}
        {tournaments.isError ? (
          <div className="text-sm text-red-700">Ошибка: {(tournaments.error as Error).message}</div>
        ) : null}
        {tournaments.data ? (
          <div className="space-y-3">
            {tournaments.data.tournaments.map((t) => (
              <div key={t.id} className="rounded-2xl border border-white/15 bg-[#0f172a] p-3 text-white">
                {t.posterUrl ? <img src={t.posterUrl} alt={t.title} className="mb-2 h-24 w-full rounded-xl object-cover" /> : null}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold">{t.title}</div>
                    <div className="text-xs opacity-80">{new Date(t.startsAt).toLocaleString()}</div>
                  </div>
                  <div className="text-right">
                    <div className="inline-block rounded-full border border-white/20 px-2 py-1 text-[11px] font-bold">
                      {statusLabel(t.status)}
                    </div>
                    <div className="mt-2 text-xs font-bold opacity-80">{t.registrationsCount} регистраций</div>
                  </div>
                </div>
                <div className="mt-3">
                  <Link
                    to={`/admin/tournaments/${t.id}`}
                    className="inline-block rounded-xl border border-white/20 bg-black px-4 py-2 text-xs font-bold uppercase text-white"
                  >
                    Управлять
                  </Link>
                  <Link
                    to={`/admin/tournaments/new?title=${encodeURIComponent(`${t.title} копия`)}&description=${encodeURIComponent(t.description ?? '')}&locationText=${encodeURIComponent(t.locationText ?? '')}&organizerContact=${encodeURIComponent(t.organizerContact ?? '')}&maxPlayers=${encodeURIComponent(String(t.maxPlayers ?? ''))}&format=${encodeURIComponent(t.format ?? '')}&timeControl=${encodeURIComponent(t.timeControl ?? '')}&importantNote=${encodeURIComponent(t.importantNote ?? '')}&posterUrl=${encodeURIComponent(t.posterUrl ?? '')}`}
                    className="ml-2 inline-block rounded-xl border border-white/20 bg-[#1f2937] px-4 py-2 text-xs font-bold uppercase text-white"
                  >
                    Создать копию
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </StickerCard>
    </div>
  )
}
