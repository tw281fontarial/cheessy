import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { api } from '../../../lib/api'
import { statusLabel } from '../../../lib/display'
import { StickerCard } from '../../components/StickerCard'
import { BackButton } from '../../components/BackButton'

type DisplayTournamentResponse = {
  tournament: {
    title: string
    status: string
  }
}

type DisplayGame = {
  id: string
  roundNumber: number
  table_number: number
  assigned_table_number: number | null
  status: 'waiting' | 'playing' | 'completed'
  result: string | null
  white: { username: string | null } | null
  black: { username: string | null } | null
}

type DisplayGamesResponse = {
  games: DisplayGame[]
}

type DisplayStandingsResponse = {
  standings: Array<{
    place: number
    playerName: string
    points: number
    symbols: string
  }>
}

export function AdminTournamentDisplayScreen() {
  const { id } = useParams()
  const tournamentId = useMemo(() => id ?? '', [id])
  const tournament = useQuery({
    queryKey: ['admin', 'display', 'tournament', tournamentId],
    enabled: Boolean(tournamentId),
    queryFn: () => api<DisplayTournamentResponse>(`/api/admin/tournaments/${tournamentId}`),
  })
  const games = useQuery({
    queryKey: ['admin', 'display', 'games', tournamentId],
    enabled: Boolean(tournamentId),
    queryFn: () => api<DisplayGamesResponse>(`/api/admin/tournaments/${tournamentId}/games`),
    refetchInterval: 10000,
  })
  const standings = useQuery({
    queryKey: ['admin', 'display', 'standings', tournamentId],
    enabled: Boolean(tournamentId),
    queryFn: () => api<DisplayStandingsResponse>(`/api/tournaments/${tournamentId}/standings`),
    refetchInterval: 10000,
  })

  const currentRound = useMemo(() => {
    const rows = games.data?.games ?? []
    return rows.length ? Math.max(...rows.map((g) => g.roundNumber || 0)) : 0
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
            .filter((g) => g.roundNumber === currentRound)
            .map((g) => (
              <div key={g.id} className="rounded-xl border border-white/15 px-3 py-2 text-sm">
                {g.status === 'waiting' ? `Очередь ${g.table_number}` : `Стол ${g.assigned_table_number ?? g.table_number}`}:{' '}
                {g.white?.username || 'Игрок'} vs {g.black?.username || (g.result === 'bye' ? 'BYE' : 'Игрок')} · {g.result ?? (g.status === 'waiting' ? 'ждёт стол' : 'ожидается')}
              </div>
            ))}
        </div>
      </StickerCard>
      <StickerCard title="Таблица турнира">
        <div className="space-y-2">
          {(standings.data?.standings ?? []).map((s) => (
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
