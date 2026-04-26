import { env, isLocalhostHost } from './env'
import { getTelegramWebApp } from './telegram'

export function isDevMode() {
  return isLocalhostHost(window.location.hostname)
}

export function canUseDevPanelForUser(username: string | null | undefined) {
  if (isDevMode()) return true
  if (!username) return false
  return env.devAllowedUsernames.includes(username.toLowerCase())
}

export function isInsideTelegramWebApp() {
  return Boolean(getTelegramWebApp())
}

