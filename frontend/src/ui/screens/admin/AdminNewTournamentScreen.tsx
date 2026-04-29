import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../../../lib/api'
import { uploadTournamentPoster } from '../../../lib/uploadTournamentPoster'
import { StickerCard } from '../../components/StickerCard'
import { Button } from '../../components/Button'
import { BackButton } from '../../components/BackButton'

type MeResponse = {
  user: {
    role: 'user' | 'admin'
  }
}

type TournamentStatus = 'draft' | 'registration_open' | 'registration_closed'

export function AdminNewTournamentScreen() {
  const nav = useNavigate()
  const [search] = useSearchParams()
  const me = useQuery({ queryKey: ['me'], queryFn: () => api<MeResponse>('/api/me'), retry: false })

  const [title, setTitle] = useState(search.get('title') ?? '')
  const [description, setDescription] = useState(search.get('description') ?? '')
  const [locationText, setLocationText] = useState(search.get('locationText') ?? '')
  const [organizerContact, setOrganizerContact] = useState(search.get('organizerContact') ?? '')
  const [format, setFormat] = useState(search.get('format') ?? '')
  const [timeControl, setTimeControl] = useState(search.get('timeControl') ?? '')
  const [importantNote, setImportantNote] = useState(search.get('importantNote') ?? '')
  const [posterUrl, setPosterUrl] = useState(search.get('posterUrl') ?? '')
  const [posterUploadError, setPosterUploadError] = useState<string | null>(null)
  const [startsAt, setStartsAt] = useState(() => new Date(Date.now() + 72 * 3600_000).toISOString().slice(0, 16))
  const [maxPlayers, setMaxPlayers] = useState<number | ''>(Number(search.get('maxPlayers') || 32))
  const [tablesCount, setTablesCount] = useState<number | ''>(Number(search.get('tablesCount') || 4))
  const [status, setStatus] = useState<TournamentStatus>('draft')

  const body = useMemo(() => {
    return {
      title,
      description,
      locationText,
      startsAt: new Date(startsAt).toISOString(),
      maxPlayers: maxPlayers === '' ? null : Number(maxPlayers),
      tablesCount: tablesCount === '' ? null : Number(tablesCount),
      organizerContact: organizerContact || null,
      format: format || null,
      timeControl: timeControl || null,
      importantNote: importantNote || null,
      posterUrl: posterUrl || null,
      status,
    }
  }, [title, description, locationText, startsAt, maxPlayers, tablesCount, organizerContact, format, timeControl, importantNote, posterUrl, status])

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

  const uploadPoster = useMutation({
    mutationFn: async (file: File) => {
      setPosterUploadError(null)
      const { publicUrl } = await uploadTournamentPoster(file, null)
      return publicUrl
    },
    onSuccess: (url) => setPosterUrl(url),
    onError: (e) => setPosterUploadError((e as Error).message),
  })

  if (me.isLoading) return <div className="text-sm">Загружаю…</div>
  if (me.isError) return <div className="text-sm text-red-700">Ошибка: {(me.error as Error).message}</div>
  if (me.data?.user?.role !== 'admin') {
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
            <div className="text-xs font-black">Контакт организатора</div>
            <input
              className="mt-1 w-full rounded-xl border-4 border-black px-3 py-2 text-sm"
              value={organizerContact}
              onChange={(e) => setOrganizerContact(e.target.value)}
              placeholder="Например: @tw281fontarial"
            />
          </label>
          <label className="block">
            <div className="text-xs font-black">Формат</div>
            <select className="mt-1 w-full rounded-xl border-4 border-black px-3 py-2 text-sm" value={format} onChange={(e) => setFormat(e.target.value)}>
              <option value="">—</option>
              <option value="Блиц">Блиц</option>
              <option value="Рапид">Рапид</option>
              <option value="Классика">Классика</option>
              <option value="Другое">Другое</option>
            </select>
          </label>
          <label className="block">
            <div className="text-xs font-black">Контроль времени</div>
            <input
              className="mt-1 w-full rounded-xl border-4 border-black px-3 py-2 text-sm"
              value={timeControl}
              onChange={(e) => setTimeControl(e.target.value)}
              placeholder="Например: 5+0, 3+2, 10+5"
            />
          </label>
          <label className="block">
            <div className="text-xs font-black">Важно для участников</div>
            <textarea
              className="mt-1 w-full rounded-xl border-4 border-black px-3 py-2 text-sm"
              value={importantNote}
              onChange={(e) => setImportantNote(e.target.value)}
              rows={2}
            />
          </label>
          <label className="block">
            <div className="text-xs font-black">Афиша турнира (URL)</div>
            <input
              type="url"
              className="mt-1 w-full rounded-xl border-4 border-black px-3 py-2 text-sm"
              value={posterUrl}
              onChange={(e) => setPosterUrl(e.target.value)}
              placeholder="https://..."
            />
            <div className="mt-2 flex items-start gap-2">
              <label className="shrink-0 inline-block rounded-xl border border-white/20 bg-[#0f172a] px-3 py-2 text-xs font-bold text-white">
                {uploadPoster.isPending ? 'Загрузка…' : 'Загрузить афишу'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploadPoster.isPending}
                  onChange={(e) => {
                    const f = e.currentTarget.files?.[0]
                    e.currentTarget.value = ''
                    if (!f) return
                    uploadPoster.mutate(f)
                  }}
                />
              </label>
              <div className="text-xs opacity-70">Можно вставить ссылку вручную или загрузить изображение из галереи.</div>
            </div>
            {posterUploadError ? <div className="mt-2 text-xs text-red-700">{posterUploadError}</div> : null}
            {posterUrl ? (
              <img
                src={posterUrl}
                alt="Афиша"
                className="mt-2 h-40 w-full rounded-xl object-cover"
                onError={(e) => {
                  ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                }}
              />
            ) : null}
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
            <div className="text-xs font-black">Количество столов в заведении</div>
            <input
              type="number"
              min={1}
              className="mt-1 w-full rounded-xl border-4 border-black px-3 py-2 text-sm"
              value={tablesCount}
              onChange={(e) => setTablesCount(e.target.value === '' ? '' : Number(e.target.value))}
            />
          </label>

          <label className="block">
            <div className="text-xs font-black">Статус</div>
            <select
              className="mt-1 w-full rounded-xl border-4 border-black px-3 py-2 text-sm font-bold"
              value={status}
              onChange={(e) => setStatus(e.target.value as TournamentStatus)}
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
