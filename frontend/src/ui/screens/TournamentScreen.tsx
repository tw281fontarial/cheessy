import { useMemo } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { api } from '../../lib/api'
import { StickerCard } from '../components/StickerCard'
import { Button } from '../components/Button'
import { BackButton } from '../components/BackButton'

type Tournament = {
  id: string
  title: string
  description: string | null
  startsAt: string
  locationText: string
  status: string
  registrationOpen: boolean
  myRegistration: { status: string; checkedIn: boolean } | null
}

export function TournamentScreen() {
  const { id } = useParams()
  const tournamentId = useMemo(() => id ?? '', [id])

  const q = useQuery({
    queryKey: ['tournament', tournamentId],
    enabled: Boolean(tournamentId),
    queryFn: () => api<{ tournament: Tournament }>(`/api/tournaments/${tournamentId}`),
  })

  const register = useMutation({
    mutationFn: () => api(`/api/tournaments/${tournamentId}/register`, { method: 'POST', body: JSON.stringify({}) }),
    onSuccess: () => q.refetch(),
  })

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <BackButton />
      </div>
      {q.isLoading ? <div className="text-sm">Загружаю…</div> : null}
      {q.isError ? <div className="text-sm text-red-700">Ошибка: {(q.error as Error).message}</div> : null}
      {q.data ? (
        <>
          <StickerCard title={q.data.tournament.title} right={<span className="text-xs font-black">{q.data.tournament.status}</span>}>
            <div className="space-y-2 text-sm">
              <div className="font-bold">{new Date(q.data.tournament.startsAt).toLocaleString()}</div>
              <div className="opacity-80">{q.data.tournament.locationText}</div>
              {q.data.tournament.description ? <div className="opacity-90">{q.data.tournament.description}</div> : null}
            </div>
          </StickerCard>

          <StickerCard title="Регистрация">
            {q.data.tournament.myRegistration ? (
              <div className="space-y-3">
                <div className="text-sm">
                  Ты уже зарегистрирован. Статус: <span className="font-black">{q.data.tournament.myRegistration.status}</span>
                </div>
                <Button variant="yellow" disabled>
                  Уже в списке
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-sm opacity-80">
                  {q.data.tournament.registrationOpen ? 'Регистрация открыта.' : 'Регистрация закрыта админом.'}
                </div>
                <Button
                  variant={q.data.tournament.registrationOpen ? 'black' : 'danger'}
                  disabled={!q.data.tournament.registrationOpen || register.isPending}
                  onClick={() => register.mutate()}
                >
                  {register.isPending
                    ? 'Регистрирую…'
                    : q.data.tournament.registrationOpen
                      ? 'Зарегистрироваться'
                      : 'Нельзя зарегистрироваться'}
                </Button>
                {register.isSuccess ? (
                  <div className="text-sm font-black">Вы зарегистрированы</div>
                ) : null}
                {register.isError ? (
                  <div className="text-sm text-red-700">Ошибка: {(register.error as Error).message}</div>
                ) : null}
              </div>
            )}
          </StickerCard>
        </>
      ) : null}
    </div>
  )
}

