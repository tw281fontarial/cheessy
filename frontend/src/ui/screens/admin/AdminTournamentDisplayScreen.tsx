import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { api } from '../../../lib/api'
import { statusLabel } from '../../../lib/display'
import { StickerCard } from '../../components/StickerCard'
import { BackButton } from '../../components/BackButton'

export function AdminTournamentDisplayScreen() {
  const { id } = useParams()
  const tournamentId = useMemo(() => id ?? '', [id])
  const tournament = useQuery({
    queryKey: ['admin', 'display', 'tournament', tournamentId],
    enabled: Boolean(tournamentId),
    queryFn: () => api<any>(`/api/admin/tournaments/${tournamentId}`),
  })
  const games = useQuery({
    queryKey: ['admin', 'display', 'games', tournamentId],
    enabled: Boolean(tournamentId),
    queryFn: () => api<any>(`/api/admin/tournaments/${tournamentId}/games`),
    refetchInterval: 10000,
  })
  const standings = useQuery({
    queryKey: ['admin', 'display', 'standings', tournamentId],
    enabled: Boolean(tournamentId),
    queryFn: () => api<any>(`/api/tournaments/${tournamentId}/standings`),
    refetchInterval: 10000,
  })

  const currentRound = useMemo(() => {
    const rows = games.data?.games ?? []
    return rows.length ? Math.max(...rows.map((g: any) => g.roundNumber || 0)) : 0
  }, [games.data])

  return (
    <div className="space-y-4">
      <BackButton label="← Назад к управлению" fallbackTo={`/admin/tournaments/${tournamentId}`} />
      <StickerCard title={tournament.data?.tournament?.title ?? 'Турнир'}>
        <div className="text-sm opacity-80">
          Статус: {statusLabel(tournament.data?.tournament?.status ?? 'draft')}
        </div>
        <div className="text-sm opacity-80">Текущий тур: {currentRound || '—'}</div>
      </StickerCard>
      <StickerCard title="Пары текущего тура">
        <div className="space-y-2">
          {(games.data?.games ?? [])
            .filter((g: any) => g.roundNumber === currentRound)
            .map((g: any) => (
              <div key={g.id} className="rounded-xl border border-white/15 px-3 py-2 text-sm">
                Стол {g.table_number}: {g.white?.username || 'Игрок'} vs {g.black?.username || (g.result === 'bye' ? 'BYE' : 'Игрок')} · {g.result ?? 'ожидается'}
              </div>
            ))}
        </div>
      </StickerCard>
      <StickerCard title="Таблица турнира">
        <div className="space-y-2">
          {(standings.data?.standings ?? []).map((s: any) => (
            <div key={`${s.place}-${s.playerName}`} className="flex items-center justify-between rounded-xl border border-white/15 px-3 py-2 text-sm">
              <div>{s.place}. {s.playerName}</div>
              <div className="font-bold">{s.points} · {s.symbols}</div>
            </div>
          ))}
        </div>
      </StickerCard>
    </div>
  )
}

