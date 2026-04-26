export type ParticipantLike = {
  username?: string | null
  firstName?: string | null
  lastName?: string | null
}

export function getParticipantDisplay(u: ParticipantLike): { primary: string; secondary: string | null } {
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

