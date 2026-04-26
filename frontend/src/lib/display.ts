export type ParticipantLike = {
  playerName?: string | null
  username?: string | null
  firstName?: string | null
  lastName?: string | null
}

export function statusLabel(status: string) {
  switch (status) {
    case 'draft':
      return 'Черновик'
    case 'registration_open':
      return 'Регистрация открыта'
    case 'registration_closed':
      return 'Регистрация закрыта'
    case 'running':
      return 'Турнир идёт'
    case 'finished':
      return 'Завершён'
    default:
      return status
  }
}

export function registrationStatusLabel(status: string) {
  switch (status) {
    case 'registered':
      return 'Зарегистрирован'
    case 'cancelled':
      return 'Отменил'
    case 'no_show':
      return 'Не пришёл'
    default:
      return status
  }
}

export function arrivalStatusLabel(status: string) {
  if (status === 'late') return 'Опаздывает'
  return 'Обычный'
}

export function sourceLabel(source: string) {
  switch (source) {
    case 'offline_admin':
      return 'Офлайн'
    case 'telegram':
      return 'Telegram'
    default:
      return source
  }
}

export function getParticipantDisplay(u: ParticipantLike): { primary: string; secondary: string | null } {
  const playerName = (u.playerName ?? '').trim()
  if (playerName) return { primary: playerName, secondary: null }
  const username = (u.username ?? '').trim()
  const isTechOffline = username.startsWith('offline_')
  const fullName = `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim()

  if (username && !isTechOffline) {
    return { primary: `@${username.replace(/^@/, '')}`, secondary: fullName || null }
  }

  // offline technical username should never be shown
  if (fullName) return { primary: fullName, secondary: null }

  if (username && isTechOffline) return { primary: 'Офлайн-участник', secondary: null }

  return { primary: 'Игрок', secondary: null }
}

