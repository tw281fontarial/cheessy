import { getSupabaseClient } from './supabase'
import { api } from './api'

export const TOURNAMENT_POSTERS_BUCKET = 'tournament-posters'

type SignedPosterUpload = {
  objectPath: string
  token: string
  publicUrl: string
}

export async function uploadTournamentPoster(file: File, tournamentId?: string | null) {
  if (!file || !(file instanceof File)) throw new Error('Файл не выбран')
  if (!file.type || !file.type.startsWith('image/')) throw new Error('Можно загрузить только изображение')
  if (file.type === 'image/svg+xml') throw new Error('SVG запрещён')
  const MAX = 5 * 1024 * 1024
  if (file.size > MAX) throw new Error('Файл слишком большой (макс 5 MB)')

  const signed = await api<SignedPosterUpload>('/api/admin/storage/tournament-posters/signed-upload', {
    method: 'POST',
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type,
      fileSize: file.size,
      tournamentId: tournamentId ?? null,
    }),
  })

  const supabase = getSupabaseClient()
  const { error: uploadError } = await supabase.storage.from(TOURNAMENT_POSTERS_BUCKET).uploadToSignedUrl(signed.objectPath, signed.token, file, {
    contentType: file.type,
  })
  if (uploadError) throw new Error(uploadError.message)

  if (!signed.publicUrl) throw new Error('Не удалось получить public URL')

  return { publicUrl: signed.publicUrl, objectPath: signed.objectPath }
}
