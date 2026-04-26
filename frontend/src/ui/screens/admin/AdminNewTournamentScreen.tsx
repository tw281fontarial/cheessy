import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../../lib/api'
import { StickerCard } from '../../components/StickerCard'
import { Button } from '../../components/Button'
import { BackButton } from '../../components/BackButton'

export function AdminNewTournamentScreen() {
  const nav = useNavigate()
  const me = useQuery({ queryKey: ['me'], queryFn: () => api<any>('/api/me'), retry: false })

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [locationText, setLocationText] = useState('')
  const [startsAt, setStartsAt] = useState(() => new Date(Date.now() + 72 * 3600_000).toISOString().slice(0, 16))
  const [maxPlayers, setMaxPlayers] = useState<number | ''>(32)
  const [status, setStatus] = useState<'draft' | 'registration_open'>('draft')

  const body = useMemo(() => {
    return {
      title,
      description,
      locationText,
      startsAt: new Date(startsAt).toISOString(),
      maxPlayers: maxPlayers === '' ? null : Number(maxPlayers),
      status,
    }
  }, [title, description, locationText, startsAt, maxPlayers, status])

  const create = useMutation({
    mutationFn: async () => {
      const created = await api<{ ok: boolean; id: string }>('/api/admin/tournaments', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      return created
    },
    onSuccess: (r) => {
      alert('Турнир создан')
      nav(`/admin/tournaments/${r.id}`)
    },
  })

  if (me.isLoading) return <div className="text-sm">Загружаю…</div>
  if (me.isError) return <div className="text-sm text-red-700">Ошибка: {(me.error as Error).message}</div>
  if ((me.data as any)?.user?.role !== 'admin') {
    return (
      <StickerCard title="Создать турнир">
        <div className="text-sm text-red-700 font-bold">Forbidden</div>
      </StickerCard>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <BackButton label="← Назад" fallbackTo="/tournaments" />
        <Link
          to="/tournaments"
          className="rounded-xl border border-white/20 bg-[#0f172a] px-3 py-2 text-xs font-bold text-white"
        >
          ← В приложение
        </Link>
      </div>
      <StickerCard
        title="Создать турнир"
        right={
          <BackButton label="← К админке" fallbackTo="/tournaments" />
        }
      >
        <div className="space-y-3">
          <label className="block">
            <div className="text-xs font-black">Название</div>
            <input
              className="mt-1 w-full rounded-xl border-4 border-black px-3 py-2 text-sm"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>

          <label className="block">
            <div className="text-xs font-black">Описание</div>
            <textarea
              className="mt-1 w-full rounded-xl border-4 border-black px-3 py-2 text-sm"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </label>

          <label className="block">
            <div className="text-xs font-black">Локация</div>
            <input
              className="mt-1 w-full rounded-xl border-4 border-black px-3 py-2 text-sm"
              value={locationText}
              onChange={(e) => setLocationText(e.target.value)}
            />
          </label>

          <label className="block">
            <div className="text-xs font-black">Дата и время начала</div>
            <input
              type="datetime-local"
              className="mt-1 w-full rounded-xl border-4 border-black px-3 py-2 text-sm"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
          </label>

          <label className="block">
            <div className="text-xs font-black">Лимит участников</div>
            <input
              type="number"
              className="mt-1 w-full rounded-xl border-4 border-black px-3 py-2 text-sm"
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(e.target.value === '' ? '' : Number(e.target.value))}
            />
          </label>

          <label className="block">
            <div className="text-xs font-black">Статус</div>
            <select
              className="mt-1 w-full rounded-xl border-4 border-black px-3 py-2 text-sm font-bold"
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
            >
              <option value="draft">Черновик</option>
              <option value="registration_open">Регистрация открыта</option>
              <option value="registration_closed">Регистрация закрыта</option>
            </select>
          </label>

          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            {create.isPending ? 'Создаю…' : 'Создать'}
          </Button>
          {create.isError ? <div className="text-sm text-red-700">Ошибка: {(create.error as Error).message}</div> : null}
        </div>
      </StickerCard>
    </div>
  )
}

