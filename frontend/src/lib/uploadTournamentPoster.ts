import { getSupabaseClient } from './supabase'

export const TOURNAMENT_POSTERS_BUCKET = 'tournament-posters'

function safeFileName(name: string) {
  const lower = (name || 'poster').toLowerCase()
  const noSpaces = lower.replace(/\s+/g, '-')
  const cleaned = noSpaces.replace(/[^a-z0-9._-]/g, '')
  const collapsed = cleaned.replace(/-+/g, '-').replace(/_+/g, '_')
  const trimmed = collapsed.replace(/^[-_.]+|[-_.]+$/g, '')
  return trimmed || 'poster'
}

export async function uploadTournamentPoster(file: File, tournamentId?: string | null) {
  if (!file || !(file instanceof File)) throw new Error('Файл не выбран')
  if (!file.type || !file.type.startsWith('image/')) throw new Error('Можно загрузить только изображение')
  if (file.type === 'image/svg+xml') throw new Error('SVG запрещён')
  const MAX = 5 * 1024 * 1024
  if (file.size > MAX) throw new Error('Файл слишком большой (макс 5 MB)')

  const supabase = getSupabaseClient()
  const ts = Date.now()
  const base = safeFileName(file.name)
  const pathBase = tournamentId ? `tournaments/${tournamentId}` : 'tournaments/new'
  const objectPath = `${pathBase}/${ts}-${base}`

  const { error: uploadError } = await supabase.storage.from(TOURNAMENT_POSTERS_BUCKET).upload(objectPath, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type,
  })
  if (uploadError) throw new Error(uploadError.message)

  const { data } = supabase.storage.from(TOURNAMENT_POSTERS_BUCKET).getPublicUrl(objectPath)
  const publicUrl = data?.publicUrl
  if (!publicUrl) throw new Error('Не удалось получить public URL')

  return { publicUrl, objectPath }
}

