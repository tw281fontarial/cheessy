import { getTelegramWebApp } from './telegram'

export function isDevMode() {
  // If not running inside Telegram Mini App, enable dev mode.
  const wa = getTelegramWebApp()
  const initData = wa?.initData ?? ''
  return !initData
}

